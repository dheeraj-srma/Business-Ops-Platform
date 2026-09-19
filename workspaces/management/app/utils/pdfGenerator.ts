import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PDFOrderItem {
  category?: string;
  sku?: string;
  item_name: string;
  quantity: number;
  price: number;
  total_price: number;
}

export interface PDFOrderData {
  order_id: string;
  timestamp: string;
  salesman_id?: string;
  salesman_name: string;
  shop_name: string;
  location_id?: string;
  city?: string;
  state?: string;
  status?: string;
  items: PDFOrderItem[];
}

export function generateOrderPDF(order: PDFOrderData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Primary Colors (Cyan & Slate Dark Theme)
  const cyanHeader: [number, number, number] = [6, 182, 212];
  const darkSlate: [number, number, number] = [15, 23, 42];
  const lightBg: [number, number, number] = [248, 250, 252];
  const textDark: [number, number, number] = [30, 41, 59];

  // 1. Header Banner Background
  doc.setFillColor(...darkSlate);
  doc.rect(0, 0, pageWidth, 42, 'F');

  // Cyan Accent Strip under header
  doc.setFillColor(...cyanHeader);
  doc.rect(0, 40, pageWidth, 2, 'F');

  // Header Title & Logo text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('NALKA METALS', 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('OFFICIAL SALES & OUTWARD ORDER INVOICE', 14, 25);
  doc.text('Premium Hardware & Metal Supplies', 14, 30);

  // Invoice Number Badge in Header Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(6, 182, 212); // cyan accent
  doc.text(`INVOICE: ${order.order_id}`, pageWidth - 14, 18, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(`Date: ${order.timestamp || new Date().toLocaleString()}`, pageWidth - 14, 25, { align: 'right' });
  doc.text(`Status: ${(order.status || 'Pending').toUpperCase()}`, pageWidth - 14, 31, { align: 'right' });

  // 2. Metadata Grid Cards
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
  doc.text(`Salesman ID: ${order.salesman_id || 'SLS-001'}`, 18, 67);
  doc.text(`Shop / Customer: ${order.shop_name || 'Direct'}`, 18, 72);

  // Right Card: Location & Delivery Details
  const rightColX = 14 + (pageWidth - 34) / 2 + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...textDark);
  doc.text('LOCATION & DELIVERY', rightColX, 55);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`City: ${order.city || 'N/A'}`, rightColX, 62);
  doc.text(`State: ${order.state || 'N/A'}`, rightColX, 67);
  doc.text(`Location ID: ${order.location_id || 'LOC-001'}`, rightColX, 72);

  // 3. Line Items Table
  const tableData = order.items.map((item, idx) => [
    (idx + 1).toString(),
    item.category || 'General',
    item.item_name,
    item.sku || '-',
    item.quantity.toString(),
    `₹${(item.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    `₹${(item.total_price || (item.price || 0) * item.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
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
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 35 },
      2: { cellWidth: 55 },
      3: { cellWidth: 28 },
      4: { halign: 'center', cellWidth: 15 },
      5: { halign: 'right', cellWidth: 25 },
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

  // Total Summary Box
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
  doc.text(`₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, summaryBoxX + summaryBoxWidth - 6, finalY + 17, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...darkSlate);
  doc.text(`Grand Total:`, summaryBoxX + 6, finalY + 26);
  doc.setTextColor(6, 182, 212);
  doc.text(`₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, summaryBoxX + summaryBoxWidth - 6, finalY + 26, { align: 'right' });

  // Signature / Stamp section on left
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Authorized Salesman Signature', 14, finalY + 22);
  doc.line(14, finalY + 17, 75, finalY + 17); // line above signature

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Thank you for your business with Nalka Metals! This document serves as an official order receipt.', pageWidth / 2, 285, { align: 'center' });

  // Save / Download PDF file
  const filename = `Nalka_Metals_Invoice_${order.order_id}.pdf`;
  doc.save(filename);
}
