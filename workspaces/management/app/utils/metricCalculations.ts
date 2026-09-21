/**
 * Central Authoritative Metric Calculations
 * 
 * Mathematically trustworthy calculation utilities for BI analytics.
 * Guarantees zero NaN / Infinity, documented denominators, and consistent invariants.
 */

/**
 * Calculate Average Order Value (AOV)
 * Formula: Total Completed/Approved Revenue / Completed/Approved Orders Count
 */
export function calculateAOV(revenue: number | null | undefined, completedOrderCount: number | null | undefined): number {
  const rev = Number(revenue) || 0;
  const count = Number(completedOrderCount) || 0;
  if (count <= 0 || rev < 0) return 0;
  return Number((rev / count).toFixed(2));
}

/**
 * Calculate Order Fulfillment Rate
 * Formula: (Fulfilled/Dispatched/Delivered Orders / Total Reservation-Eligible Orders) * 100
 */
export function calculateFulfillmentRate(
  fulfilledCount: number | null | undefined,
  eligibleCount: number | null | undefined
): number {
  const fulfilled = Number(fulfilledCount) || 0;
  const eligible = Number(eligibleCount) || 0;
  if (eligible <= 0 || fulfilled < 0) return 0;
  const rate = (fulfilled / eligible) * 100;
  return Number(Math.min(100, Math.max(0, rate)).toFixed(1));
}

/**
 * Calculate Return Rate %
 * Clearly documented denominator: (Total Return Transactions / Total Order Logs) * 100
 */
export function calculateReturnRate(
  returnCount: number | null | undefined,
  orderCount: number | null | undefined
): number {
  const ret = Number(returnCount) || 0;
  const orders = Number(orderCount) || 0;
  if (orders <= 0 || ret < 0) return 0;
  const rate = (ret / orders) * 100;
  return Number(Math.min(100, Math.max(0, rate)).toFixed(2));
}

/**
 * Calculate Total Physical Inventory Asset Value
 * Formula: sum(physical quantity * unit cost)
 */
export interface InventoryValuationItem {
  quantity: number | null | undefined;
  unitCost: number | null | undefined;
}

export function calculateInventoryValue(items: InventoryValuationItem[]): number {
  if (!Array.isArray(items) || items.length === 0) return 0;
  let total = 0;
  for (const item of items) {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const cost = Math.max(0, Number(item.unitCost) || 0);
    total += qty * cost;
  }
  return Number(total.toFixed(2));
}

/**
 * Calculate Inventory Turnover Ratio
 * Formula: Cost of Goods Sold (COGS) / Average Inventory Value
 */
export function calculateInventoryTurnover(
  cogs: number | null | undefined,
  averageInventoryValue: number | null | undefined
): number {
  const cost = Number(cogs) || 0;
  const avgInv = Number(averageInventoryValue) || 0;
  if (avgInv <= 0 || cost <= 0) return 0;
  return Number((cost / avgInv).toFixed(2));
}

/**
 * Calculate Percentage Share of Total
 * Formula: (itemValue / totalValue) * 100
 */
export function calculateShare(
  itemValue: number | null | undefined,
  totalValue: number | null | undefined
): number {
  const val = Number(itemValue) || 0;
  const total = Number(totalValue) || 0;
  if (total <= 0 || val <= 0) return 0;
  return Number(((val / total) * 100).toFixed(1));
}

/**
 * Calculate ABC Classification
 * Standard Inventory Pareto Analysis:
 * Sort items descending by annual consumption/inventory value.
 * Class A: Cumulative contribution up to 70%
 * Class B: Cumulative contribution 70% to 90%
 * Class C: Cumulative contribution remaining 10% (90% to 100%)
 */
export interface ABCClassifiedItem<T> {
  item: T;
  value: number;
  share: number;
  cumulativeShare: number;
  classification: 'A' | 'B' | 'C';
}

export function calculateABC<T>(
  items: T[],
  getValue: (item: T) => number
): ABCClassifiedItem<T>[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  // Map and sort descending
  const mapped = items.map(item => ({
    item,
    value: Math.max(0, Number(getValue(item)) || 0),
  })).sort((a, b) => b.value - a.value);

  const totalValue = mapped.reduce((sum, el) => sum + el.value, 0);
  if (totalValue <= 0) {
    return mapped.map(m => ({
      item: m.item,
      value: m.value,
      share: 0,
      cumulativeShare: 0,
      classification: 'C' as const,
    }));
  }

  let runningSum = 0;
  return mapped.map(m => {
    runningSum += m.value;
    const share = (m.value / totalValue) * 100;
    const cumulativeShare = (runningSum / totalValue) * 100;

    let classification: 'A' | 'B' | 'C' = 'C';
    if (cumulativeShare <= 70.0 || (runningSum - m.value === 0 && cumulativeShare > 70.0)) {
      classification = 'A';
    } else if (cumulativeShare <= 90.0) {
      classification = 'B';
    } else {
      classification = 'C';
    }

    return {
      item: m.item,
      value: Number(m.value.toFixed(2)),
      share: Number(share.toFixed(2)),
      cumulativeShare: Number(cumulativeShare.toFixed(2)),
      classification,
    };
  });
}
