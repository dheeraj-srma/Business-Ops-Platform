export class TallyRequestBuilder {
  /**
   * Format date from YYYY-MM-DD to Tally format YYYYMMDD
   */
  private static formatTallyDate(dateStr?: string): string {
    if (!dateStr) return '';
    return dateStr.replace(/[^0-9]/g, '').slice(0, 8);
  }

  /**
   * Build Company List / Details XML Request
   */
  public static buildCompanyExportRequest(companyName?: string): string {
    return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>List of Companies</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          ${companyName ? `<SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>` : ''}
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;
  }

  /**
   * Build Stock Items XML Export Request with full master properties
   */
  public static buildStockItemsExportRequest(companyName?: string, fromDate?: string, toDate?: string): string {
    const formattedFrom = this.formatTallyDate(fromDate);
    const formattedTo = this.formatTallyDate(toDate);

    return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Stock Item</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          ${companyName ? `<SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>` : ''}
          ${formattedFrom ? `<SVFROMDATE>${formattedFrom}</SVFROMDATE>` : ''}
          ${formattedTo ? `<SVTODATE>${formattedTo}</SVTODATE>` : ''}
        </STATICVARIABLES>
        <TDL>
          <TDLMESSAGE>
            <COLLECTION NAME="StockItemCollection" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
              <TYPE>StockItem</TYPE>
              <FETCH>NAME,GUID,PARENT,CATEGORY,BASEUNITS,ADDITIONALUNITS,OPENINGBALANCE,OPENINGVALUE,OPENINGRATE,CLOSINGBALANCE,CLOSINGVALUE,CLOSINGRATE,STANDARDCOST,STANDARDPRICE,PARTNO,ALIAS,DESCRIPTION,BATCHALLOCATIONS.*,GODOWNNAME</FETCH>
            </COLLECTION>
          </TDLMESSAGE>
        </TDL>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;
  }

  /**
   * Build Stock Groups XML Export Request
   */
  public static buildStockGroupsExportRequest(companyName?: string): string {
    return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>List of Accounts</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <ACCOUNTTYPE>Stock Groups</ACCOUNTTYPE>
          ${companyName ? `<SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>` : ''}
        </STATICVARIABLES>
        <TDL>
          <TDLMESSAGE>
            <COLLECTION NAME="StockGroupCollection">
              <TYPE>StockGroup</TYPE>
              <FETCH>NAME,GUID,PARENT</FETCH>
            </COLLECTION>
          </TDLMESSAGE>
        </TDL>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;
  }

  /**
   * Build Units of Measurement XML Request
   */
  public static buildUnitsExportRequest(companyName?: string): string {
    return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>List of Accounts</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <ACCOUNTTYPE>Units</ACCOUNTTYPE>
          ${companyName ? `<SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>` : ''}
        </STATICVARIABLES>
        <TDL>
          <TDLMESSAGE>
            <COLLECTION NAME="UnitCollection">
              <TYPE>Unit</TYPE>
              <FETCH>NAME,ORIGINALNAME,DECIMALPLACES,ISCONVERSION</FETCH>
            </COLLECTION>
          </TDLMESSAGE>
        </TDL>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;
  }

  /**
   * Build Godowns (Warehouses) XML Export Request
   */
  public static buildGodownsExportRequest(companyName?: string): string {
    return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>List of Accounts</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <ACCOUNTTYPE>Godowns</ACCOUNTTYPE>
          ${companyName ? `<SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>` : ''}
        </STATICVARIABLES>
        <TDL>
          <TDLMESSAGE>
            <COLLECTION NAME="GodownCollection">
              <TYPE>Godown</TYPE>
              <FETCH>NAME,GUID,PARENT,ADDRESS</FETCH>
            </COLLECTION>
          </TDLMESSAGE>
        </TDL>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;
  }

  /**
   * Build Vouchers (Sales, Purchases, Returns, Journals) XML Request
   */
  public static buildVouchersExportRequest(
    companyName?: string,
    fromDate?: string,
    toDate?: string,
    voucherTypeName?: string
  ): string {
    const formattedFrom = this.formatTallyDate(fromDate);
    const formattedTo = this.formatTallyDate(toDate);

    return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Voucher Register</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          ${companyName ? `<SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>` : ''}
          ${formattedFrom ? `<SVFROMDATE>${formattedFrom}</SVFROMDATE>` : ''}
          ${formattedTo ? `<SVTODATE>${formattedTo}</SVTODATE>` : ''}
          ${voucherTypeName ? `<VOUCHERTYPENAME>${voucherTypeName}</VOUCHERTYPENAME>` : ''}
        </STATICVARIABLES>
        <TDL>
          <TDLMESSAGE>
            <COLLECTION NAME="VoucherCollection">
              <TYPE>Voucher</TYPE>
              <FETCH>GUID,VOUCHERNUMBER,VOUCHERTYPENAME,DATE,EFFECTIVEDATE,PARTYNAME,PARTYLEDGERNAME,BASICBUYERNAME,REFERENCE,BASICORDERREF,NARRATION,ISCANCELLED,AMOUNT,ALLINVENTORYENTRIES.LIST.*,INVENTORYENTRIES.LIST.*,ALLLEDGERENTRIES.LIST.*,LEDGERENTRIES.LIST.*</FETCH>
            </COLLECTION>
          </TDLMESSAGE>
        </TDL>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;
  }

  /**
   * Build Ledgers (Customers, Suppliers, Accounts) XML Request
   */
  public static buildLedgersExportRequest(companyName?: string): string {
    return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>List of Accounts</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <ACCOUNTTYPE>Ledgers</ACCOUNTTYPE>
          ${companyName ? `<SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>` : ''}
        </STATICVARIABLES>
        <TDL>
          <TDLMESSAGE>
            <COLLECTION NAME="LedgerCollection">
              <TYPE>Ledger</TYPE>
              <FETCH>NAME,GUID,PARENT,OPENINGBALANCE,CLOSINGBALANCE,CURRENTBALANCE,ADDRESS.LIST.*,STATENAME,PINCODE,PARTYGSTIN,INCOMETAXNUMBER,BILLCREDITPERIOD,LEDGERPHONE,EMAIL</FETCH>
            </COLLECTION>
          </TDLMESSAGE>
        </TDL>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;
  }
}
