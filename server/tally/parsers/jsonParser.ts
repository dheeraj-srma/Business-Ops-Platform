import { NormalizedTallyTransaction, NormalizedItem, ExternalTransactionType, InventoryActionType } from '../types';

export function parseTallyJsonPayload(payload: any): NormalizedTallyTransaction[] {
  const result: NormalizedTallyTransaction[] = [];
  if (!payload) return result;

  // Handle single voucher or array of vouchers or envelope
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.vouchers)
    ? payload.vouchers
    : Array.isArray(payload.data)
    ? payload.data
    : [payload];

  for (const v of list) {
    if (!v) continue;

    const voucherType = v.voucher_type || v.voucherType || v.VOUCHERTYPENAME || 'Sales Invoice';
    const voucherNumber = v.voucher_number || v.voucherNumber || v.external_id || v.id || v.VOUCHERNUMBER || `VCH-${Date.now()}`;
    const guid = v.guid || v.GUID;
    const partyName = v.party_name || v.partyName || v.customer_name || v.supplier_name || v.PARTYLEDGERNAME || 'General Party';
    const rawDate = v.date || v.voucher_date || new Date().toISOString().slice(0, 10);
    const isCancelled = Boolean(v.is_cancelled || v.cancelled || v.ISCANCELLED === 'Yes');
    const isModified = Boolean(v.is_modified || v.modified);
    const narration = v.narration || v.notes || '';
    const orderRef = v.reference_order_id || v.order_id || v.sales_order_number || v.referenceNumber;

    // Determine normalized types
    const lowerVType = voucherType.toLowerCase();
    let normalizedType: ExternalTransactionType = 'SALES_INVOICE';
    let actionType: InventoryActionType = 'REDUCE_STOCK_FULFILL_RESERVATION';

    if (lowerVType.includes('order')) {
      normalizedType = 'SALES_ORDER';
      actionType = 'RESERVE_STOCK';
    } else if (lowerVType.includes('delivery note') || lowerVType.includes('dispatch')) {
      normalizedType = 'DELIVERY_NOTE';
      actionType = 'REDUCE_STOCK_FULFILL_RESERVATION';
    } else if (lowerVType.includes('purchase return') || lowerVType.includes('debit note')) {
      normalizedType = 'PURCHASE_RETURN';
      actionType = 'DECREASE_STOCK';
    } else if (lowerVType.includes('sales return') || lowerVType.includes('credit note')) {
      normalizedType = 'SALES_RETURN';
      actionType = 'INCREASE_STOCK';
    } else if (lowerVType.includes('purchase') || lowerVType.includes('grn') || lowerVType.includes('receipt')) {
      normalizedType = 'PURCHASE_INVOICE';
      actionType = 'INCREASE_STOCK';
    } else if (lowerVType.includes('journal') || lowerVType.includes('transfer')) {
      normalizedType = 'STOCK_JOURNAL';
      actionType = 'INCREASE_STOCK';
    }

    const rawItems = v.items || v.inventory || v.stock_items || v.inventory_entries || [];
    const items: NormalizedItem[] = [];

    for (const item of rawItems) {
      const name = item.product_name || item.name || item.stock_item_name || item.STOCKITEMNAME;
      if (!name && !item.sku && !item.product_sku) continue;

      const qty = Math.abs(parseFloat(item.quantity || item.qty || item.actual_qty || item.billed_qty || '1') || 1);
      const rate = parseFloat(item.rate || item.unit_cost || item.price || '0') || 0;
      const amount = parseFloat(item.amount || '0') || qty * rate;

      items.push({
        external_product_id: item.external_product_id || item.guid,
        product_sku: item.sku || item.product_sku || item.part_no,
        product_name: name || item.sku || 'Unknown Item',
        alias: item.alias || item.item_alias,
        quantity: qty,
        rate,
        amount,
        unit: item.unit || 'PCS',
      });
    }

    if (items.length > 0) {
      result.push({
        external_id: String(voucherNumber),
        guid,
        voucher_number: String(voucherNumber),
        voucher_type: voucherType,
        normalized_type: normalizedType,
        action_type: actionType,
        party_name: partyName,
        date: rawDate,
        items,
        reference_order_id: orderRef ? String(orderRef) : undefined,
        narration,
        is_cancelled: isCancelled,
        is_modified: isModified,
        source: 'TALLY',
        raw_payload: JSON.stringify(v),
      });
    }
  }

  return result;
}
