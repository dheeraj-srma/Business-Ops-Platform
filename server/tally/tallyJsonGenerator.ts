import { TallyStockItemModel } from './tallyMapper';

export interface TallyJsonPayload {
  version: string;
  generatedAt: string;
  sourceSystem: string;
  targetSystem: string;
  companyName: string;
  totalItems: number;
  totalValuation: number;
  masters: {
    stockGroups: string[];
    units: string[];
  };
  stockItems: TallyStockItemModel[];
}

export function generateTallyJson(
  items: TallyStockItemModel[],
  companyName: string = 'Apex Industrial Solutions (2026-27)'
): string {
  const stockGroupSet = new Set<string>();
  const unitSet = new Set<string>();
  let totalValuation = 0;

  items.forEach((item) => {
    if (item.stockGroup) stockGroupSet.add(item.stockGroup);
    if (item.baseUnits) unitSet.add(item.baseUnits);
    totalValuation += item.openingValue || 0;
  });

  const payload: TallyJsonPayload = {
    version: '2.0.0',
    generatedAt: new Date().toISOString(),
    sourceSystem: 'Apex Stock Management System',
    targetSystem: 'TallyPrime / Tally.ERP 9 Connector',
    companyName,
    totalItems: items.length,
    totalValuation: Math.round(totalValuation * 100) / 100,
    masters: {
      stockGroups: Array.from(stockGroupSet),
      units: Array.from(unitSet),
    },
    stockItems: items,
  };

  return JSON.stringify(payload, null, 2);
}
