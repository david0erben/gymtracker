const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const oneDecimal = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

export function formatNumber(value: number | null | undefined, decimals: 1 | 2 = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  return (decimals === 1 ? oneDecimal : numberFormat).format(value);
}

export function formatKg(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Körpergewicht';
  return `${formatNumber(value)} kg`;
}

/** „37,5“ und „37.5“ sind beide gültig. */
export function parseDecimal(input: string): number | null {
  const value = input.trim().replace(',', '.');
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseInteger(input: string): number | null {
  const value = input.trim();
  if (!/^\d+$/.test(value)) return null;
  return Number(value);
}

export function formatSet(reps: number | null, weight: number | null): string {
  if (weight === null || weight === 0) return `${reps ?? '–'} Reps`;
  return `${reps ?? '–'} × ${formatNumber(weight)}`;
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
