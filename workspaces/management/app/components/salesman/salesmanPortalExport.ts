import { generateOrderPDF, PDFOrderData, PDFOrderItem } from '../../utils/pdfGenerator';
import { OrderRecord } from '../../hooks/useRealtimeInventory';

export function exportOrderPDF(orderData: PDFOrderData) {
  return generateOrderPDF(orderData);
}

export function downloadOrderInvoice(
  orderId: string,
  submittedOrders: OrderRecord[],
  defaultSalesman: string,
  defaultShop: string,
  salesmanId: string,
  locationId: string,
  city: string,
  state: string
) {
  const itemsForOrder = submittedOrders.filter(o => o['Order ID'] === orderId);
  if (itemsForOrder.length === 0) return;

  const first = itemsForOrder[0];
  const pdfItems: PDFOrderItem[] = itemsForOrder.map(item => {
    const q = Number(item.Quantity || item.Qty) || 1;
    const p = Number(item.Price) || 0;
    return {
      category: item.Category || 'General',
      sku: item.SKU || '-',
      item_name: item['Item Name'] || 'Hardware Item',
      quantity: q,
      price: p,
      total_price: Number(item['Total Price']) || p * q,
    };
  });

  const pdfData: PDFOrderData = {
    order_id: orderId,
    timestamp: first.Timestamp || new Date().toLocaleString(),
    salesman_id: first['Salesman ID'] || salesmanId,
    salesman_name: first['Salesman Name'] || defaultSalesman,
    shop_name: first['Shop Name'] || defaultShop,
    location_id: first['Location ID'] || locationId,
    city: first.City || city,
    state: first.State || state,
    status: first.Status || 'Pending',
    items: pdfItems,
  };

  generateOrderPDF(pdfData);
}

export function exportOrdersJSON(orders: OrderRecord[], filename: string = 'sales_orders_export.json') {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(orders, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', filename);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
