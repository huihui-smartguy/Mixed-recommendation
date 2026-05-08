export function fmtPct(n: number, digits = 2): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(digits)}%`;
}

export function fmtMoney(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(2)} 亿`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)} 万`;
  return n.toFixed(0);
}

export function classOfChange(n: number): 'up' | 'down' | 'flat' {
  if (n > 0.0001) return 'up';
  if (n < -0.0001) return 'down';
  return 'flat';
}
