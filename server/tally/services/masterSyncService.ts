import { db, TallyCompanyRow, TallyStockGroupRow, TallyUnitRow, TallyGodownRow, TallyGodownStockRow, ProductRow, CategoryRow, TallyProductMappingRow, SyncHistoryLogRow } from '../../db';
import { getTallyClient } from '../client/tallyClient';
import { TallyConnectionConfig, TallyQueryOptions } from '../client/tallyProtocol';

export class MasterSyncService {
  /**
   * Synchronize Company Master metadata from Tally
   */
  public async syncCompany(config: TallyConnectionConfig): Promise<{ success: boolean; company: TallyCompanyRow; message: string }> {
    const client = getTallyClient(config);
    const rawCompany = await client.getCompanyDetails(config);

    if (!rawCompany || !rawCompany.name) {
      throw new Error('Failed to retrieve valid company details from Tally');
    }

    const now = new Date().toISOString();

    const company = await db.transaction((state) => {
      let existing = state.tally_companies.find(
        (c) => c.tally_guid === rawCompany.tally_guid || c.name.toLowerCase() === rawCompany.name.toLowerCase()
      );

      if (existing) {
        existing.name = rawCompany.name;
        existing.mailing_name = rawCompany.mailing_name;
        existing.address = rawCompany.address || existing.address;
        existing.state = rawCompany.state || existing.state;
        existing.country = rawCompany.country || existing.country;
        existing.pincode = rawCompany.pincode || existing.pincode;
        existing.phone = rawCompany.phone || existing.phone;
        existing.email = rawCompany.email || existing.email;
        existing.website = rawCompany.website || existing.website;
        existing.financial_year_start = rawCompany.financial_year_start || existing.financial_year_start;
        existing.books_start = rawCompany.books_start || existing.books_start;
        existing.currency = rawCompany.currency || existing.currency;
        existing.gstin = rawCompany.gstin || existing.gstin;
        existing.pan = rawCompany.pan || existing.pan;
        existing.tally_version = rawCompany.tally_version || existing.tally_version;
        existing.last_synced_at = now;
      } else {
        existing = {
          id: `comp-${Date.now()}`,
          tally_guid: rawCompany.tally_guid || `tally-comp-${Date.now()}`,
          name: rawCompany.name,
          mailing_name: rawCompany.mailing_name || rawCompany.name,
          address: rawCompany.address,
          state: rawCompany.state,
          country: rawCompany.country || 'India',
          pincode: rawCompany.pincode,
          phone: rawCompany.phone,
          email: rawCompany.email,
          website: rawCompany.website,
          financial_year_start: rawCompany.financial_year_start,
          books_start: rawCompany.books_start,
          currency: rawCompany.currency || 'INR',
          gstin: rawCompany.gstin,
          pan: rawCompany.pan,
          tally_version: rawCompany.tally_version || 'TallyPrime Server Release 4.1',
          last_synced_at: now,
        };
        state.tally_companies.unshift(existing);
      }

      // Update settings with latest company name
      state.settings.tally_company_name = existing.name;

      // Log sync history
      const log: SyncHistoryLogRow = {
        id: `synclog-${Date.now()}`,
        sync_type: 'COMPANY',
        mode: 'FULL',
        company_name: existing.name,
        started_at: now,
        completed_at: new Date().toISOString(),
        status: 'SUCCESS',
        records_processed: 1,
        records_created: 1,
        records_updated: 0,
        records_skipped: 0,
        records_failed: 0,
        details: { companyName: existing.name, gstin: existing.gstin },
      };
      state.sync_history_logs.unshift(log);

      return existing;
    });

    return {
      success: true,
      company,
      message: `Company "${company.name}" synchronized successfully.`,
    };
  }

