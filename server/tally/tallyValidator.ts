import { ProductRow, CategoryRow } from '../db';

export interface ValidationIssue {
  productId?: string;
  productSku?: string;
  productName?: string;
  field: string;
  issue: string;
  severity: 'ERROR' | 'WARNING';
}

export interface ValidationReport {
  totalChecked: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  issues: ValidationIssue[];
  canProceed: boolean;
}

export function validateInventoryForTally(
  products: ProductRow[],
  categories: CategoryRow[]
): ValidationReport {
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const issues: ValidationIssue[] = [];
  const skuSeen = new Set<string>();

  for (const prod of products) {
    // 1. SKU Check
    if (!prod.sku || prod.sku.trim() === '') {
      issues.push({
        productId: prod.id,
        productName: prod.name,
        field: 'sku',
        issue: 'Product code (SKU) is missing or empty. Tally requires a unique identifier or alias.',
        severity: 'ERROR',
      });
    } else {
      const normalizedSku = prod.sku.trim().toUpperCase();
      if (skuSeen.has(normalizedSku)) {
        issues.push({
          productId: prod.id,
          productSku: prod.sku,
          productName: prod.name,
          field: 'sku',
          issue: `Duplicate SKU "${prod.sku}" detected. Tally item identifiers must be unique.`,
          severity: 'ERROR',
        });
      } else {
        skuSeen.add(normalizedSku);
      }
    }

    // 2. Product Name Check
    if (!prod.name || prod.name.trim().length < 2) {
      issues.push({
        productId: prod.id,
        productSku: prod.sku,
        productName: prod.name || 'Untitled',
        field: 'name',
        issue: 'Product name must be at least 2 characters.',
        severity: 'ERROR',
      });
    }

    // 3. Category / Stock Group Mapping
    const catName = categoryMap.get(prod.category_id);
    if (!catName) {
      issues.push({
        productId: prod.id,
        productSku: prod.sku,
        productName: prod.name,
        field: 'category_id',
        issue: 'Product is not mapped to a valid category (Tally Stock Group).',
        severity: 'ERROR',
      });
    }

    // 4. Unit of Measurement
    if (!prod.unit || prod.unit.trim() === '') {
      issues.push({
        productId: prod.id,
        productSku: prod.sku,
        productName: prod.name,
        field: 'unit',
        issue: 'Base unit of measurement is missing (e.g., Pieces, Kg, Meters).',
        severity: 'ERROR',
      });
    }

    // 5. Stock Value Validation
    if (typeof prod.current_stock !== 'number' || isNaN(prod.current_stock)) {
      issues.push({
        productId: prod.id,
        productSku: prod.sku,
        productName: prod.name,
        field: 'current_stock',
        issue: 'Current stock quantity contains a non-numeric or malformed value.',
        severity: 'ERROR',
      });
    } else if (prod.current_stock < 0) {
      issues.push({
        productId: prod.id,
        productSku: prod.sku,
        productName: prod.name,
        field: 'current_stock',
        issue: `Negative stock quantity (${prod.current_stock} ${prod.unit}) detected. Item will be exported with negative balance without blocking sync.`,
        severity: 'WARNING',
      });
    } else if (prod.current_stock === 0) {
      issues.push({
        productId: prod.id,
        productSku: prod.sku,
        productName: prod.name,
        field: 'current_stock',
        issue: 'Product currently has 0 quantity. It will be exported with zero closing balance.',
        severity: 'WARNING',
      });
    }

    // 6. Unit Cost Check
    if (prod.unit_cost <= 0) {
      issues.push({
        productId: prod.id,
        productSku: prod.sku,
        productName: prod.name,
        field: 'unit_cost',
        issue: 'Unit cost valuation is 0.00. Tally item valuation will show 0.00.',
        severity: 'WARNING',
      });
    }
  }

  const errorCount = issues.filter((i) => i.severity === 'ERROR').length;
  const warningCount = issues.filter((i) => i.severity === 'WARNING').length;
  const validCount = products.length - errorCount;

  return {
    totalChecked: products.length,
    validCount: Math.max(0, validCount),
    warningCount,
    errorCount,
    issues,
    canProceed: errorCount === 0,
  };
}
