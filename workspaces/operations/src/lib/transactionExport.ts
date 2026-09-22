import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportableTransactionItem {
  id: string;
  sku: string;
  productName: string;
  categoryName?: string;
  quantity: number;
  unit: string;
  previousStock?: number;
  newStock?: number;
  reason?: string;
  notes?: string;
}

export interface ExportableConsignment {
  groupId?: string;
  title?: string;
  referenceNumber: string;
  type: 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT' | string;
  partyName: string; // Supplier or Salesman / Customer
  partyRole?: string; // 'Supplier / Vendor', 'Salesman', 'Recipient'
  date: string;
  loggedBy?: string;
  notes?: string;
  items: ExportableTransactionItem[];
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
}

/**
 * Triggers browser download of a blob file
 */
function downloadBlob(content: BlobPart, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 1. Export Consignment / Transaction to Excel (SpreadsheetML XML format)
 */
export function exportConsignmentToExcel(consignment: ExportableConsignment) {
  const isStockIn = consignment.type === 'STOCK_IN';
  const typeLabel = isStockIn ? 'Stock Inward Receipt' : consignment.type === 'STOCK_OUT' ? 'Stock Issue Note' : 'Stock Adjustment';
  const partyLabel = consignment.partyRole || (isStockIn ? 'Supplier / Vendor' : 'Customer / Salesman');

  const escapeXml = (str: any) =>
    String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const totalQuantity = consignment.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
  const formattedDate = new Date(consignment.date).toLocaleString('en-IN');

  const itemRows = consignment.items
    .map((item, idx) => {
      const prev = item.previousStock !== undefined ? item.previousStock : '-';
      const change = (isStockIn ? '+' : '-') + item.quantity;
      const finalBal = item.newStock !== undefined ? item.newStock : '-';

      return `<Row>
        <Cell><Data ss:Type="Number">${idx + 1}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(item.sku)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(item.productName)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(item.categoryName || '-')}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(item.unit)}</Data></Cell>
        <Cell><Data ss:Type="${typeof prev === 'number' ? 'Number' : 'String'}">${prev}</Data></Cell>
        <Cell ss:StyleID="${isStockIn ? 'PositiveQty' : 'NegativeQty'}"><Data ss:Type="String">${change}</Data></Cell>
        <Cell><Data ss:Type="${typeof finalBal === 'number' ? 'Number' : 'String'}">${finalBal}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(item.notes || '-')}</Data></Cell>
      </Row>`;
    })
    .join('\n');

  const excelXml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#0F172A"/>
  </Style>
  <Style ss:ID="MetaLabel">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#475569"/>
  </Style>
  <Style ss:ID="MetaValue">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#0F172A"/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="PositiveQty">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#16A34A"/>
  </Style>
  <Style ss:ID="NegativeQty">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#DC2626"/>
  </Style>
  <Style ss:ID="SummaryRow">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Transaction Receipt">
  <Table ss:DefaultColumnWidth="120">
   <Column ss:Width="40"/>
   <Column ss:Width="90"/>
   <Column ss:Width="200"/>
   <Column ss:Width="110"/>
   <Column ss:Width="70"/>
   <Column ss:Width="80"/>
   <Column ss:Width="90"/>
   <Column ss:Width="90"/>
   <Column ss:Width="150"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="Title"><Data ss:Type="String">${escapeXml(typeLabel)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Reference No:</Data></Cell>
    <Cell ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(consignment.referenceNumber)}</Data></Cell>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">${escapeXml(partyLabel)}:</Data></Cell>
    <Cell ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(consignment.partyName)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Date &amp; Time:</Data></Cell>
    <Cell ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(formattedDate)}</Data></Cell>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Logged By:</Data></Cell>
    <Cell ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(consignment.loggedBy || 'System')}</Data></Cell>
   </Row>
   ${consignment.notes ? `
   <Row>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Remarks:</Data></Cell>
    <Cell ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(consignment.notes)}</Data></Cell>
   </Row>` : ''}
   <Row ss:Height="10"/>
   <Row ss:Height="20">
    <Cell ss:StyleID="Header"><Data ss:Type="String">#</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">SKU</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Product Name</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Category</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Unit</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Prev Stock</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Qty Moved</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Balance</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Notes</Data></Cell>
   </Row>
   ${itemRows}
   <Row ss:StyleID="SummaryRow">
    <Cell><Data ss:Type="String">Total</Data></Cell>
    <Cell><Data ss:Type="String">${consignment.items.length} Items</Data></Cell>
    <Cell><Data ss:Type="String"></Data></Cell>
    <Cell><Data ss:Type="String"></Data></Cell>
    <Cell><Data ss:Type="String"></Data></Cell>
    <Cell><Data ss:Type="String"></Data></Cell>
    <Cell ss:StyleID="${isStockIn ? 'PositiveQty' : 'NegativeQty'}"><Data ss:Type="String">${isStockIn ? '+' : '-'}${totalQuantity}</Data></Cell>
    <Cell><Data ss:Type="String"></Data></Cell>
    <Cell><Data ss:Type="String"></Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

  const filename = `transaction_${sanitizeFilename(consignment.referenceNumber)}_${Date.now()}.xlsx`;
  downloadBlob(excelXml, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

/**
 * 2. Export Consignment / Transaction to JSON (.json)
 */
export function exportConsignmentToJson(consignment: ExportableConsignment) {
  const exportPayload = {
    receiptType: consignment.type,
    referenceNumber: consignment.referenceNumber,
    partyName: consignment.partyName,
    partyRole: consignment.partyRole || (consignment.type === 'STOCK_IN' ? 'Supplier' : 'Recipient'),
    date: consignment.date,
    loggedBy: consignment.loggedBy || 'Store Manager',
    notes: consignment.notes || '',
    totalItems: consignment.items.length,
    totalQuantity: consignment.items.reduce((sum, it) => sum + (it.quantity || 0), 0),
    items: consignment.items.map((item) => ({
      id: item.id,
      sku: item.sku,
      productName: item.productName,
      category: item.categoryName || 'General',
      quantity: item.quantity,
      unit: item.unit,
      previousStock: item.previousStock,
      newStock: item.newStock,
      notes: item.notes || '',
    })),
    exportedAt: new Date().toISOString(),
  };

  const jsonContent = JSON.stringify(exportPayload, null, 2);
  const filename = `transaction_${sanitizeFilename(consignment.referenceNumber)}_${Date.now()}.json`;
  downloadBlob(jsonContent, filename, 'application/json');
}

/**
 * 3. Export Consignment / Transaction to CSV (.csv)
 */
export function exportConsignmentToCsv(consignment: ExportableConsignment) {
  const isStockIn = consignment.type === 'STOCK_IN';
  const partyLabel = consignment.partyRole || (isStockIn ? 'Supplier' : 'Party');

  const escapeCsv = (str: any) => {
    const val = String(str ?? '');
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const headers = [
    'Reference Number',
    'Transaction Type',
    partyLabel,
    'Date',
    'SKU',
    'Product Name',
    'Category',
    'Unit',
    'Previous Stock',
    'Quantity Moved',
    'New Balance',
    'Notes',
    'Logged By',
  ];

  const rows = consignment.items.map((it) => [
    escapeCsv(consignment.referenceNumber),
    escapeCsv(consignment.type),
    escapeCsv(consignment.partyName),
    escapeCsv(consignment.date),
    escapeCsv(it.sku),
    escapeCsv(it.productName),
    escapeCsv(it.categoryName || 'General'),
    escapeCsv(it.unit),
    it.previousStock !== undefined ? it.previousStock : '',
    `${isStockIn ? '+' : '-'}${it.quantity}`,
    it.newStock !== undefined ? it.newStock : '',
    escapeCsv(it.notes || consignment.notes || ''),
    escapeCsv(consignment.loggedBy || ''),
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const filename = `transaction_${sanitizeFilename(consignment.referenceNumber)}_${Date.now()}.csv`;
  downloadBlob(csvContent, filename, 'text/csv;charset=utf-8;');
}

/**
 * 4. Export Consignment / Transaction to PDF (.pdf)
 */
export function exportConsignmentToPdf(consignment: ExportableConsignment) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const isStockIn = consignment.type === 'STOCK_IN';
  const titleText = isStockIn
    ? 'GOODS RECEIPT NOTE (STOCK-IN)'
    : consignment.type === 'STOCK_OUT'
    ? 'STOCK DISPATCH NOTE (STOCK-OUT)'
    : 'INVENTORY ADJUSTMENT VOUCHER';

  const partyLabel = consignment.partyRole || (isStockIn ? 'Supplier / Vendor' : 'Customer / Salesman');
  const totalQuantity = consignment.items.reduce((sum, it) => sum + (it.quantity || 0), 0);

  // Top Header Banner
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(0, 0, 210, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(titleText, 14, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 196, 16, { align: 'right' });

  // Metadata Box
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);

  let y = 35;
  doc.setFont('helvetica', 'bold');
  doc.text('Reference No:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(consignment.referenceNumber, 44, y);

  doc.setFont('helvetica', 'bold');
  doc.text(`${partyLabel}:`, 110, y);
  doc.setFont('helvetica', 'normal');
  doc.text(consignment.partyName, 145, y);

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Date & Time:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(consignment.date).toLocaleString('en-IN'), 44, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Logged By:', 110, y);
  doc.setFont('helvetica', 'normal');
  doc.text(consignment.loggedBy || 'Store Manager', 145, y);

  if (consignment.notes) {
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Remarks:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(consignment.notes, 44, y);
  }

  y += 6;

  // Table using jspdf-autotable
  const tableData = consignment.items.map((it, idx) => [
    idx + 1,
    it.sku,
    it.productName,
    it.categoryName || 'General',
    it.previousStock !== undefined ? String(it.previousStock) : '-',
    `${isStockIn ? '+' : '-'}${it.quantity} ${it.unit}`,
    it.newStock !== undefined ? String(it.newStock) : '-',
  ]);

  autoTable(doc, {
    startY: y + 2,
    head: [['#', 'SKU', 'Product Name', 'Category', 'Prev Stock', 'Qty Moved', 'Final Balance']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 25 },
      2: { cellWidth: 55 },
      3: { cellWidth: 30 },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 22, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
    foot: [
      [
        'Total',
        '',
        `${consignment.items.length} distinct item(s)`,
        '',
        '',
        `${isStockIn ? '+' : '-'}${totalQuantity} units`,
        '',
      ],
    ],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 8,
      fontStyle: 'bold',
    },
  });

  // Footer Signatures
  const finalY = (doc as any).lastAutoTable.finalY + 25;
  if (finalY < 270) {
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.line(14, finalY, 70, finalY);
    doc.text('Authorized Store Incharge', 14, finalY + 4);

    doc.line(140, finalY, 196, finalY);
    doc.text('Received By / Verified Signature', 140, finalY + 4);
  }

  const filename = `transaction_${sanitizeFilename(consignment.referenceNumber)}_${Date.now()}.pdf`;
  doc.save(filename);
}
