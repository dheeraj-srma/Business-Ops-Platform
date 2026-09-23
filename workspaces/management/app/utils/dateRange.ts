/**
 * Shared Authoritative Date Range & Calendar Intelligence Engine
 * 
 * Strict calendar date calculations using ISO YYYY-MM-DD string comparisons.
 * Standard business timezone: Asia/Kolkata.
 * 
 * Eliminates client timezone drift, naive array slicing, and guarantees continuous
 * calendar windows inclusive of today (even with 0 activity).
 */

export const BUSINESS_TIMEZONE = 'Asia/Kolkata';
export const EARLIEST_DATA_DATE = '2026-06-01';

export type DateRangeType =
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | '60d'
  | '90d'
  | '3m'
  | '6m'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'ytd'
  | '12m'
  | 'all'
  | 'custom';

export interface DateRangeBounds {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  isValid: boolean;
  referenceDate: string; // YYYY-MM-DD
  label?: string;
  errorMessage?: string;
}

/**
 * Returns current business calendar date in Asia/Kolkata (YYYY-MM-DD)
 */
export function getBusinessTodayDate(tz: string = BUSINESS_TIMEZONE): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    // Fallback to local calendar date if timezone is invalid
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

/**
 * Canonical reference date for all business intelligence components
 */
export function getReferenceDate(): string {
  return getBusinessTodayDate(BUSINESS_TIMEZONE);
}

/**
 * Format a Date object to YYYY-MM-DD using calendar date values
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
  const parts = str.slice(0, 10).split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  return new Date(y, m, d);
}

/**
 * Add/subtract days to a YYYY-MM-DD string in pure calendar space
 */
export function addCalendarDays(isoDate: string, days: number): string {
  const d = parseCalendarDate(isoDate);
  d.setDate(d.getDate() + days);
  return formatCalendarDate(d);
}

/**
 * Checks if a given year is a leap year
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Returns number of days in a month (1-indexed month: 1=Jan, 12=Dec)
 */
export function getDaysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }
  return 31;
}

/**
 * Get calendar bounds for a specified date range preset.
 * 
 * @param range The date range preset
 * @param referenceDate The business calendar date (YYYY-MM-DD). Defaults to getReferenceDate().
 * @param customStart Custom range start (YYYY-MM-DD)
 * @param customEnd Custom range end (YYYY-MM-DD)
 * @param dataMinDate Earliest available data date in the database (defaults to EARLIEST_DATA_DATE)
 */
