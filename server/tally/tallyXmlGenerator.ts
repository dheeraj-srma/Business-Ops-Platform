import { TallyStockItemModel } from './tallyMapper';

function escapeXml(unsafe: string | number): string {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generateTallyXml(
  items: TallyStockItemModel[],
  companyName: string = 'Apex Industrial Solutions (2026-27)'
): string {
  const stockGroupSet = new Set<string>();
  const unitSet = new Set<string>();
  items.forEach((item) => {
    if (item.stockGroup) stockGroupSet.add(item.stockGroup);
    if (item.baseUnits) unitSet.add(item.baseUnits);
  });

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

  let xml = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
`;

  // 1. Units of Measurement Masters
  for (const unit of Array.from(unitSet)) {
    xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <UNIT NAME="${escapeXml(unit)}" ACTION="Create">
            <NAME>${escapeXml(unit)}</NAME>
            <ISSIMPLEUNIT>Yes</ISSIMPLEUNIT>
          </UNIT>
        </TALLYMESSAGE>\n`;
  }

  // 2. Stock Groups (Categories)
  for (const group of Array.from(stockGroupSet)) {
    if (group !== 'Primary') {
      xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKGROUP NAME="${escapeXml(group)}" ACTION="Create">
            <NAME>${escapeXml(group)}</NAME>
            <PARENT>Primary</PARENT>
            <ISADDABLE>Yes</ISADDABLE>
          </STOCKGROUP>
        </TALLYMESSAGE>\n`;
    }
  }

  // 3. Stock Items with Master details, SKU part number, and Opening Balance/Valuation
  for (const item of items) {
    xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKITEM NAME="${escapeXml(item.name)}" ACTION="Create">
            <GUID>${escapeXml(item.guid)}</GUID>
            <NAME>${escapeXml(item.name)}</NAME>
            <PARTNO>${escapeXml(item.partNo)}</PARTNO>
            <PARENT>${escapeXml(item.stockGroup)}</PARENT>
            <BASEUNITS>${escapeXml(item.baseUnits)}</BASEUNITS>
            <DESCRIPTION>${escapeXml(item.description)}</DESCRIPTION>
            <ISBATCHWISEON>No</ISBATCHWISEON>
            <ISPERISHABLEON>No</ISPERISHABLEON>
            <OPENINGBALANCE>${escapeXml(item.openingBalance)}</OPENINGBALANCE>
            <OPENINGRATE>${item.openingRate > 0 ? `${item.openingRate}/${escapeXml(item.baseUnits)}` : '0'}</OPENINGRATE>
            <OPENINGVALUE>${item.openingValue >= 0 ? `-${item.openingValue.toFixed(2)}` : `${Math.abs(item.openingValue).toFixed(2)}`}</OPENINGVALUE>
            <REORDERLEVEL>${item.reorderLevel}</REORDERLEVEL>
            <MINIMUMORDERQTY>${item.minimumLevel}</MINIMUMORDERQTY>
            <LANGUAGENAME.LIST>
              <NAME.LIST TYPE="String">
                <NAME>${escapeXml(item.name)}</NAME>
                <NAME>${escapeXml(item.partNo)}</NAME>
              </NAME.LIST>
              <LANGUAGEID>1033</LANGUAGEID>
            </LANGUAGENAME.LIST>
          </STOCKITEM>
        </TALLYMESSAGE>\n`;
  }

  xml += `      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  return xml;
}
