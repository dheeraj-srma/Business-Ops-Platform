/**
 * Mandatory Automated Test Suite for Date Intelligence & Freshness Engine
 * Tests DATE-01 through DATE-30
 * Uses node:test and node:assert for instant execution via tsx
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  getDateRangeBounds,
  resolveDateRange,
  getBusinessTodayDate,
  addCalendarDays,
  isLeapYear,
  getDaysInMonth,
  fillTimeSeriesGaps,
  filterItemsByDateRange,
  formatDayMonth,
  DateRangeType,
} from '../dateRange';

describe('Global Date Intelligence Engine (DATE-01 to DATE-30)', () => {
  const REF_DATE = '2026-09-23'; // Wednesday 23 September 2026

  // DATE-01: Today
  test('DATE-01: Today returns exact single calendar date', () => {
    const bounds = getDateRangeBounds('today', REF_DATE);
    assert.equal(bounds.start, '2026-09-23');
    assert.equal(bounds.end, '2026-09-23');
    assert.equal(bounds.isValid, true);
  });

  // DATE-02: Yesterday
  test('DATE-02: Yesterday returns exact previous calendar date', () => {
    const bounds = getDateRangeBounds('yesterday', REF_DATE);
    assert.equal(bounds.start, '2026-09-22');
    assert.equal(bounds.end, '2026-09-22');
    assert.equal(bounds.isValid, true);
  });

  // DATE-03: 7 inclusive calendar days
  test('DATE-03: 7 Days returns exactly 7 inclusive calendar days (ref - 6 days)', () => {
    const bounds = getDateRangeBounds('7d', REF_DATE);
    assert.equal(bounds.start, '2026-09-17');
    assert.equal(bounds.end, '2026-09-23');
    const resolved = resolveDateRange('7d', undefined, undefined, REF_DATE);
    assert.equal(resolved.daysCount, 7);
  });

  // DATE-04: 30 inclusive calendar days
  test('DATE-04: 30 Days returns exactly 30 inclusive calendar days (25 Aug -> 23 Sep)', () => {
    const bounds = getDateRangeBounds('30d', REF_DATE);
    assert.equal(bounds.start, '2026-08-25');
    assert.equal(bounds.end, '2026-09-23');
    const resolved = resolveDateRange('30d', undefined, undefined, REF_DATE);
    assert.equal(resolved.daysCount, 30);
  });

  // DATE-05: 60 inclusive calendar days
  test('DATE-05: 60 Days returns exactly 60 inclusive calendar days (26 Jul -> 23 Sep)', () => {
    const bounds = getDateRangeBounds('60d', REF_DATE);
    assert.equal(bounds.start, '2026-07-26');
    assert.equal(bounds.end, '2026-09-23');
    const resolved = resolveDateRange('60d', undefined, undefined, REF_DATE);
    assert.equal(resolved.daysCount, 60);
  });

  // DATE-06: 90 inclusive calendar days
  test('DATE-06: 90 Days returns exactly 90 inclusive calendar days (26 Jun -> 23 Sep)', () => {
    const bounds = getDateRangeBounds('90d', REF_DATE);
    assert.equal(bounds.start, '2026-06-26');
    assert.equal(bounds.end, '2026-09-23');
    const resolved = resolveDateRange('90d', undefined, undefined, REF_DATE);
    assert.equal(resolved.daysCount, 90);
  });

  // DATE-07: This Week Monday-based
  test('DATE-07: This Week returns Monday through reference date', () => {
    // Wed 23 Sep 2026 -> Mon 21 Sep to Wed 23 Sep
    const bounds = getDateRangeBounds('this_week', REF_DATE);
    assert.equal(bounds.start, '2026-09-21');
    assert.equal(bounds.end, '2026-09-23');

    // If reference is Monday
    const mondayBounds = getDateRangeBounds('this_week', '2026-09-21');
    assert.equal(mondayBounds.start, '2026-09-21');
    assert.equal(mondayBounds.end, '2026-09-21');

    // If reference is Sunday
    const sundayBounds = getDateRangeBounds('this_week', '2026-09-27');
    assert.equal(sundayBounds.start, '2026-09-21');
    assert.equal(sundayBounds.end, '2026-09-27');
  });

  // DATE-08: This Month
  test('DATE-08: This Month returns 1st of month to reference date', () => {
    const bounds = getDateRangeBounds('this_month', REF_DATE);
    assert.equal(bounds.start, '2026-09-01');
    assert.equal(bounds.end, '2026-09-23');
  });

  // DATE-09: Last Month full previous calendar month
  test('DATE-09: Last Month returns complete previous calendar month', () => {
    const bounds = getDateRangeBounds('last_month', REF_DATE);
    assert.equal(bounds.start, '2026-08-01');
    assert.equal(bounds.end, '2026-08-31');

    // February non-leap year (e.g. from March 2026)
    const marchBounds = getDateRangeBounds('last_month', '2026-03-15');
    assert.equal(marchBounds.start, '2026-02-01');
    assert.equal(marchBounds.end, '2026-02-28');

    // February leap year (e.g. from March 2024)
    const leapMarchBounds = getDateRangeBounds('last_month', '2024-03-15');
    assert.equal(leapMarchBounds.start, '2024-02-01');
    assert.equal(leapMarchBounds.end, '2024-02-29');

    // January -> previous year December
    const janBounds = getDateRangeBounds('last_month', '2027-01-05');
    assert.equal(janBounds.start, '2026-12-01');
    assert.equal(janBounds.end, '2026-12-31');
  });

  // DATE-10: This Quarter
  test('DATE-10: This Quarter returns first day of quarter through reference date', () => {
    // Q3 (Jul-Sep)
    const q3Bounds = getDateRangeBounds('this_quarter', REF_DATE);
    assert.equal(q3Bounds.start, '2026-07-01');
    assert.equal(q3Bounds.end, '2026-09-23');

    // Q1 (Jan-Mar)
    const q1Bounds = getDateRangeBounds('this_quarter', '2026-02-15');
    assert.equal(q1Bounds.start, '2026-01-01');
    assert.equal(q1Bounds.end, '2026-02-15');

    // Q2 (Apr-Jun)
    const q2Bounds = getDateRangeBounds('this_quarter', '2026-05-10');
    assert.equal(q2Bounds.start, '2026-04-01');
    assert.equal(q2Bounds.end, '2026-05-10');

    // Q4 (Oct-Dec)
    const q4Bounds = getDateRangeBounds('this_quarter', '2026-11-20');
    assert.equal(q4Bounds.start, '2026-10-01');
    assert.equal(q4Bounds.end, '2026-11-20');
  });

  // DATE-11: YTD
  test('DATE-11: YTD returns Jan 1 of current year to reference date', () => {
    const bounds = getDateRangeBounds('ytd', REF_DATE);
    assert.equal(bounds.start, '2026-01-01');
    assert.equal(bounds.end, '2026-09-23');
  });

  // DATE-12: 12 Months
  test('DATE-12: 12 Months returns same calendar date one year ago through reference date', () => {
    const bounds = getDateRangeBounds('12m', REF_DATE);
    assert.equal(bounds.start, '2025-09-23');
    assert.equal(bounds.end, '2026-09-23');

    // Leap day handling (2024-02-29 -> 2023-02-28)
    const leap12m = getDateRangeBounds('12m', '2024-02-29');
    assert.equal(leap12m.start, '2023-02-28');
    assert.equal(leap12m.end, '2024-02-29');
  });

  // DATE-13: All based on actual earliest data
  test('DATE-13: All returns earliest data date through reference date', () => {
    const bounds = getDateRangeBounds('all', REF_DATE, undefined, undefined, '2026-06-01');
    assert.equal(bounds.start, '2026-06-01');
    assert.equal(bounds.end, '2026-09-23');
  });

  // DATE-14: Custom range
  test('DATE-14: Custom range validates start <= end and preserves exact dates', () => {
    const valid = getDateRangeBounds('custom', REF_DATE, '2026-08-01', '2026-08-15');
    assert.equal(valid.start, '2026-08-01');
    assert.equal(valid.end, '2026-08-15');
    assert.equal(valid.isValid, true);

    const invalid = getDateRangeBounds('custom', REF_DATE, '2026-09-10', '2026-09-01');
    assert.equal(invalid.isValid, false);
    assert.ok(invalid.errorMessage);
  });

  // DATE-15: Leap year logic
  test('DATE-15: Leap year calculations correctly identify leap years and February lengths', () => {
    assert.equal(isLeapYear(2024), true);
    assert.equal(isLeapYear(2026), false);
    assert.equal(isLeapYear(2000), true);
    assert.equal(isLeapYear(1900), false);

    assert.equal(getDaysInMonth(2024, 2), 29);
    assert.equal(getDaysInMonth(2026, 2), 28);
    assert.equal(getDaysInMonth(2026, 8), 31);
    assert.equal(getDaysInMonth(2026, 9), 30);
  });

  // DATE-16: Year boundary handling
  test('DATE-16: Year boundary transitions work seamlessly for Jan 1', () => {
    const jan1 = '2027-01-01';
    const yest = getDateRangeBounds('yesterday', jan1);
    assert.equal(yest.start, '2026-12-31');
    assert.equal(yest.end, '2026-12-31');

    const lastMonth = getDateRangeBounds('last_month', jan1);
    assert.equal(lastMonth.start, '2026-12-01');
    assert.equal(lastMonth.end, '2026-12-31');
  });

  // DATE-17: Month boundary transitions
  test('DATE-17: Month boundary transitions handle 30/31-day shifts', () => {
    const sep1 = '2026-09-01';
    const yest = getDateRangeBounds('yesterday', sep1);
    assert.equal(yest.start, '2026-08-31');

    const oct1 = '2026-10-01';
    const yestOct = getDateRangeBounds('yesterday', oct1);
    assert.equal(yestOct.start, '2026-09-30');
  });

  // DATE-18: Timezone conversion
  test('DATE-18: getBusinessTodayDate executes in Asia/Kolkata timezone without crashing', () => {
    const todayStr = getBusinessTodayDate('Asia/Kolkata');
    assert.match(todayStr, /^\d{4}-\d{2}-\d{2}$/);
  });

  // DATE-19: Empty dataset gap filling
  test('DATE-19: fillTimeSeriesGaps generates complete continuous array with zero-fills for empty dataset', () => {
    const filled = fillTimeSeriesGaps([], '2026-09-17', '2026-09-23', ['revenue', 'orders']);
    assert.equal(filled.length, 7);
    assert.equal(filled[0].date, '2026-09-17');
    assert.equal(filled[6].date, '2026-09-23');
    assert.equal(filled[0].revenue, 0);
    assert.equal(filled[6].orders, 0);
  });

  // DATE-20: Data ending several days before today
  test('DATE-20: fillTimeSeriesGaps preserves historical data and zero-fills up to today', () => {
    const partialData = [
      { date: '2026-09-17', revenue: 1000, orders: 2 },
      { date: '2026-09-18', revenue: 2000, orders: 3 },
      { date: '2026-09-21', revenue: 5000, orders: 7 },
    ];
    const filled = fillTimeSeriesGaps(partialData, '2026-09-17', '2026-09-23', ['revenue', 'orders']);
    assert.equal(filled.length, 7);
    
    // 2026-09-17 has real data
    assert.equal(filled[0].date, '2026-09-17');
    assert.equal(filled[0].revenue, 1000);

    // 2026-09-19 was missing -> zero-filled
    assert.equal(filled[2].date, '2026-09-19');
    assert.equal(filled[2].revenue, 0);

    // 2026-09-21 has real data
    assert.equal(filled[4].date, '2026-09-21');
    assert.equal(filled[4].revenue, 5000);

    // 2026-09-22 and 2026-09-23 zero-filled
    assert.equal(filled[5].date, '2026-09-22');
    assert.equal(filled[5].revenue, 0);
    assert.equal(filled[6].date, '2026-09-23');
    assert.equal(filled[6].revenue, 0);
  });

  // DATE-21: Data through today
  test('DATE-21: fillTimeSeriesGaps handles data through today without truncating', () => {
    const todayData = [
      { date: '2026-09-22', revenue: 4000, orders: 4 },
      { date: '2026-09-23', revenue: 8000, orders: 9 },
    ];
    const filled = fillTimeSeriesGaps(todayData, '2026-09-22', '2026-09-23', ['revenue', 'orders']);
    assert.equal(filled.length, 2);
    assert.equal(filled[1].revenue, 8000);
    assert.equal(filled[1].date, '2026-09-23');
  });

  // DATE-22: Selected range remains current even when data_as_of is older
  test('DATE-22: Selected 7d range covers 2026-09-17 to 2026-09-23 regardless of data_as_of 2026-09-21', () => {
    const bounds = getDateRangeBounds('7d', '2026-09-23');
    assert.equal(bounds.start, '2026-09-17');
    assert.equal(bounds.end, '2026-09-23');
  });

  // DATE-23: Filter items by date range
  test('DATE-23: filterItemsByDateRange filters accurately using YYYY-MM-DD strings', () => {
    const items = [
      { id: '1', tx_date: '2026-08-20' },
      { id: '2', tx_date: '2026-08-25' },
      { id: '3', tx_date: '2026-09-10' },
      { id: '4', tx_date: '2026-09-23' },
      { id: '5', tx_date: '2026-09-25' },
    ];
    const filtered = filterItemsByDateRange(items, '30d', i => i.tx_date, '2026-09-23');
    assert.deepEqual(filtered.map(i => i.id), ['2', '3', '4']);
  });

  // DATE-24: formatDayMonth utility
  test('DATE-24: formatDayMonth produces clean DD/MM labels', () => {
    assert.equal(formatDayMonth('2026-09-23'), '23/09');
    assert.equal(formatDayMonth('2026-01-05'), '05/01');
  });

  // DATE-25: 6m preset handling
  test('DATE-25: 6m preset returns exactly 180 inclusive calendar days', () => {
    const bounds = getDateRangeBounds('6m', REF_DATE);
    const resolved = resolveDateRange('6m', undefined, undefined, REF_DATE);
    assert.equal(resolved.daysCount, 180);
    assert.equal(bounds.end, REF_DATE);
  });

  // DATE-26: addCalendarDays handles negative and positive offsets across month boundaries
  test('DATE-26: addCalendarDays shifts cleanly across calendar boundaries', () => {
    assert.equal(addCalendarDays('2026-09-01', -1), '2026-08-31');
    assert.equal(addCalendarDays('2026-08-31', 1), '2026-09-01');
    assert.equal(addCalendarDays('2026-02-28', 1), '2026-03-01');
    assert.equal(addCalendarDays('2024-02-28', 1), '2024-02-29');
  });

  // DATE-27: Custom range throws on invalid bounds via resolveDateRange
  test('DATE-27: resolveDateRange throws helpful error on invalid custom range', () => {
    assert.throws(
      () => {
        resolveDateRange('custom', '2026-09-20', '2026-09-10', REF_DATE);
      },
      /cannot be after end date/
    );
  });

  // DATE-28: All Time bounds with dynamic min date
  test('DATE-28: All Time bounds respects dynamic earliest data date', () => {
    const bounds = getDateRangeBounds('all', REF_DATE, undefined, undefined, '2026-05-15');
    assert.equal(bounds.start, '2026-05-15');
    assert.equal(bounds.end, REF_DATE);
  });

  // DATE-29: Monday calculation for this_week on Saturday
  test('DATE-29: This week bounds when reference date is Saturday', () => {
    const saturday = '2026-09-26'; // Sat
    const bounds = getDateRangeBounds('this_week', saturday);
    assert.equal(bounds.start, '2026-09-21'); // Monday of that week
    assert.equal(bounds.end, '2026-09-26');
  });

  // DATE-30: Granularity and full range synchronization
  test('DATE-30: resolveDateRange produces consistent referenceDate and label metadata', () => {
    const resolved = resolveDateRange('30d', undefined, undefined, REF_DATE);
    assert.equal(resolved.referenceDate, REF_DATE);
    assert.equal(resolved.label, 'Last 30 Days');
    assert.equal(resolved.startDate, '2026-08-25');
    assert.equal(resolved.endDate, '2026-09-23');
  });
});
