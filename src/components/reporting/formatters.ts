/** Format number as Czech currency (Kč) */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Format number with thousand separators */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('cs-CZ').format(value);
}

/** Format percentage */
export function formatPercent(value: number): string {
  return `${value} %`;
}

/** Format month key (YYYY-MM) to Czech month name */
export function formatMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('cs-CZ', { month: 'short', year: '2-digit' });
}

/** Offer status labels */
export const STATUS_LABELS: Record<string, string> = {
  draft: 'Koncept',
  sent: 'Odesláno',
  accepted: 'Přijato',
  rejected: 'Odmítnuto',
  expired: 'Vypršelo',
  cancelled: 'Zrušeno',
};

/** Status colors for charts */
export const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  sent: '#3b82f6',
  accepted: '#10b981',
  rejected: '#ef4444',
  expired: '#f59e0b',
  cancelled: '#6b7280',
};