  /**
   * Synchronize Inventory Masters (Stock Items, Stock Groups, Units, Godowns)
   */
  public async syncInventoryMasters(
    config: TallyConnectionConfig,
    options?: TallyQueryOptions
  ): Promise<{
    success: boolean;
    itemsProcessed: number;
    itemsCreated: number;
    itemsUpdated: number;
    itemsSkipped: number;
    groupsSynced: number;
    unitsSynced: number;
    godownsSynced: number;
    message: string;
  }> {
    const startTime = new Date().toISOString();
    const client = getTallyClient(config);

    // Fetch items, groups, units, godowns concurrently
    const [rawItems, rawGroups, rawUnits, rawGodowns] = await Promise.all([
      client.getStockItems(config, options),
      client.getStockGroups(config),
      client.getUnits(config),
      client.getGodowns(config),
    ]);

    const result = await db.transaction((state) => {
      const now = new Date().toISOString();
      let itemsCreated = 0;
      let itemsUpdated = 0;
      let itemsSkipped = 0;

      // 1. Sync Stock Groups
      for (const g of rawGroups) {
        let existing = state.tally_stock_groups.find(
          (x) => x.tally_guid === g.tally_guid || x.name.toLowerCase() === g.name.toLowerCase()
        );
        if (existing) {
          existing.name = g.name;
          existing.parent_group = g.parent_group;
          existing.hierarchy_path = g.hierarchy_path || g.name;
          existing.last_synced_at = now;
        } else {
          state.tally_stock_groups.push({
            id: `grp-${Date.now()}-${Math.random().toString().slice(2, 6)}`,
            tally_guid: g.tally_guid || `grp-${Date.now()}`,
            name: g.name,
            parent_group: g.parent_group,
            hierarchy_path: g.hierarchy_path || g.name,
            is_active: true,
            last_synced_at: now,
          });
        }

        // Also ensure a corresponding app category exists
        let cat = state.categories.find((c) => c.name.toLowerCase() === g.name.toLowerCase());
        if (!cat) {
          state.categories.push({
            id: `cat-${Date.now()}-${Math.random().toString().slice(2, 6)}`,
            name: g.name,
            description: `Tally Stock Group: ${g.name}`,
            is_active: true,
            created_at: now,
            updated_at: now,
          });
        }
      }

      // 2. Sync Units
      for (const u of rawUnits) {
        let existing = state.tally_units.find(
          (x) => x.symbol.toLowerCase() === (u.symbol || u.name).toLowerCase()
        );
        if (existing) {
          existing.name = u.name;
          existing.formal_name = u.formal_name;
          existing.decimal_places = u.decimal_places || 0;
          existing.last_synced_at = now;
        } else {
          state.tally_units.push({
            id: `unit-${Date.now()}-${Math.random().toString().slice(2, 6)}`,
            name: u.name,
            symbol: u.symbol || u.name,
            formal_name: u.formal_name || u.name,
            decimal_places: u.decimal_places || 0,
            last_synced_at: now,
          });
        }
      }

      // 3. Sync Godowns (Warehouses)
      for (const gd of rawGodowns) {
        let existing = state.tally_godowns.find(
          (x) => x.tally_guid === gd.tally_guid || x.name.toLowerCase() === gd.name.toLowerCase()
        );
        if (existing) {
          existing.name = gd.name;
          existing.parent_godown = gd.parent_godown;
          existing.address = gd.address || existing.address;
          existing.last_synced_at = now;
        } else {
          state.tally_godowns.push({
            id: `gdn-${Date.now()}-${Math.random().toString().slice(2, 6)}`,
            tally_guid: gd.tally_guid || `gdn-${Date.now()}`,
            name: gd.name,
            parent_godown: gd.parent_godown,
            address: gd.address,
            is_primary: state.tally_godowns.length === 0,
            total_items: 0,
            total_stock_value: 0,
            last_synced_at: now,
          });
        }
      }

      // 4. Sync Stock Items (with Idempotency & SKU / Name matching)
      for (const item of rawItems) {
        const itemSku = (item.sku || item.alias || item.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)).toUpperCase();
        
        // Find existing product by Tally GUID, SKU, or Exact Name
        let prod = state.products.find(
          (p) =>
            (item.tally_guid && p.tally_guid === item.tally_guid) ||
            p.sku.toUpperCase() === itemSku ||
            p.name.toLowerCase() === item.name.toLowerCase()
        );

        // Find or associate category
        let category = state.categories.find(
          (c) => c.name.toLowerCase() === (item.stock_group || item.category || '').toLowerCase()
        ) || state.categories[0];

        if (!category) {
          category = {
            id: `cat-${Date.now()}`,
            name: item.stock_group || 'General',
            description: 'General inventory category',
            is_active: true,
            created_at: now,
            updated_at: now,
          };
          state.categories.push(category);
        }

        if (prod) {
          // Idempotent Update
          const prevCost = prod.unit_cost;
          const prevStock = prod.current_stock;

          prod.name = item.name;
          prod.tally_guid = item.tally_guid || prod.tally_guid;
          prod.stock_group = item.stock_group || prod.stock_group;
          prod.unit = item.unit || prod.unit;
          prod.description = item.description || prod.description;
          if (item.unit_cost > 0) prod.unit_cost = item.unit_cost;
          if (item.standard_selling_price > 0) prod.standard_selling_price = item.standard_selling_price;
          if (item.valuation_method) prod.valuation_method = item.valuation_method;
          prod.last_synced_at = now;
          prod.updated_at = now;

          // Record if stock has changed from Tally
          if (item.current_stock !== undefined && item.current_stock !== prevStock) {
            prod.current_stock = item.current_stock;
          }

          itemsUpdated++;
        } else {
          // Create New Product
          const newProd: ProductRow = {
            id: `prod-${Date.now()}-${Math.random().toString().slice(2, 6)}`,
            sku: itemSku,
            name: item.name,
            category_id: category.id,
            description: item.description || `Synchronized from Tally: ${item.name}`,
            unit: item.unit || 'PCS',
            current_stock: item.current_stock || 0,
            reserved_stock: 0,
            minimum_stock: 10,
            critical_stock: 5,
            unit_cost: item.unit_cost || 0,
            standard_selling_price: item.standard_selling_price || Math.round((item.unit_cost || 100) * 1.25),
            valuation_method: item.valuation_method || 'Avg Cost',
            stock_group: item.stock_group,
            tally_guid: item.tally_guid,
            last_synced_at: now,
            is_active: true,
            created_at: now,
            updated_at: now,
          };
          state.products.unshift(newProd);
          itemsCreated++;
        }

        // Maintain Product Mapping entry
        let mapping = state.tally_product_mappings.find(
          (m) =>
            m.tally_stock_item_name.toLowerCase() === item.name.toLowerCase() ||
            (m.product_sku && m.product_sku.toUpperCase() === itemSku)
        );

        if (mapping) {
          mapping.tally_stock_item_name = item.name;
          mapping.tally_stock_item_id = item.tally_guid || mapping.tally_stock_item_id;
          mapping.mapping_status = 'MAPPED';
          mapping.updated_at = now;
        } else {
          state.tally_product_mappings.push({
            id: `map-${Date.now()}-${Math.random().toString().slice(2, 6)}`,
            product_id: prod?.id || `prod-map-${itemSku}`,
            product_sku: itemSku,
            product_name: item.name,
            tally_stock_item_id: item.tally_guid || `TALLY-${itemSku}`,
            tally_stock_item_name: item.name,
            tally_alias: item.alias || itemSku,
            mapping_status: 'MAPPED',
            auto_matched: true,
            created_at: now,
            updated_at: now,
          });
        }
      }

      // Log sync history
      const totalProcessed = rawItems.length;
      const log: SyncHistoryLogRow = {
        id: `synclog-${Date.now()}`,
        sync_type: 'INVENTORY',
        mode: 'FULL',
        company_name: state.settings.tally_company_name,
        started_at: startTime,
        completed_at: new Date().toISOString(),
        status: 'SUCCESS',
        records_processed: totalProcessed,
        records_created: itemsCreated,
        records_updated: itemsUpdated,
        records_skipped: itemsSkipped,
        records_failed: 0,
        details: {
          itemsCreated,
          itemsUpdated,
          groupsSynced: rawGroups.length,
          unitsSynced: rawUnits.length,
          godownsSynced: rawGodowns.length,
        },
      };
      state.sync_history_logs.unshift(log);

      return {
        itemsProcessed: totalProcessed,
        itemsCreated,
        itemsUpdated,
        itemsSkipped,
        groupsSynced: rawGroups.length,
        unitsSynced: rawUnits.length,
        godownsSynced: rawGodowns.length,
      };
    });

    return {
      success: true,
      ...result,
      message: `Inventory Master sync completed: ${result.itemsCreated} created, ${result.itemsUpdated} updated (${result.groupsSynced} groups, ${result.unitsSynced} units, ${result.godownsSynced} godowns).`,
    };
  }
}

export const masterSyncService = new MasterSyncService();
