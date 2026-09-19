export class TallyResponseParser {
  /**
   * Helper to extract text inside an XML tag
   */
  public static getTagValue(xmlFragment: string, tagName: string): string {
    if (!xmlFragment) return '';
    const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
    const match = xmlFragment.match(regex);
    return match ? match[1].trim() : '';
  }

  /**
   * Helper to extract numeric value from string (handling negative signs and units like "10.00 PCS")
   */
  public static parseNumeric(valStr: string): number {
    if (!valStr) return 0;
    const clean = valStr.replace(/,/g, '');
    const match = clean.match(/([-+]?[0-9]*\.?[0-9]+)/);
    if (!match) return 0;
    const num = parseFloat(match[1]);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Parse Company details XML
   */
  public static parseCompanyResponse(xml: string): any {
    if (!xml) return null;
    const companyBlock = xml.match(/<COMPANY[\s\S]*?<\/COMPANY>/i)?.[0] || xml;

    const name = this.getTagValue(companyBlock, 'NAME') || this.getTagValue(companyBlock, 'COMPANYNAME') || 'Tally Enterprise';
    const guid = this.getTagValue(companyBlock, 'GUID') || `tally-comp-${Date.now()}`;
    const mailingName = this.getTagValue(companyBlock, 'MAILINGNAME') || this.getTagValue(companyBlock, 'BASICCOMPANYFORMALNAME') || name;
    const address = this.getTagValue(companyBlock, 'ADDRESS') || this.getTagValue(companyBlock, 'BASICCOMPANYADDRESS') || '';
    const state = this.getTagValue(companyBlock, 'STATENAME') || '';
    const country = this.getTagValue(companyBlock, 'COUNTRYNAME') || 'India';
    const pincode = this.getTagValue(companyBlock, 'PINCODE') || '';
    const phone = this.getTagValue(companyBlock, 'PHONE') || '';
    const email = this.getTagValue(companyBlock, 'EMAIL') || '';
    const gstin = this.getTagValue(companyBlock, 'GSTIN') || this.getTagValue(companyBlock, 'PARTYGSTIN') || '';
    const pan = this.getTagValue(companyBlock, 'PAN') || this.getTagValue(companyBlock, 'INCOMETAXNUMBER') || '';
    const fyStart = this.getTagValue(companyBlock, 'STARTINGFROM') || '20260401';
    const booksStart = this.getTagValue(companyBlock, 'BOOKSFROM') || fyStart;
    const currency = this.getTagValue(companyBlock, 'CURRENCY') || 'INR';

    return {
      tally_guid: guid,
      name,
      mailing_name: mailingName,
      address,
      state,
      country,
      pincode,
      phone,
      email,
      gstin,
      pan,
      financial_year_start: fyStart.length === 8 ? `${fyStart.slice(0, 4)}-${fyStart.slice(4, 6)}-${fyStart.slice(6, 8)}` : fyStart,
      books_start: booksStart.length === 8 ? `${booksStart.slice(0, 4)}-${booksStart.slice(4, 6)}-${booksStart.slice(6, 8)}` : booksStart,
      currency,
      tally_version: 'TallyPrime Server Release 4.1',
    };
  }

  /**
   * Parse Stock Items XML
   */
  public static parseStockItemsResponse(xml: string): any[] {
    const items: any[] = [];
    if (!xml) return items;

    const itemMatches = xml.match(/<STOCKITEM[\s\S]*?<\/STOCKITEM>/gi) || [];

    for (const itemXml of itemMatches) {
      try {
        const name = this.getTagValue(itemXml, 'NAME');
        if (!name) continue;

        const guid = this.getTagValue(itemXml, 'GUID') || `item-${Date.now()}-${Math.random()}`;
        const parentGroup = this.getTagValue(itemXml, 'PARENT') || 'General';
        const category = this.getTagValue(itemXml, 'CATEGORY') || '';
        const baseUnits = this.getTagValue(itemXml, 'BASEUNITS') || 'PCS';
        const sku = this.getTagValue(itemXml, 'PARTNO') || this.getTagValue(itemXml, 'ALIAS') || '';
        const alias = this.getTagValue(itemXml, 'ALIAS') || '';
        const description = this.getTagValue(itemXml, 'DESCRIPTION') || '';

        const openingQty = this.parseNumeric(this.getTagValue(itemXml, 'OPENINGBALANCE'));
        const openingRate = this.parseNumeric(this.getTagValue(itemXml, 'OPENINGRATE'));
        const openingValue = this.parseNumeric(this.getTagValue(itemXml, 'OPENINGVALUE'));

        const closingQty = this.parseNumeric(this.getTagValue(itemXml, 'CLOSINGBALANCE'));
        const closingRate = this.parseNumeric(this.getTagValue(itemXml, 'CLOSINGRATE'));
        const closingValue = this.parseNumeric(this.getTagValue(itemXml, 'CLOSINGVALUE'));

        const standardCost = this.parseNumeric(this.getTagValue(itemXml, 'STANDARDCOST')) || (closingQty !== 0 ? Math.abs(closingValue / closingQty) : 0);
        const standardPrice = this.parseNumeric(this.getTagValue(itemXml, 'STANDARDPRICE')) || Math.round(standardCost * 1.25);
        const valuationMethod = this.getTagValue(itemXml, 'VALUATIONMETHOD') || 'Avg Cost';
        const godownName = this.getTagValue(itemXml, 'GODOWNNAME') || 'Main Central Godown';

        items.push({
          tally_guid: guid,
          name,
          sku: sku || alias || `TALLY-${name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase()}`,
          alias,
          stock_group: parentGroup,
          category,
          unit: baseUnits,
          current_stock: closingQty,
          opening_stock: openingQty,
          unit_cost: standardCost > 0 ? standardCost : closingRate > 0 ? closingRate : openingRate,
          standard_selling_price: standardPrice,
          valuation_method: valuationMethod,
          description,
          godown_name: godownName,
        });
      } catch (err) {
        console.error('Error parsing stock item XML chunk:', err);
      }
    }

    return items;
  }

  /**
   * Parse Stock Groups XML
   */
  public static parseStockGroupsResponse(xml: string): any[] {
    const groups: any[] = [];
    if (!xml) return groups;

    const matches = xml.match(/<STOCKGROUP[\s\S]*?<\/STOCKGROUP>/gi) || [];

    for (const groupXml of matches) {
      const name = this.getTagValue(groupXml, 'NAME');
      if (!name) continue;
      const guid = this.getTagValue(groupXml, 'GUID') || `grp-${Date.now()}`;
      const parentGroup = this.getTagValue(groupXml, 'PARENT') || '';

      groups.push({
        tally_guid: guid,
        name,
        parent_group: parentGroup,
        hierarchy_path: parentGroup ? `${parentGroup} > ${name}` : name,
      });
    }

    return groups;
  }

  /**
   * Parse Units XML
   */
  public static parseUnitsResponse(xml: string): any[] {
    const units: any[] = [];
    if (!xml) return units;

    const matches = xml.match(/<UNIT[\s\S]*?<\/UNIT>/gi) || [];

    for (const unitXml of matches) {
      const name = this.getTagValue(unitXml, 'NAME');
      if (!name) continue;
      const formalName = this.getTagValue(unitXml, 'ORIGINALNAME') || name;
      const decimalPlaces = parseInt(this.getTagValue(unitXml, 'DECIMALPLACES')) || 0;

      units.push({
        name,
        symbol: name,
        formal_name: formalName,
        decimal_places: decimalPlaces,
      });
    }

    return units;
  }

  /**
   * Parse Godowns XML
   */
  public static parseGodownsResponse(xml: string): any[] {
    const godowns: any[] = [];
    if (!xml) return godowns;

    const matches = xml.match(/<GODOWN[\s\S]*?<\/GODOWN>/gi) || [];

    for (const gdnXml of matches) {
      const name = this.getTagValue(gdnXml, 'NAME');
      if (!name) continue;
      const guid = this.getTagValue(gdnXml, 'GUID') || `gdn-${Date.now()}`;
      const parent = this.getTagValue(gdnXml, 'PARENT') || '';
      const address = this.getTagValue(gdnXml, 'ADDRESS') || '';

      godowns.push({
        tally_guid: guid,
        name,
        parent_godown: parent,
        address,
      });
    }

    return godowns;
  }

  /**
   * Parse Vouchers XML (Sales, Purchases, Returns, Journals)
   */
  public static parseVouchersResponse(xml: string): any[] {
    const vouchers: any[] = [];
    if (!xml) return vouchers;

    const voucherMatches = xml.match(/<VOUCHER[\s\S]*?<\/VOUCHER>/gi) || [];

    for (const vXml of voucherMatches) {
      try {
        const voucherType = this.getTagValue(vXml, 'VOUCHERTYPENAME') || this.getTagValue(vXml, 'VOUCHERTYPE') || 'Sales';
        const voucherNumber = this.getTagValue(vXml, 'VOUCHERNUMBER') || this.getTagValue(vXml, 'REFERENCE') || `VCH-${Date.now()}`;
        const guid = this.getTagValue(vXml, 'GUID') || `vch-guid-${Date.now()}-${Math.random()}`;
        const rawDate = this.getTagValue(vXml, 'DATE') || new Date().toISOString().slice(0, 10);
        const partyName = this.getTagValue(vXml, 'PARTYNAME') || this.getTagValue(vXml, 'PARTYLEDGERNAME') || this.getTagValue(vXml, 'BASICBUYERNAME') || 'General Party';
        const partyLedger = this.getTagValue(vXml, 'PARTYLEDGERNAME') || partyName;
        const referenceNumber = this.getTagValue(vXml, 'REFERENCE') || this.getTagValue(vXml, 'BASICORDERREF') || '';
        const narration = this.getTagValue(vXml, 'NARRATION') || '';
        const isCancelled = this.getTagValue(vXml, 'ISCANCELLED')?.toLowerCase() === 'yes' || this.getTagValue(vXml, 'ISCANCELLED') === '1';
        const totalAmount = Math.abs(this.parseNumeric(this.getTagValue(vXml, 'AMOUNT')));

        // Inventory lines
        const invMatches = vXml.match(/<(?:ALLINVENTORYENTRIES|INVENTORYENTRIES)\.LIST[\s\S]*?<\/(?:ALLINVENTORYENTRIES|INVENTORYENTRIES)\.LIST>/gi) || [];
        const items: any[] = [];

        for (const itemXml of invMatches) {
          const itemName = this.getTagValue(itemXml, 'STOCKITEMNAME');
          if (!itemName) continue;

          const rawQty = this.getTagValue(itemXml, 'ACTUALQTY') || this.getTagValue(itemXml, 'BILLEDQTY') || '1';
          const qty = Math.abs(this.parseNumeric(rawQty)) || 1;
          const rate = Math.abs(this.parseNumeric(this.getTagValue(itemXml, 'RATE')));
          const amount = Math.abs(this.parseNumeric(this.getTagValue(itemXml, 'AMOUNT'))) || qty * rate;
          const unit = rawQty.replace(/[-+]?[0-9]*\.?[0-9]+\s*/, '').trim() || 'PCS';
          const godown = this.getTagValue(itemXml, 'GODOWNNAME') || 'Main Central Godown';
          const batch = this.getTagValue(itemXml, 'BATCHNAME') || '';
          const discount = Math.abs(this.parseNumeric(this.getTagValue(itemXml, 'DISCOUNT')));

          items.push({
            stock_item_name: itemName,
            quantity: qty,
            unit,
            rate,
            amount,
            discount_percentage: discount,
            godown_name: godown,
            batch_name: batch,
          });
        }

        const dateStr = rawDate.length === 8 ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}` : rawDate;

        vouchers.push({
          tally_guid: guid,
          voucher_number: voucherNumber,
          voucher_type: voucherType,
          date: dateStr,
          party_name: partyName,
          party_ledger: partyLedger,
          reference_number: referenceNumber,
          narration,
          total_amount: totalAmount,
          status: isCancelled ? 'CANCELLED' : 'POSTED',
          items,
        });
      } catch (err) {
        console.error('Error parsing voucher XML chunk:', err);
      }
    }

    return vouchers;
  }

  /**
   * Parse Ledgers XML (Customers, Suppliers, Accounts)
   */
  public static parseLedgersResponse(xml: string): any[] {
    const ledgers: any[] = [];
    if (!xml) return ledgers;

    const matches = xml.match(/<LEDGER[\s\S]*?<\/LEDGER>/gi) || [];

    for (const ledXml of matches) {
      try {
        const name = this.getTagValue(ledXml, 'NAME');
        if (!name) continue;

        const guid = this.getTagValue(ledXml, 'GUID') || `led-${Date.now()}`;
        const parent = this.getTagValue(ledXml, 'PARENT') || 'Sundry Debtors';
        const openingBalance = this.parseNumeric(this.getTagValue(ledXml, 'OPENINGBALANCE'));
        const closingBalance = this.parseNumeric(this.getTagValue(ledXml, 'CLOSINGBALANCE'));
        const currentBalance = this.parseNumeric(this.getTagValue(ledXml, 'CURRENTBALANCE')) || closingBalance;
        const state = this.getTagValue(ledXml, 'STATENAME') || '';
        const pincode = this.getTagValue(ledXml, 'PINCODE') || '';
        const gstin = this.getTagValue(ledXml, 'PARTYGSTIN') || '';
        const pan = this.getTagValue(ledXml, 'INCOMETAXNUMBER') || '';
        const phone = this.getTagValue(ledXml, 'LEDGERPHONE') || '';
        const email = this.getTagValue(ledXml, 'EMAIL') || '';
        const creditPeriod = parseInt(this.getTagValue(ledXml, 'BILLCREDITPERIOD')) || 30;

        const balanceType: 'Dr' | 'Cr' = closingBalance < 0 || parent.includes('Creditor') || parent.includes('Liability') ? 'Cr' : 'Dr';

        ledgers.push({
          tally_guid: guid,
          name,
          parent_group: parent,
          opening_balance: Math.abs(openingBalance),
          closing_balance: Math.abs(closingBalance),
          current_balance: Math.abs(currentBalance),
          balance_type: balanceType,
          state,
          pincode,
          gstin,
          pan,
          phone,
          email,
          credit_period_days: creditPeriod,
        });
      } catch (err) {
        console.error('Error parsing ledger XML chunk:', err);
      }
    }

    return ledgers;
  }
}
