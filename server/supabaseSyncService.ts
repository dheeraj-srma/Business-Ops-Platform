import { db, ProductRow, CategoryRow } from './db';
import { supabase, isSupabaseConfigured } from './supabaseClient';

export const DEFAULT_WAREHOUSE_LOCATION_ID = '92db6a9f-6a52-5df1-5748-70301279a94a';

interface SyncCatalogResult {
  success: boolean;
  message: string;
  productsCount: number;
  categoriesCount: number;
  inStockCount: number;
  totalQuantity: number;
  durationMs: number;
}

class SupabaseSyncService {
  private isSyncing: boolean = false;
  private lastSyncAt: string | null = null;
  private lastSyncResult: SyncCatalogResult | null = null;

  public getStatus() {
    const dbState = db.getState();
    const activeProducts = dbState.products.filter((p) => p.is_active);
    const inStock = activeProducts.filter((p) => p.current_stock > 0);
    const totalQty = activeProducts.reduce((sum, p) => sum + p.current_stock, 0);

    return {
      connected: isSupabaseConfigured(),
      isSyncing: this.isSyncing,
      lastSyncAt: this.lastSyncAt,
      lastSyncResult: this.lastSyncResult,
      localStats: {
        totalProducts: dbState.products.length,
        activeProducts: activeProducts.length,
        inStockCount: inStock.length,
        totalQuantity: Math.round(totalQty),
        categoriesCount: dbState.categories.length,
      },
    };
  }

