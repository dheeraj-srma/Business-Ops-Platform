import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PDFOrderExportData {
  order_id: string;
  timestamp?: string;
  salesman_name?: string;
  salesman_id?: string;
  shop_name?: string;
  city?: string;
  state?: string;
  location_id?: string;
  status?: string;
  processed_by?: string;
  items: Array<{
    category?: string;
    item_name: string;
    sku?: string;
    quantity: number;
    price: number;
    total_price: number;
  }>;
}

function formatCurrency(amount: number): string {
  const fixed = (amount || 0).toFixed(2);
  const parts = fixed.split('.');
  const intPart = parts[0];
  const decPart = parts[1];
  const lastThree = intPart.slice(-3);
  const otherNumbers = intPart.slice(0, -3);
  const formattedInt = otherNumbers !== '' ? otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree : lastThree;
  return `Rs. ${formattedInt}.${decPart}`;
}

export function generateOrderPDF(order: PDFOrderExportData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Dark Theme Palette: Deep Slate & Cyan Header Accent
  const cyanHeader: [number, number, number] = [6, 182, 212];
  const darkSlate: [number, number, number] = [15, 23, 42];
  const lightBg: [number, number, number] = [248, 250, 252];
  const textDark: [number, number, number] = [30, 41, 59];

  // 1. Header Banner Background
  doc.setFillColor(...darkSlate);
  doc.rect(0, 0, pageWidth, 42, 'F');

  // Cyan Accent Strip
  doc.setFillColor(...cyanHeader);
  doc.rect(0, 40, pageWidth, 2, 'F');

  // Nalka Metals Branding
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('NALKA METALS', 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text('OFFICIAL SALES & OUTWARD ORDER INVOICE', 14, 25);
  doc.text('Warehouse Stock Management & Outward Dispatch', 14, 30);

  // Invoice Number Badge Header Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(6, 182, 212);
  doc.text(`INVOICE: ${order.order_id}`, pageWidth - 14, 18, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(`Date: ${order.timestamp || new Date().toLocaleString()}`, pageWidth - 14, 25, { align: 'right' });
  doc.text(`Status: ${(order.status || 'CONFIRMED').toUpperCase()}`, pageWidth - 14, 31, { align: 'right' });

  // 2. Metadata Information Cards
  doc.setFillColor(...lightBg);
  doc.roundedRect(14, 48, (pageWidth - 34) / 2, 34, 2, 2, 'F');
  doc.roundedRect(14 + (pageWidth - 34) / 2 + 6, 48, (pageWidth - 34) / 2, 34, 2, 2, 'F');

  // Left Card: Salesman & Dealer Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...textDark);
  doc.text('ORDER & DEALER DETAILS', 18, 55);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Salesman Name: ${order.salesman_name || 'N/A'}`, 18, 62);
  doc.text(`Salesman ID: ${order.salesman_id || 'SLS-101'}`, 18, 67);
  doc.text(`Shop / Customer: ${order.shop_name || 'Direct'}`, 18, 72);

  // Right Card: Location & Dispatch Details
  const rightColX = 14 + (pageWidth - 34) / 2 + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...textDark);
  doc.text('LOCATION & DISPATCH DETAILS', rightColX, 55);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`City: ${order.city || 'N/A'}`, rightColX, 62);
  doc.text(`State: ${order.state || 'N/A'}`, rightColX, 67);
  doc.text(`Approved By: ${order.processed_by || 'Warehouse Manager'}`, rightColX, 72);

  // 3. Line Items Table
  const tableData = order.items.map((item, idx) => [
    (idx + 1).toString(),
    item.category || 'General',
    item.item_name,
    item.sku || '-',
    item.quantity.toString(),
    formatCurrency(item.price || 0),
    formatCurrency(item.total_price || (item.price || 0) * item.quantity),
  ]);

  const grandTotal = order.items.reduce((acc, item) => acc + (item.total_price || (item.price || 0) * item.quantity), 0);
  const totalQty = order.items.reduce((acc, item) => acc + item.quantity, 0);

  autoTable(doc, {
    startY: 90,
    head: [['#', 'Category', 'Product Description', 'SKU', 'Qty', 'Unit Price', 'Total Amount']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: darkSlate,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [51, 65, 85],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { cellWidth: 32 },
      2: { cellWidth: 52 },
      3: { cellWidth: 24 },
      4: { halign: 'center', cellWidth: 12 },
      5: { halign: 'right', cellWidth: 26 },
      6: { halign: 'right', cellWidth: 28 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
  });

  // 4. Summary & Authorization Block
  const docWithAutoTable = doc as unknown as { lastAutoTable?: { finalY: number } };
  const finalY = docWithAutoTable.lastAutoTable ? docWithAutoTable.lastAutoTable.finalY + 10 : 150;

  const summaryBoxWidth = 85;
  const summaryBoxX = pageWidth - 14 - summaryBoxWidth;

  doc.setFillColor(...lightBg);
  doc.roundedRect(summaryBoxX, finalY, summaryBoxWidth, 32, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(summaryBoxX, finalY, summaryBoxWidth, 32, 2, 2, 'S');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Total Quantity:`, summaryBoxX + 6, finalY + 10);
  doc.text(`${totalQty} units`, summaryBoxX + summaryBoxWidth - 6, finalY + 10, { align: 'right' });

  doc.text(`Subtotal:`, summaryBoxX + 6, finalY + 17);
  doc.text(formatCurrency(grandTotal), summaryBoxX + summaryBoxWidth - 6, finalY + 17, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...darkSlate);
  doc.text(`Grand Total:`, summaryBoxX + 6, finalY + 26);
  doc.setTextColor(6, 182, 212);
  doc.text(formatCurrency(grandTotal), summaryBoxX + summaryBoxWidth - 6, finalY + 26, { align: 'right' });

  // Signature Block
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Warehouse Manager Authorization', 14, finalY + 22);
  doc.line(14, finalY + 17, 75, finalY + 17);

  // Footer text
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Thank you for your business with Nalka Metals! Official outward order document.', pageWidth / 2, 285, { align: 'center' });

  // Save PDF
  const filename = `Nalka_Metals_Invoice_${order.order_id}.pdf`;
  doc.save(filename);
}
