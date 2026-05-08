import { describe, it, expect } from 'vitest';
import { DISCLAIMER, checkBannedWords, maskPII } from '@/utils/compliance';

describe('compliance · checkBannedWords', () => {
  it('passes clean text', () => {
    expect(checkBannedWords('请帮我配一份股债平衡组合')).toEqual({ ok: true, hits: [] });
  });

  it('flags single banned word', () => {
    expect(checkBannedWords('帮我推荐保本理财')).toEqual({ ok: false, hits: ['保本'] });
  });

  it('reports all hits when multiple', () => {
    const v = checkBannedWords('某产品保本稳赚一定涨');
    expect(v.ok).toBe(false);
    expect(v.hits).toEqual(expect.arrayContaining(['保本', '稳赚', '一定涨']));
  });

  it('is case-sensitive on Chinese tokens (no false positives)', () => {
    expect(checkBannedWords('保险产品介绍').ok).toBe(true);
  });
});

describe('compliance · maskPII', () => {
  it('masks 18-digit ID numbers', () => {
    const out = maskPII('张三 身份证 11010519491231002X 已上传');
    expect(out).not.toContain('11010519491231002X');
    expect(out).toContain('身份证已脱敏');
  });

  it('masks mainland mobile numbers', () => {
    const out = maskPII('请联系 13812345678');
    expect(out).not.toContain('13812345678');
    expect(out).toContain('手机号已脱敏');
  });

  it('masks bank card / long digit blobs', () => {
    const out = maskPII('卡号 6222020200112233445');
    expect(out).not.toContain('6222020200112233445');
    expect(out).toContain('卡号已脱敏');
  });

  it('leaves short numbers untouched', () => {
    expect(maskPII('收益 8.2%')).toBe('收益 8.2%');
  });
});

describe('compliance · DISCLAIMER constant', () => {
  it('contains the regulatory disclaimer phrase', () => {
    expect(DISCLAIMER).toMatch(/AI/);
    expect(DISCLAIMER).toMatch(/不构成/);
  });
});
