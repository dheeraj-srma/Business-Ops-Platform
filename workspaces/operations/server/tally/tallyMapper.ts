import { ProductRow, CategoryRow } from '../db';

export interface TallyStockItemModel {
  guid: string;
  name: string;
  partNo: string;
  stockGroup: string;
  baseUnits: string;
  openingBalance: string;
  openingValue: number;
  openingRate: number;
  description: string;
  isItemActive: boolean;
  reorderLevel: number;
  minimumLevel: number;
  lastUpdated: string;
}

export function mapToTallyStockItem(
  product: ProductRow,
  categories: CategoryRow[],
  guidPrefix: string = 'APEX-STOCK-'
): TallyStockItemModel {
  const category = categories.find((c) => c.id === product.category_id);
  const stockGroup = category ? category.name : 'Primary';
  
  // Format unit string according to Tally convention (e.g. "Pcs", "Kgs", "Mtr", "Nos")
  let unitCode = product.unit;
  const lowerUnit = product.unit.toLowerCase();
  if (lowerUnit.includes('piece') || lowerUnit.includes('pcs')) unitCode = 'PCS';
  else if (lowerUnit.includes('box')) unitCode = 'BOX';
  else if (lowerUnit.includes('pack')) unitCode = 'PAC';
  else if (lowerUnit.includes('meter')) unitCode = 'MTR';
  else if (lowerUnit.includes('kg')) unitCode = 'KGS';
  else if (lowerUnit.includes('gram')) unitCode = 'GMS';
  else if (lowerUnit.includes('litre')) unitCode = 'LTR';

  const openingBalanceFormatted = `${product.current_stock} ${unitCode}`;
  const openingValue = Math.round(product.current_stock * (product.unit_cost || 0) * 100) / 100;
  const openingRate = product.unit_cost || 0;

  return {
    guid: `${guidPrefix}${product.id}-${product.sku}`,
    name: product.name,
    partNo: product.sku,
    stockGroup,
    baseUnits: unitCode,
    openingBalance: openingBalanceFormatted,
    openingValue,
    openingRate,
    description: product.description || '',
    isItemActive: product.is_active,
    reorderLevel: product.minimum_stock,
    minimumLevel: product.critical_stock,
    lastUpdated: product.updated_at,
  };
}