export function getDateRangeBounds(
  range: DateRangeType,
  referenceDate?: string,
  customStart?: string,
  customEnd?: string,
  dataMinDate?: string
): DateRangeBounds {
  const ref = referenceDate ? referenceDate.slice(0, 10) : getReferenceDate();
  const minDate = dataMinDate ? dataMinDate.slice(0, 10) : EARLIEST_DATA_DATE;

  if (range === 'custom') {
    if (!customStart || !customEnd) {
      return {
        start: ref,
        end: ref,
        isValid: false,
        referenceDate: ref,
        errorMessage: 'Custom date range requires both start and end dates',
      };
    }
    const cleanStart = customStart.slice(0, 10);
    const cleanEnd = customEnd.slice(0, 10);
    if (cleanStart > cleanEnd) {
      return {
        start: cleanStart,
        end: cleanEnd,
        isValid: false,
        referenceDate: ref,
        errorMessage: `Start date (${cleanStart}) cannot be after end date (${cleanEnd})`,
      };
    }
    return {
      start: cleanStart,
      end: cleanEnd,
      isValid: true,
      referenceDate: ref,
      label: `${cleanStart} – ${cleanEnd}`,
    };
  }

  const refDate = parseCalendarDate(ref);
  const y = refDate.getFullYear();
  const m = refDate.getMonth(); // 0-11
  const dayOfMonth = refDate.getDate();
  const dayOfWeek = refDate.getDay(); // 0 is Sun, 1 is Mon...

  switch (range) {
    case 'today':
      return { start: ref, end: ref, isValid: true, referenceDate: ref, label: 'Today' };

    case 'yesterday': {
      const yest = addCalendarDays(ref, -1);
      return { start: yest, end: yest, isValid: true, referenceDate: ref, label: 'Yesterday' };
    }

    case '7d': {
      // Exactly 7 calendar dates inclusive: [ref - 6 days, ref]
      const start7d = addCalendarDays(ref, -6);
      return { start: start7d, end: ref, isValid: true, referenceDate: ref, label: 'Last 7 Days' };
    }

    case '30d': {
      // Exactly 30 calendar dates inclusive: [ref - 29 days, ref]
      const start30d = addCalendarDays(ref, -29);
      return { start: start30d, end: ref, isValid: true, referenceDate: ref, label: 'Last 30 Days' };
    }

    case '60d': {
      // Exactly 60 calendar dates inclusive: [ref - 59 days, ref]
      const start60d = addCalendarDays(ref, -59);
      return { start: start60d, end: ref, isValid: true, referenceDate: ref, label: 'Last 60 Days' };
    }

    case '90d':
    case '3m': {
      // Exactly 90 calendar dates inclusive: [ref - 89 days, ref]
      const start90d = addCalendarDays(ref, -89);
      return { start: start90d, end: ref, isValid: true, referenceDate: ref, label: 'Last 90 Days' };
    }

    case '6m': {
      // Exactly 180 calendar dates inclusive: [ref - 179 days, ref]
      const start6m = addCalendarDays(ref, -179);
      return { start: start6m, end: ref, isValid: true, referenceDate: ref, label: 'Last 6 Months' };
    }

    case 'this_week': {
      // Monday of current calendar week through referenceDate
      // JS getDay(): 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
      const diffToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = addCalendarDays(ref, -diffToMon);
      return { start: monday, end: ref, isValid: true, referenceDate: ref, label: 'This Week' };
    }

    case 'this_month': {
      // 1st of current calendar month through referenceDate
      const firstOfMonth = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      return { start: firstOfMonth, end: ref, isValid: true, referenceDate: ref, label: 'This Month' };
    }

    case 'last_month': {
      // Full previous calendar month (1st of prev month to last day of prev month)
      const prevYear = m === 0 ? y - 1 : y;
      const prevMonth = m === 0 ? 12 : m;
      const firstOfLastMonth = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
      const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);
      const lastOfLastMonth = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(daysInPrevMonth).padStart(2, '0')}`;
      return { start: firstOfLastMonth, end: lastOfLastMonth, isValid: true, referenceDate: ref, label: 'Last Month' };
    }

    case 'this_quarter': {
      // Quarter start: Q1: Jan 1, Q2: Apr 1, Q3: Jul 1, Q4: Oct 1 through referenceDate
      const qMonth = Math.floor(m / 3) * 3; // 0, 3, 6, 9
      const qStart = `${y}-${String(qMonth + 1).padStart(2, '0')}-01`;
      return { start: qStart, end: ref, isValid: true, referenceDate: ref, label: 'This Quarter' };
    }

    case 'ytd': {
      // Jan 1 of current year through referenceDate
      const jan1 = `${y}-01-01`;
      return { start: jan1, end: ref, isValid: true, referenceDate: ref, label: 'Year to Date' };
    }

    case '12m': {
      // Same calendar date one year ago through referenceDate (handling Feb 29 leap day)
      let prevYear = y - 1;
      let prevMonth = m + 1;
      let prevDay = dayOfMonth;
      const maxDaysInPrev = getDaysInMonth(prevYear, prevMonth);
      if (prevDay > maxDaysInPrev) {
        prevDay = maxDaysInPrev;
      }
      const start12m = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}`;
      return { start: start12m, end: ref, isValid: true, referenceDate: ref, label: 'Last 12 Months' };
    }

    case 'all': {
      return { start: minDate, end: ref, isValid: true, referenceDate: ref, label: 'All Time' };
    }

    default:
      return { start: ref, end: ref, isValid: true, referenceDate: ref, label: 'Custom' };
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
  customEnd?: string,
  dataMinDate?: string
): T[] {
  if (!items || items.length === 0) return [];

  const bounds = getDateRangeBounds(range, referenceDate, customStart, customEnd, dataMinDate);
  if (!bounds.isValid) return [];

  return items.filter(item => {
    const raw = getDate(item);
    if (!raw) return false;
    const dStr = raw.slice(0, 10);
    return dStr >= bounds.start && dStr <= bounds.end;
  });
}

