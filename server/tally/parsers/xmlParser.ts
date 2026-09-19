import { NormalizedTallyTransaction, NormalizedItem, ExternalTransactionType, InventoryActionType } from '../types';

export function parseTallyXmlEnvelope(xmlString: string): NormalizedTallyTransaction[] {
  const transactions: NormalizedTallyTransaction[] = [];
  if (!xmlString || typeof xmlString !== 'string') return transactions;

  // Extract VOUCHER tags from XML
  const voucherRegex = /<VOUCHER[\s\S]*?<\/VOUCHER>/gi;
  const voucherMatches = xmlString.match(voucherRegex) || [];

  for (const vXml of voucherMatches) {
    try {
      const getTagValue = (tagName: string): string => {
        const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
        const match = vXml.match(regex);
        return match ? match[1].trim() : '';
      };

      const voucherType = getTagValue('VOUCHERTYPENAME') || getTagValue('VOUCHERTYPE') || 'Sales Invoice';
      const voucherNumber = getTagValue('VOUCHERNUMBER') || getTagValue('REFERENCE') || `VCH-${Date.now()}`;
      const guid = getTagValue('GUID') || `tally-guid-${Date.now()}`;
      const partyName = getTagValue('PARTYLEDGERNAME') || getTagValue('PARTYNAME') || getTagValue('BASICBUYERNAME') || 'Direct Party';
      const rawDate = getTagValue('DATE') || new Date().toISOString().slice(0, 10);
      const isCancelled = getTagValue('ISCANCELLED')?.toLowerCase() === 'yes' || getTagValue('ISCANCELLED') === '1';
      const narration = getTagValue('NARRATION') || '';
      const orderRef = getTagValue('BASICORDERREF') || getTagValue('REFERENCE') || undefined;

      // Classify Transaction Type
      const lowerVType = voucherType.toLowerCase();
      let normalizedType: ExternalTransactionType = 'SALES_INVOICE';
      let actionType: InventoryActionType = 'REDUCE_STOCK_FULFILL_RESERVATION';

      if (lowerVType.includes('sales order') || lowerVType.includes('order')) {
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
      } else if (lowerVType.includes('purchase') || lowerVType.includes('receipt note') || lowerVType.includes('grn')) {
        normalizedType = 'PURCHASE_INVOICE';
        actionType = 'INCREASE_STOCK';
      } else if (lowerVType.includes('stock journal') || lowerVType.includes('transfer')) {
        normalizedType = 'STOCK_JOURNAL';
        actionType = 'INCREASE_STOCK';
      }

      // Extract inventory entries: <ALLINVENTORYENTRIES.LIST> or <INVENTORYENTRIES.LIST>
      const invRegex = /<(?:ALLINVENTORYENTRIES|INVENTORYENTRIES)\.LIST[\s\S]*?<\/(?:ALLINVENTORYENTRIES|INVENTORYENTRIES)\.LIST>/gi;
      const invMatches = vXml.match(invRegex) || [];
      const items: NormalizedItem[] = [];

      for (const itemXml of invMatches) {
        const getItemTag = (tag: string): string => {
          const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
          const m = itemXml.match(r);
          return m ? m[1].trim() : '';
        };

        const itemName = getItemTag('STOCKITEMNAME');
        if (!itemName) continue;

        // Parse quantity (e.g. "-10.00 PCS" or "25.00 KGS")
        const rawQty = getItemTag('ACTUALQTY') || getItemTag('BILLEDQTY') || getItemTag('QTY') || '1';
        const qtyMatch = rawQty.match(/([-+]?[0-9]*\.?[0-9]+)/);
        const quantity = qtyMatch ? Math.abs(parseFloat(qtyMatch[1])) : 1;

        const rateStr = getItemTag('RATE');
        const rateMatch = rateStr.match(/([0-9]*\.?[0-9]+)/);
        const rate = rateMatch ? parseFloat(rateMatch[1]) : 0;

        const amountStr = getItemTag('AMOUNT');
        const amount = amountStr ? Math.abs(parseFloat(amountStr)) : 0;

        items.push({
          product_name: itemName,
          product_sku: getItemTag('PARTNO') || undefined,
          alias: getItemTag('ALIAS') || undefined,
          quantity,
          rate,
          amount,
          unit: rawQty.replace(/[-+]?[0-9]*\.?[0-9]+\s*/, '').trim() || 'PCS',
        });
      }

      if (items.length > 0) {
        transactions.push({
          external_id: voucherNumber,
          guid,
          voucher_number: voucherNumber,
          voucher_type: voucherType,
          normalized_type: normalizedType,
          action_type: actionType,
          party_name: partyName,
          date: rawDate.length === 8 ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}` : rawDate,
          items,
          reference_order_id: orderRef,
          narration,
          is_cancelled: isCancelled,
          source: 'TALLY',
          raw_payload: vXml,
        });
      }
    } catch (err) {
      console.error('Error parsing Tally XML voucher:', err);
    }
  }

  return transactions;
}
