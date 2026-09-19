import { ProductRow, TallyProductMappingRow } from '../../db';
import { NormalizedItem } from '../types';

export interface MatchResult {
  matched: boolean;
  product?: ProductRow;
  mapping?: TallyProductMappingRow;
  matchType?: 'EXTERNAL_ID' | 'SKU_DIRECT' | 'ALIAS' | 'EXACT_NAME' | 'FUZZY_NAME';
  unmappedIdentifier?: string;
}

export function matchTallyItemToProduct(
  item: NormalizedItem,
  products: ProductRow[],
  mappings: TallyProductMappingRow[]
): MatchResult {
  const rawName = (item.product_name || '').trim();
  const rawSku = (item.product_sku || '').trim();
  const rawAlias = (item.alias || '').trim();
  const rawExtId = (item.external_product_id || '').trim();

  // Tier 1: Match by External Product ID in mappings
  if (rawExtId) {
    const mapMatch = mappings.find(
      (m) => m.tally_stock_item_id && m.tally_stock_item_id.toLowerCase() === rawExtId.toLowerCase()
    );
    if (mapMatch) {
      const prod = products.find((p) => p.id === mapMatch.product_id);
      if (prod) return { matched: true, product: prod, mapping: mapMatch, matchType: 'EXTERNAL_ID' };
    }
  }

  // Tier 2: Match by SKU
  if (rawSku) {
    const skuProd = products.find((p) => p.sku.toLowerCase() === rawSku.toLowerCase());
    if (skuProd) {
      const mapMatch = mappings.find((m) => m.product_id === skuProd.id);
      return { matched: true, product: skuProd, mapping: mapMatch, matchType: 'SKU_DIRECT' };
    }
  }

  // Tier 3: Match by Alias in Mappings or item alias
  if (rawAlias) {
    const aliasMap = mappings.find(
      (m) => m.tally_alias && m.tally_alias.toLowerCase() === rawAlias.toLowerCase()
    );
    if (aliasMap) {
      const prod = products.find((p) => p.id === aliasMap.product_id);
      if (prod) return { matched: true, product: prod, mapping: aliasMap, matchType: 'ALIAS' };
    }
  }

  // Also check if rawName matches any tally_product_mappings.tally_stock_item_name
  if (rawName) {
    const mapByName = mappings.find(
      (m) => m.tally_stock_item_name && m.tally_stock_item_name.toLowerCase() === rawName.toLowerCase()
    );
    if (mapByName) {
      const prod = products.find((p) => p.id === mapByName.product_id);
      if (prod) return { matched: true, product: prod, mapping: mapByName, matchType: 'EXACT_NAME' };
    }

    // Tier 4: Direct Product Name Match
    const prodByName = products.find((p) => p.name.toLowerCase() === rawName.toLowerCase());
    if (prodByName) {
      const mapMatch = mappings.find((m) => m.product_id === prodByName.id);
      return { matched: true, product: prodByName, mapping: mapMatch, matchType: 'EXACT_NAME' };
    }

    // Try normalized match (remove extra spaces, punctuation)
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normName = normalize(rawName);
    const prodByNorm = products.find((p) => normalize(p.name) === normName);
    if (prodByNorm) {
      const mapMatch = mappings.find((m) => m.product_id === prodByNorm.id);
      return { matched: true, product: prodByNorm, mapping: mapMatch, matchType: 'FUZZY_NAME' };
    }
  }

  return {
    matched: false,
    unmappedIdentifier: rawName || rawSku || rawAlias || rawExtId || 'Unknown Product',
  };
}
