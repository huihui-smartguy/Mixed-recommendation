import { describe, it, expect } from 'vitest';
import { classOfChange, fmtMoney, fmtPct } from '@/utils/format';

describe('format · fmtPct', () => {
  it('adds plus sign for positive values', () => {
    expect(fmtPct(3.14)).toBe('+3.14%');
  });
  it('keeps minus sign for negative values', () => {
    expect(fmtPct(-1.2)).toBe('-1.20%');
  });
  it('formats zero without a sign', () => {
    expect(fmtPct(0)).toBe('0.00%');
  });
  it('respects digits parameter', () => {
    expect(fmtPct(1.2345, 1)).toBe('+1.2%');
  });
});

describe('format · fmtMoney', () => {
  it('formats hundreds of millions', () => {
    expect(fmtMoney(120_000_000)).toBe('1.20 亿');
  });
  it('formats tens of thousands', () => {
    expect(fmtMoney(1_280_000)).toBe('128.0 万');
  });
  it('formats below 万 without unit', () => {
    expect(fmtMoney(8500)).toBe('8500');
  });
});

describe('format · classOfChange', () => {
  it('detects positive', () => {
    expect(classOfChange(0.5)).toBe('up');
  });
  it('detects negative', () => {
    expect(classOfChange(-0.5)).toBe('down');
  });
  it('treats near-zero as flat', () => {
    expect(classOfChange(0)).toBe('flat');
    expect(classOfChange(0.00001)).toBe('flat');
  });
});
