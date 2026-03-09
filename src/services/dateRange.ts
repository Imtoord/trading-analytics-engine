export function buildDateRange(range: string): { from: string; to: string } {
  const to   = new Date();
  const from = new Date();
  const map: Record<string, [number, string]> = {
    '1D': [1,'day'],  '1W': [7,'day'],
    '1M': [1,'month'],'3M': [3,'month'],
    '6M': [6,'month'],'1Y': [1,'year'],
    '5Y': [5,'year'],
  };
  const [n, unit] = map[range] || [1,'year'];
  if (unit === 'day')   from.setDate(from.getDate() - n);
  if (unit === 'month') from.setMonth(from.getMonth() - n);
  if (unit === 'year')  from.setFullYear(from.getFullYear() - n);
  return {
    from: from.toISOString().split('T')[0],
    to:   to.toISOString().split('T')[0],
  };
}