  /**
   * Fetches the entire product catalog and inventory balances from the live Supabase
   * database ('inventory_catalog' view) and syncs it into local transactional storage.
   */
  public async syncCatalogFromSupabase(): Promise<SyncCatalogResult> {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        message: 'Supabase credentials not configured in .env. Running in offline file mode.',
        productsCount: db.getState().products.length,
        categoriesCount: db.getState().categories.length,
        inStockCount: db.getState().products.filter((p) => p.current_stock > 0).length,
        totalQuantity: 0,
        durationMs: 0,
      };
    }

    if (this.isSyncing) {
      return {
        success: true,
        message: 'Sync already in progress.',
        productsCount: db.getState().products.length,
        categoriesCount: db.getState().categories.length,
        inStockCount: db.getState().products.filter((p) => p.current_stock > 0).length,
        totalQuantity: 0,
        durationMs: 0,
      };
    }

    this.isSyncing = true;
    const startTime = Date.now();

    try {
      console.log('[Supabase Sync] Pulling live inventory catalog from database...');

      let allCatalogRows: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let targetSource = 'inventory_catalog';

      // 1st Attempt: Fetch from inventory_catalog view
      try {
        while (true) {
          const { data, error } = await supabase
            .from('inventory_catalog')
            .select('*')
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (error || !data) break;
          allCatalogRows = allCatalogRows.concat(data);

          if (data.length < pageSize) break;
          page++;
        }
      } catch (err) {
        console.warn('[Supabase Sync] View inventory_catalog query failed, trying inventory table fallback:', err);
      }

      // 2nd Attempt Fallback: Fetch from public.inventory table if view returned 0 rows
      if (allCatalogRows.length === 0) {
        targetSource = 'inventory';
        page = 0;
        try {
          while (true) {
            const { data, error } = await supabase
              .from('inventory')
              .select('*')
              .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
              console.warn('[Supabase Sync] Table inventory query returned error:', error.message);
              break;
            }

            if (!data || data.length === 0) break;
            allCatalogRows = allCatalogRows.concat(data);

            if (data.length < pageSize) break;
            page++;
          }
        } catch (err) {
          console.warn('[Supabase Sync] Table inventory query failed:', err);
        }
      }

      console.log(`[Supabase Sync] Fetched ${allCatalogRows.length} items from database (${targetSource}).`);

      if (allCatalogRows.length === 0) {
        console.warn('[Supabase Sync] Database returned 0 products. Retaining cached local inventory products.');
        return {
          success: true,
          message: 'Supabase returned 0 products. Preserving cached local inventory.',
          productsCount: db.getState().products.length,
          categoriesCount: db.getState().categories.length,
          inStockCount: db.getState().products.filter((p) => p.current_stock > 0).length,
          totalQuantity: 0,
          durationMs: Date.now() - startTime,
        };
      }

      // 1. Build distinct category list
      const rawCategorySet = new Set<string>();
      allCatalogRows.forEach((r) => {
        const c = String(r.category || r.Category || 'General').trim();
        if (c) rawCategorySet.add(c);
      });

      const sortedCategories = Array.from(rawCategorySet).sort();
      const categoryMap = new Map<string, string>(); // categoryName -> categoryId

      const categories: CategoryRow[] = sortedCategories.map((name, idx) => {
        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        const id = `cat-${slug || idx + 1}`;
        categoryMap.set(name, id);
        return {
          id,
          name,
          description: `${name} product manufacturer line`,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

      // Default category
      if (!categoryMap.has('General')) {
        const genId = 'cat-general';
        categoryMap.set('General', genId);
        categories.unshift({
          id: genId,
          name: 'General',
          description: 'General miscellaneous hardware and fittings',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      // 2. Map catalog items into ProductRow
      let inStockCount = 0;
      let totalQuantity = 0;

      const products: ProductRow[] = allCatalogRows.map((r) => {
        const catName = String(r.category || r.Category || 'General').trim();
        const catId = categoryMap.get(catName) || 'cat-general';
        const rawStock = Number(r.current_stock ?? r['Current Stock'] ?? 0);
        const currentStock = isNaN(rawStock) ? 0 : rawStock;
        const reservedStock = Number(r.reserved_quantity ?? r['Reserved Stock'] ?? 0) || 0;
        const price = Number(r.price ?? r.Price ?? 0) || 0;
        const name = String(r.item_name || r['Item Name'] || r.name || '').trim();
        const sku = String(r.sku || r.SKU || '').trim();
        const unit = String(r.unit || r.Unit || 'NOS').trim() || 'NOS';
        const brand = String(r.brand || r.Brand || 'Nalka Metals').trim();

        if (currentStock > 0) inStockCount++;
        totalQuantity += currentStock;

        return {
          id: String(r.id),
          sku: sku || `SKU-${r.id.slice(0, 8)}`,
          name: name || `Product ${sku}`,
          category_id: catId,
          description: `${brand} | ${catName} | Unit: ${unit}`,
          unit,
          current_stock: currentStock,
          reserved_stock: reservedStock,
          minimum_stock: 15,
          critical_stock: 5,
          unit_cost: price,
          standard_selling_price: price,
          valuation_method: 'Avg Cost',
          stock_group: catName,
          is_active: r.is_active !== false,
          created_at: r.updated_at || new Date().toISOString(),
          updated_at: r.updated_at || new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
        };
      });

      // 3. Atomically persist into transactional database
      await db.transaction((dbState) => {
        dbState.categories = categories;
        dbState.products = products;
        return true;
      });

      // 4. Fetch live system_settings for allow_negative_orders stock override
      try {
        const { data: settingsList } = await supabase
          .from('system_settings')
          .select('*');

        if (settingsList && settingsList.length > 0) {
          const target = settingsList.find(
            (s: any) =>
              s.setting_key === 'allow_negative_orders' ||
              s.setting_key === 'allow_negative_stock' ||
              s.setting === 'allow_negative_orders' ||
              s.key === 'allow_negative_orders'
          );

          if (target) {
            const v = target.setting_value !== undefined ? target.setting_value : target.value;
            const isAllowed =
              v === true ||
              v === 'true' ||
              v === 1 ||
              (typeof v === 'string' && v.toLowerCase() === 'true') ||
              (typeof v === 'object' && v !== null && (v === true || (v as any).enabled === true || (v as any).value === true));

            await db.transaction((dbState) => {
              dbState.settings.allow_negative_orders = Boolean(isAllowed);
              return true;
            });
          }
        }
      } catch (settingErr: any) {
        console.warn('[Supabase Sync] Could not fetch system_settings:', settingErr.message);
      }

      const durationMs = Date.now() - startTime;
      const result: SyncCatalogResult = {
        success: true,
        message: `Successfully synchronized ${products.length} products and ${categories.length} categories from the new Supabase database.`,
        productsCount: products.length,
        categoriesCount: categories.length,
        inStockCount,
        totalQuantity: Math.round(totalQuantity),
        durationMs,
      };

      this.lastSyncAt = new Date().toISOString();
      this.lastSyncResult = result;

      console.log(
        `[Supabase Sync] Sync complete in ${durationMs}ms: ${products.length} products (${inStockCount} in stock, total qty: ${Math.round(totalQuantity)}).`
      );

      return result;
    } catch (err: any) {
      console.error('[Supabase Sync] Catalog sync failed:', err);
      return {
        success: false,
        message: err.message || 'Failed to sync catalog from Supabase.',
        productsCount: db.getState().products.length,
        categoriesCount: db.getState().categories.length,
        inStockCount: 0,
        totalQuantity: 0,
        durationMs: Date.now() - startTime,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Pushes updated stock quantities back to the Supabase PostgreSQL database
   * supporting both catalog schema ('inventory' keyed by item_name) and normalized schema ('inventory' keyed by product_id, location_id).
   */
  public async syncStockToSupabase(products: ProductRow[]): Promise<{ updatedCount: number }> {
    if (!isSupabaseConfigured() || !supabase || !products || products.length === 0) {
      return { updatedCount: 0 };
    }

    const nowIso = new Date().toISOString();
    let updatedCount = 0;

    try {
      const chunkSize = 50;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      // 1. Primary Sync: Update 'inventory' catalog table (item_name primary key schema)
      const catalogPayload = products
        .filter((p) => p.name || p.sku)
        .map((p) => ({
          item_name: p.name,
          sku: p.sku,
          category: p.stock_group || 'General',
          price: p.standard_selling_price || p.unit_cost || 0,
          current_stock: Math.max(0, p.current_stock),
          reserved_stock: Math.max(0, p.reserved_stock || 0),
          updated_at: nowIso,
        }));

      if (catalogPayload.length > 0) {
        for (let i = 0; i < catalogPayload.length; i += chunkSize) {
          const chunk = catalogPayload.slice(i, i + chunkSize);
          const { error } = await supabase
            .from('inventory')
            .upsert(chunk, { onConflict: 'item_name' });

          if (error) {
            console.warn('[Supabase Sync] Error during inventory catalog upsert chunk:', error.message);
          } else {
            updatedCount += chunk.length;
          }
        }
      }

      // 2. Secondary Sync: Update normalized 'inventory' table (product_id, location_id schema if present)
      const uuidProducts = products.filter((p) => p.id && uuidRegex.test(p.id));
      if (uuidProducts.length > 0) {
        const normPayload = uuidProducts.map((p) => ({
          product_id: p.id,
          location_id: DEFAULT_WAREHOUSE_LOCATION_ID,
          quantity_on_hand: Math.max(0, p.current_stock),
          quantity_reserved: Math.max(0, p.reserved_stock || 0),
          updated_at: nowIso,
        }));

        for (let i = 0; i < normPayload.length; i += chunkSize) {
          const chunk = normPayload.slice(i, i + chunkSize);
          const { error } = await supabase
            .from('inventory')
            .upsert(chunk, { onConflict: 'product_id,location_id' });

          if (error) {
            console.warn('[Supabase Sync] Note: normalized inventory upsert result:', error.message);
          }
        }
      }

      return { updatedCount };
    } catch (err: any) {
      console.warn('[Supabase Sync] Failed to sync inventory batch to Supabase:', err.message);
      return { updatedCount: 0 };
    }
  }
}

export const supabaseSyncService = new SupabaseSyncService();