/**
 * Convenience resolver returning startDate, endDate, daysCount.
 */
export function resolveDateRange(
  range: DateRangeType,
  customStart?: string,
  customEnd?: string,
  referenceDate?: string,
  dataMinDate?: string
): { startDate: string; endDate: string; daysCount: number; isValid: boolean; referenceDate: string; label: string } {
  const bounds = getDateRangeBounds(range, referenceDate, customStart, customEnd, dataMinDate);
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
    referenceDate: bounds.referenceDate,
    label: bounds.label || range,
  };
}

/**
 * Format a YYYY-MM-DD date string to "DD/MM" (e.g. "23/09")
 */
export function formatDayMonth(isoDate: string): string {
  if (!isoDate || isoDate.length < 10) return isoDate;
  const parts = isoDate.slice(0, 10).split('-');
  return `${parts[2]}/${parts[1]}`;
}

/**
 * Fills calendar gaps in a time series from startDate to endDate inclusive.
 * Ensures that EVERY single calendar day is present, zero-filling missing metrics.
 * Preserves the canonical date (YYYY-MM-DD) and formatted name.
 */
export function fillTimeSeriesGaps<T extends { date?: string; name?: string; [key: string]: any }>(
  data: T[],
  startDate: string,
  endDate: string,
  metricKeys: string[] = ['revenue', 'orders', 'outward_qty', 'stock_in', 'stock_out'],
  defaultValue: number = 0,
  nameFormatter: (dateStr: string) => string = formatDayMonth
): Array<T & { date: string; name: string }> {
  const dataMap = new Map<string, T>();
  
  (data || []).forEach(item => {
    const rawDate = item.date || item.name;
    if (rawDate) {
      const cleanDate = rawDate.slice(0, 10);
      dataMap.set(cleanDate, item);
    }
  });

  const result: Array<T & { date: string; name: string }> = [];
  let curr = startDate.slice(0, 10);
  const end = endDate.slice(0, 10);

  // Safety guard against infinite loops in invalid dates
  let safetyCounter = 0;
  const MAX_DAYS = 1500;

  while (curr <= end && safetyCounter < MAX_DAYS) {
    safetyCounter++;
    const existing = dataMap.get(curr);
    if (existing) {
      result.push({
        ...existing,
        date: curr,
        name: existing.name || nameFormatter(curr),
      });
    } else {
      const zeroItem: any = {
        date: curr,
        name: nameFormatter(curr),
      };
      metricKeys.forEach(k => {
        zeroItem[k] = defaultValue;
      });
      result.push(zeroItem);
    }
    curr = addCalendarDays(curr, 1);
  }

  return result;
}

/**
 * Aggregate time-series items when duration exceeds threshold.
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
  metricKeys: string[] = ['revenue', 'orders', 'value'],
  forceInterval?: 'daily' | 'weekly' | 'monthly'
): AggregatedPoint[] {
  if (!data || data.length <= 1) return data as AggregatedPoint[];

  // Extract dates
  const sorted = [...data].sort((a, b) => {
    const da = (a.date || a.name || '').slice(0, 10);
    const db = (b.date || b.name || '').slice(0, 10);
    return da.localeCompare(db);
  });

  const firstDate = (sorted[0].date || sorted[0].name || '').slice(0, 10);
  const lastDate = (sorted[sorted.length - 1].date || sorted[sorted.length - 1].name || '').slice(0, 10);

  if (!firstDate || !lastDate) return sorted as AggregatedPoint[];

  const d1 = parseCalendarDate(firstDate);
  const d2 = parseCalendarDate(lastDate);
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
      label = `Wk ${monStr.slice(8)}/${monStr.slice(5, 7)}`;
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
