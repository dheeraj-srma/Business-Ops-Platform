export function cn(...inputs: (string | boolean | undefined | null | Record<string, boolean | undefined | null>)[]) {
  const classes: string[] = [];
  for (const input of inputs) {
    if (!input) continue;
    if (typeof input === 'string') {
      classes.push(input);
    } else if (typeof input === 'object') {
      for (const [key, val] of Object.entries(input)) {
        if (val) classes.push(key);
      }
    }
  }
  return classes.join(' ');
}

/**
 * Convert a YYYY-MM-DD ISO date string to DD/MM chart axis label.
 * e.g. "2026-09-21" -> "21/09"
 */
export function fmtDayMonth(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const s = String(isoDate).slice(0, 10);
  const parts = s.split('-');
  if (parts.length >= 3) return `${parts[2]}/${parts[1]}`;
  return s.slice(5); // fallback to MM-DD
}

/**
 * Convert a YYYY-MM-DD ISO date string to DD/MM/YYYY full date label.
 * e.g. "2026-09-21" -> "21/09/2026"
 */
export function fmtDayMonthYear(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const s = String(isoDate).slice(0, 10);
  const parts = s.split('-');
  if (parts.length >= 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return s;
}

export function formatDate(dateString: string | number | Date | null | undefined): string {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

export function formatShortDate(dateString: string | number | Date | null | undefined): string {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatNumber(num: number | string | null | undefined): string {
  if (num === null || num === undefined || num === '') return '0';
  const val = Number(num);
  if (isNaN(val)) return '0';
  if (Number.isInteger(val)) {
    return new Intl.NumberFormat('en-IN').format(val);
  }
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(Math.round(val * 100) / 100);
}

export function formatCurrency(num: number | string | null | undefined): string {
  if (num === null || num === undefined || num === '') return '₹0.00';
  const val = Number(num);
  if (isNaN(val)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(Math.round(val * 100) / 100);
}

export function getStockStatus(currentStock: number, minStock: number = 15, critStock: number = 5): string {
  if (currentStock < 0) return 'NEGATIVE';
  if (currentStock === 0) return 'OUT_OF_STOCK';
  if (currentStock <= critStock) return 'CRITICAL';
  if (currentStock <= minStock) return 'LOW';
  return 'HEALTHY';
}
