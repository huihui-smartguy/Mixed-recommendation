import { describe, it, expect, vi } from 'vitest';
import {
  gateProductCodes,
  normalizeOnerecResponse,
  toFiniteNumber
} from '@/services/onerecAdapter';

describe('onerecAdapter · toFiniteNumber', () => {
  it('passes through finite numbers', () => {
    expect(toFiniteNumber(3.14)).toBe(3.14);
    expect(toFiniteNumber(0)).toBe(0);
    expect(toFiniteNumber(-2)).toBe(-2);
  });
  it('coerces numeric strings, stripping % and commas', () => {
    expect(toFiniteNumber('12.5')).toBe(12.5);
    expect(toFiniteNumber('12,000')).toBe(12000);
    expect(toFiniteNumber('-3.2%')).toBe(-3.2);
  });
  it('falls back for NaN, Infinity, garbage', () => {
    expect(toFiniteNumber(Number.NaN, 9)).toBe(9);
    expect(toFiniteNumber(Number.POSITIVE_INFINITY, 9)).toBe(9);
    expect(toFiniteNumber('abc', 9)).toBe(9);
    expect(toFiniteNumber(null, 9)).toBe(9);
    expect(toFiniteNumber(undefined, 9)).toBe(9);
    expect(toFiniteNumber('   ', 9)).toBe(9);
  });
});

describe('onerecAdapter · normalizeOnerecResponse', () => {
  it('returns [] on non-array input', () => {
    expect(normalizeOnerecResponse(null)).toEqual([]);
    expect(normalizeOnerecResponse({})).toEqual([]);
    expect(normalizeOnerecResponse('xx')).toEqual([]);
  });

  it('drops items missing required code or name', () => {
    const out = normalizeOnerecResponse([
      { code: '000001', name: 'A' },
      { code: '', name: 'B' },
      { code: '000003' },
      { name: 'D only' },
      null,
      'string'
    ]);
    expect(out.map((p) => p.code)).toEqual(['000001']);
  });

  it('accepts both camelCase and snake_case fields', () => {
    const out = normalizeOnerecResponse([
      {
        product_code: '000961',
        product_name: '天弘沪深300',
        type: '宽基指数',
        net_value: '1.62',
        change_pct: '0.82',
        return_1y: '12.4',
        return_3y: '26.1',
        max_drawdown: '-18.2',
        sharpe: '0.74',
        spark: [1, 1.05, 1.1],
        recommendation: '估值合理'
      }
    ]);
    expect(out).toHaveLength(1);
    const p = out[0];
    expect(p.code).toBe('000961');
    expect(p.name).toBe('天弘沪深300');
    expect(p.category).toBe('宽基指数');
    expect(p.netValue).toBeCloseTo(1.62, 2);
    expect(p.return1y).toBeCloseTo(12.4, 2);
    expect(p.maxDrawdown).toBeCloseTo(-18.2, 2);
    expect(p.reason).toBe('估值合理');
  });

  it('deduplicates by code, keeps first occurrence', () => {
    const out = normalizeOnerecResponse([
      { code: 'X', name: 'first' },
      { code: 'X', name: 'dup' },
      { code: 'Y', name: 'second' }
    ]);
    expect(out.map((p) => p.name)).toEqual(['first', 'second']);
  });

  it('pads short sparkline up to minimum length', () => {
    const out = normalizeOnerecResponse([{ code: 'X', name: 'N', sparkline: [1, 2] }]);
    expect(out[0].sparkline.length).toBeGreaterThanOrEqual(4);
    expect(out[0].sparkline.slice(-2)).toEqual([1, 2]);
  });

  it('downsamples overly long sparkline', () => {
    const long = Array.from({ length: 200 }, (_, i) => i);
    const out = normalizeOnerecResponse([{ code: 'X', name: 'N', sparkline: long }]);
    expect(out[0].sparkline.length).toBeLessThanOrEqual(64);
    expect(out[0].sparkline[0]).toBe(0);
  });

  it('falls back to default reason when missing', () => {
    const out = normalizeOnerecResponse([{ code: 'X', name: 'N' }]);
    expect(out[0].reason).toMatch(/onerec/);
  });
});

describe('onerecAdapter · gateProductCodes', () => {
  it('keeps only codes present in the recall pool', () => {
    const drops: string[] = [];
    const out = gateProductCodes(['A', 'B'], ['A', 'C', 'B', 'D'], (c) => drops.push(c));
    expect(out).toEqual(['A', 'B']);
    expect(drops).toEqual(['C', 'D']);
  });

  it('omits onDrop when not provided', () => {
    expect(gateProductCodes(['A'], ['A', 'X'])).toEqual(['A']);
  });

  it('handles empty inputs', () => {
    const cb = vi.fn();
    expect(gateProductCodes([], ['A'], cb)).toEqual([]);
    expect(cb).toHaveBeenCalledWith('A');
  });
});
