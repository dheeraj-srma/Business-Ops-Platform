/**
 * Shared Calendar Date Range Engine
 * 
 * Strict calendar date calculations using YYYY-MM-DD string comparisons.
 * Eliminates UTC/local timezone shifts, avoids naive slice(-7) / slice(-30),
 * and separates calendar today from the latest available data date.
 */

export type DateRangeType =
  | 'today'
  | 'yesterday'
  | '7d'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | '30d'
  | '90d'
  | '3m'
  | '6m'
  | 'this_quarter'
  | 'ytd'
  | '12m'
  | 'all'
  | 'custom';

export interface DateRangeBounds {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Format a Date object to YYYY-MM-DD using local calendar date values
 */
export function formatCalendarDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a YYYY-MM-DD string to a calendar Date at midnight local time
 */
export function parseCalendarDate(str: string): Date {
  const parts = str.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  return new Date(y, m, d);
}

/**
 * Add days to a YYYY-MM-DD string in pure calendar space
 */
export function addCalendarDays(isoDate: string, days: number): string {
  const d = parseCalendarDate(isoDate);
  d.setDate(d.getDate() + days);
  return formatCalendarDate(d);
}

/**
 * Get calendar bounds for a specified date range preset.
 * 
 * @param range The date range preset
 * @param referenceDate The data-as-of date or current calendar date (YYYY-MM-DD). Defaults to today.
 * @param customStart Custom range start (YYYY-MM-DD)
 * @param customEnd Custom range end (YYYY-MM-DD)
 */
export function getDateRangeBounds(
  range: DateRangeType,
  referenceDate?: string,
  customStart?: string,
  customEnd?: string
): DateRangeBounds {
  const ref = referenceDate || formatCalendarDate(new Date());

  if (range === 'custom') {
    if (!customStart || !customEnd) {
      return {
        start: ref,
        end: ref,
        isValid: false,
        errorMessage: 'Custom date range requires both start and end dates',
      };
    }
    if (customStart > customEnd) {
      return {
        start: customStart,
        end: customEnd,
        isValid: false,
        errorMessage: `Start date (${customStart}) cannot be after end date (${customEnd})`,
      };
    }
    return {
      start: customStart,
      end: customEnd,
      isValid: true,
    };
  }

  const refDate = parseCalendarDate(ref);
  const y = refDate.getFullYear();
  const m = refDate.getMonth(); // 0-11
  const dayOfWeek = refDate.getDay(); // 0 is Sun, 1 is Mon...

  switch (range) {
    case 'today':
      return { start: ref, end: ref, isValid: true };

    case 'yesterday': {
      const yest = addCalendarDays(ref, -1);
      return { start: yest, end: yest, isValid: true };
    }

    case '7d': {
      // Exactly 7 calendar dates inclusive: [ref - 6 days, ref]
      const start7d = addCalendarDays(ref, -6);
      return { start: start7d, end: ref, isValid: true };
    }

    case 'this_week': {
      // Monday through current reference date (or Sunday if past)
      const diffToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = addCalendarDays(ref, -diffToMon);
      return { start: monday, end: ref, isValid: true };
    }

    case 'this_month': {
      // 1st of the reference month to ref
      const firstOfMonth = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      return { start: firstOfMonth, end: ref, isValid: true };
    }

    case 'last_month': {
      // Full previous calendar month
      const prevMonthYear = m === 0 ? y - 1 : y;
      const prevMonth = m === 0 ? 12 : m;
      const firstOfLastMonth = `${prevMonthYear}-${String(prevMonth).padStart(2, '0')}-01`;
      // Last day of previous month
      const lastDayObj = new Date(y, m, 0); // day 0 of current month = last day of prev month
      const lastOfLastMonth = formatCalendarDate(lastDayObj);
      return { start: firstOfLastMonth, end: lastOfLastMonth, isValid: true };
    }

    case '30d': {
      // Exactly 30 calendar dates inclusive: [ref - 29 days, ref]
      const start30d = addCalendarDays(ref, -29);
      return { start: start30d, end: ref, isValid: true };
    }

    case '90d':
    case '3m': {
      // Exactly 90 calendar dates inclusive: [ref - 89 days, ref]
      const start90d = addCalendarDays(ref, -89);
      return { start: start90d, end: ref, isValid: true };
    }

    case '6m': {
      // Exactly 180 calendar dates inclusive: [ref - 179 days, ref]
      const start6m = addCalendarDays(ref, -179);
      return { start: start6m, end: ref, isValid: true };
    }

    case 'this_quarter': {
      // Quarter start: Q1: Jan 1, Q2: Apr 1, Q3: Jul 1, Q4: Oct 1
      const qMonth = Math.floor(m / 3) * 3; // 0, 3, 6, 9
      const qStart = `${y}-${String(qMonth + 1).padStart(2, '0')}-01`;
      return { start: qStart, end: ref, isValid: true };
    }

    case 'ytd': {
      // Jan 1 of the reference year to ref
      const jan1 = `${y}-01-01`;
      return { start: jan1, end: ref, isValid: true };
    }

    case '12m': {
      // Trailing 365 calendar days
      const start12m = addCalendarDays(ref, -364);
      return { start: start12m, end: ref, isValid: true };
    }

    case 'all':
      return { start: '1970-01-01', end: '2099-12-31', isValid: true };

    default:
      return { start: ref, end: ref, isValid: true };
  }
}

/**
 * Filter an array of items by a date range using a date extractor
 */
export function filterItemsByDateRange<T>(
  items: T[],
  range: DateRangeType,
  getDate: (item: T) => string,
  referenceDate?: string,
  customStart?: string,
  customEnd?: string
): T[] {
  if (!items || items.length === 0) return [];
  if (range === 'all') return items;

  const bounds = getDateRangeBounds(range, referenceDate, customStart, customEnd);
  if (!bounds.isValid) return [];

  return items.filter(item => {
    const raw = getDate(item);
    if (!raw) return false;
    const dStr = raw.slice(0, 10);
    return dStr >= bounds.start && dStr <= bounds.end;
  });
}

/**
 * Aggregate time-series items when duration exceeds threshold.
 * 
 * - <= 31 days: return as-is (daily)
 * - 32 to 90 days: weekly buckets
 * - > 90 days: monthly buckets
 */
export interface AggregatedPoint {
  name: string;
  date: string;
  [key: string]: any;
}

export function aggregateTimeSeriesData(
  data: Array<{ name?: string; date?: string; [key: string]: any }>,
  metricKeys: string[] = ['value'],
  forceInterval?: 'daily' | 'weekly' | 'monthly'
): AggregatedPoint[] {
  if (!data || data.length <= 1) return data as AggregatedPoint[];

  // Extract dates
  const sorted = [...data].sort((a, b) => {
    const da = a.date || a.name || '';
    const db = b.date || b.name || '';
    return da.localeCompare(db);
  });

  const firstDate = sorted[0].date || sorted[0].name || '';
  const lastDate = sorted[sorted.length - 1].date || sorted[sorted.length - 1].name || '';

  const d1 = parseCalendarDate(firstDate.slice(0, 10));
  const d2 = parseCalendarDate(lastDate.slice(0, 10));
  const daySpan = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));

  let interval: 'daily' | 'weekly' | 'monthly' = 'daily';
  if (forceInterval) {
    interval = forceInterval;
  } else if (daySpan > 90) {
    interval = 'monthly';
  } else if (daySpan > 31) {
    interval = 'weekly';
  }

  if (interval === 'daily') {
    return sorted as AggregatedPoint[];
  }

  const buckets: Record<string, AggregatedPoint & { counts: number; label: string }> = {};

  sorted.forEach(item => {
    const dStr = (item.date || item.name || '').slice(0, 10);
    if (!dStr || dStr.length < 10) return;

    let bucketKey: string;
    let label: string;

    if (interval === 'monthly') {
      bucketKey = dStr.slice(0, 7); // e.g. "2026-09"
      const parts = bucketKey.split('-');
      const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      label = `${mNames[parseInt(parts[1], 10) - 1]} '${parts[0].slice(2)}`;
    } else {
      // Weekly: get Monday of the week
      const pt = parseCalendarDate(dStr);
      const dow = pt.getDay();
      const diff = dow === 0 ? 6 : dow - 1;
      const monStr = addCalendarDays(dStr, -diff);
      bucketKey = monStr;
      label = `Wk ${monStr.slice(5)}`;
    }

    if (!buckets[bucketKey]) {
      buckets[bucketKey] = {
        name: label,
        label,
        date: bucketKey,
        counts: 0,
      };
      metricKeys.forEach(k => {
        buckets[bucketKey][k] = 0;
      });
    }

    buckets[bucketKey].counts += 1;
    metricKeys.forEach(k => {
      const val = Number(item[k]) || 0;
      buckets[bucketKey][k] = (buckets[bucketKey][k] || 0) + val;
    });
  });

  return Object.keys(buckets)
    .sort()
    .map(k => buckets[k]);
}

/**
 * Convenience resolver returning startDate, endDate, daysCount, and throwing if invalid custom range.
 */
export function resolveDateRange(
  range: DateRangeType,
  customStart?: string,
  customEnd?: string,
  referenceDate?: string
): { startDate: string; endDate: string; daysCount: number; isValid: boolean } {
  const bounds = getDateRangeBounds(range, referenceDate, customStart, customEnd);
  if (!bounds.isValid) {
    throw new Error(bounds.errorMessage || 'Invalid date range');
  }
  const d1 = parseCalendarDate(bounds.start);
  const d2 = parseCalendarDate(bounds.end);
  const daysCount = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  return {
    startDate: bounds.start,
    endDate: bounds.end,
    daysCount,
    isValid: true,
  };
}
