import { ITallyProvider, TallyConnectionConfig, TallyConnectionTestResult, TallyQueryOptions } from './tallyProtocol';
import { TallyRequestBuilder } from '../requests/tallyRequestBuilder';
import { TallyResponseParser } from '../parsers/tallyResponseParser';

/**
 * Live Tally Provider connecting via HTTP to real local or network TallyPrime instance
 */
export class LiveTallyProvider implements ITallyProvider {
  private formatEndpoint(config: TallyConnectionConfig): string {
    const cleanUrl = (config.serverUrl || 'http://localhost').replace(/\/+$/, '');
    const port = config.port || 9000;
    return `${cleanUrl}:${port}`;
  }

  public async testConnection(config: TallyConnectionConfig): Promise<TallyConnectionTestResult> {
    const startTime = Date.now();
    const endpoint = this.formatEndpoint(config);
    const timeoutMs = config.timeoutMs || 3000;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // Send a lightweight XML request to test Tally gateway
      const testXml = TallyRequestBuilder.buildCompanyExportRequest(config.companyName);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml;charset=utf-8' },
        body: testXml,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Math.max(8, Date.now() - startTime);

      if (res.ok) {
        const text = await res.text();
        const companyInfo = TallyResponseParser.parseCompanyResponse(text);

        return {
          connected: true,
          status: 'CONNECTED',
          latencyMs,
          message: `Successfully connected to TallyPrime instance at ${endpoint}. Company "${companyInfo?.name || config.companyName || 'Active Company'}" reachable.`,
          serverInfo: {
            serverUrl: config.serverUrl,
            port: config.port,
            companyName: companyInfo?.name || config.companyName || 'Active Company',
            version: companyInfo?.tally_version || 'TallyPrime 4.1 Live',
            isMock: false,
          },
        };
      }

      return {
        connected: false,
        status: 'ERROR',
        latencyMs,
        errorType: 'INVALID_RESPONSE',
        message: `Tally responded with HTTP status ${res.status} ${res.statusText}.`,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout');

      return {
        connected: false,
        status: 'DISCONNECTED',
        latencyMs: 0,
        errorType: isTimeout ? 'TIMEOUT' : 'CONNECTION_REFUSED',
        message: isTimeout
          ? `Connection to Tally at ${endpoint} timed out after ${timeoutMs}ms.`
          : `Could not connect to TallyPrime at ${endpoint}. Connection refused or port closed. Verify TallyPrime is running with XML/ODBC server enabled.`,
      };
    }
  }

  public async executeXmlRequest(xmlRequest: string, config: TallyConnectionConfig): Promise<string> {
    const endpoint = this.formatEndpoint(config);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs || 8000);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml;charset=utf-8' },
        body: xmlRequest,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        throw new Error(`Tally server error: ${res.status} ${res.statusText}`);
      }
      return await res.text();
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (config.useMockFallback) {
        return '';
      }
      throw err;
    }
  }

  public async getCompanyDetails(config: TallyConnectionConfig): Promise<any> {
    const xmlReq = TallyRequestBuilder.buildCompanyExportRequest(config.companyName);
    const resXml = await this.executeXmlRequest(xmlReq, config);
    return TallyResponseParser.parseCompanyResponse(resXml);
  }

  public async getStockItems(config: TallyConnectionConfig, options?: TallyQueryOptions): Promise<any[]> {
    const xmlReq = TallyRequestBuilder.buildStockItemsExportRequest(config.companyName, options?.fromDate, options?.toDate);
    const resXml = await this.executeXmlRequest(xmlReq, config);
    return TallyResponseParser.parseStockItemsResponse(resXml);
  }

  public async getStockGroups(config: TallyConnectionConfig): Promise<any[]> {
    const xmlReq = TallyRequestBuilder.buildStockGroupsExportRequest(config.companyName);
    const resXml = await this.executeXmlRequest(xmlReq, config);
    return TallyResponseParser.parseStockGroupsResponse(resXml);
  }

  public async getUnits(config: TallyConnectionConfig): Promise<any[]> {
    const xmlReq = TallyRequestBuilder.buildUnitsExportRequest(config.companyName);
    const resXml = await this.executeXmlRequest(xmlReq, config);
    return TallyResponseParser.parseUnitsResponse(resXml);
  }

  public async getGodowns(config: TallyConnectionConfig): Promise<any[]> {
    const xmlReq = TallyRequestBuilder.buildGodownsExportRequest(config.companyName);
    const resXml = await this.executeXmlRequest(xmlReq, config);
    return TallyResponseParser.parseGodownsResponse(resXml);
  }

  public async getVouchers(config: TallyConnectionConfig, options?: TallyQueryOptions): Promise<any[]> {
    const xmlReq = TallyRequestBuilder.buildVouchersExportRequest(config.companyName, options?.fromDate, options?.toDate);
    const resXml = await this.executeXmlRequest(xmlReq, config);
    return TallyResponseParser.parseVouchersResponse(resXml);
  }

  public async getLedgers(config: TallyConnectionConfig): Promise<any[]> {
    const xmlReq = TallyRequestBuilder.buildLedgersExportRequest(config.companyName);
    const resXml = await this.executeXmlRequest(xmlReq, config);
    return TallyResponseParser.parseLedgersResponse(resXml);
  }
}

/**
 * Mock Tally Provider providing realistic Indian industrial hardware data for offline development & zero-setup testing
 */
export class MockTallyProvider implements ITallyProvider {
  public async testConnection(config: TallyConnectionConfig): Promise<TallyConnectionTestResult> {
    const latencyMs = Math.floor(16 + Math.random() * 20);
    const company = config.companyName || 'Apex Industrial Solutions (2026-27)';
    const cleanUrl = config.serverUrl || 'http://localhost';
    const port = config.port || 9000;

    return {
      connected: true,
      status: 'CONNECTED',
      latencyMs,
      message: `Successfully connected to TallyPrime gateway at ${cleanUrl}:${port} [Company: ${company}]. Ready for master & voucher synchronization.`,
      serverInfo: {
        serverUrl: cleanUrl,
        port,
        companyName: company,
        version: 'TallyPrime Server Release 4.1 (ODBC/HTTP Live Gateway)',
        isMock: true,
      },
    };
  }

  public async executeXmlRequest(_xmlRequest: string, _config: TallyConnectionConfig): Promise<string> {
    return `<ENVELOPE><HEADER><STATUS>1</STATUS></HEADER><BODY><DATA>MOCK_SUCCESS</DATA></BODY></ENVELOPE>`;
  }

  public async getCompanyDetails(config: TallyConnectionConfig): Promise<any> {
    return {
      tally_guid: 'tally-comp-apex-2026',
      name: config.companyName || 'Apex Industrial Solutions (2026-27)',
      mailing_name: 'Apex Industrial Solutions Private Limited',
      address: 'Plot 42, Sector 18, Phase IV, Udyog Vihar',
      state: 'Haryana',
      country: 'India',
      pincode: '122015',
      phone: '+91 124 4892000',
      email: 'accounts@apexenterprise.com',
      website: 'https://apexenterprise.com',
      financial_year_start: '2026-04-01',
      books_start: '2026-04-01',
      currency: 'INR (₹)',
      gstin: '06AAACA9821L1ZM',
      pan: 'AAACA9821L',
      tally_version: 'TallyPrime Server Release 4.1',
    };
  }

  public async getStockItems(_config: TallyConnectionConfig): Promise<any[]> {
    return [
      {
        tally_guid: 'item-bf-av-01',
        name: 'Angle Valve 1/2" Brass Chrome',
        sku: 'BF-AV-01',
        alias: 'BF-AV-01',
        stock_group: 'Bathroom Fittings',
        category: 'Bathroom Fittings',
        unit: 'Pieces',
        current_stock: 145,
        opening_stock: 120,
        unit_cost: 320,
        standard_selling_price: 400,
        valuation_method: 'Avg Cost',
        description: 'Heavy duty quarter turn brass angle valve with wall flange',
        godown_name: 'Main Central Godown',
      },
      {
        tally_guid: 'item-bf-bb-02',
        name: 'Bib Cock Long Body Brass',
        sku: 'BF-BB-02',
        alias: 'BF-BB-02',
        stock_group: 'Bathroom Fittings',
        category: 'Bathroom Fittings',
        unit: 'Pieces',
        current_stock: 68,
        opening_stock: 80,
        unit_cost: 450,
        standard_selling_price: 560,
        valuation_method: 'Avg Cost',
        description: 'Forged brass long body bib tap with aerator foam flow',
        godown_name: 'Main Central Godown',
      },
      {
        tally_guid: 'item-pp-cpvc-01',
        name: 'CPVC Pipe 1" SDR-11 (3 Meter)',
        sku: 'PP-CPVC-01',
        alias: 'PP-CPVC-01',
        stock_group: 'Plumbing & Pipes',
        category: 'Plumbing & Pipes',
        unit: 'Pieces',
        current_stock: 310,
        opening_stock: 250,
        unit_cost: 380,
        standard_selling_price: 475,
        valuation_method: 'Avg Cost',
        description: 'Chlorinated polyvinyl chloride potable hot and cold pipe',
        godown_name: 'Main Central Godown',
      },
      {
        tally_guid: 'item-pp-upvc-02',
        name: 'UPVC Ball Valve 1.5" Threaded',
        sku: 'PP-UPVC-02',
        alias: 'PP-UPVC-02',
        stock_group: 'Plumbing & Pipes',
        category: 'Plumbing & Pipes',
        unit: 'Pieces',
        current_stock: 42,
        opening_stock: 50,
        unit_cost: 510,
        standard_selling_price: 640,
        valuation_method: 'Avg Cost',
        description: 'Full port industrial schedule 80 UPVC quarter turn valve',
        godown_name: 'Warehouse B - Dispatch Depot',
      },
      {
        tally_guid: 'item-ea-is-01',
        name: 'Industrial Switch 16A Modular',
        sku: 'EA-IS-01',
        alias: 'EA-IS-01',
        stock_group: 'Electrical Accessories',
        category: 'Electrical Accessories',
        unit: 'Pieces',
        current_stock: 240,
        opening_stock: 200,
        unit_cost: 85,
        standard_selling_price: 110,
        valuation_method: 'Avg Cost',
        description: 'Heavy duty polycarbonate single pole industrial switch',
        godown_name: 'Main Central Godown',
      },
      {
        tally_guid: 'item-fh-ss-01',
        name: 'Stainless Steel Hex Bolt M10 x 50mm',
        sku: 'FH-SS-01',
        alias: 'FH-SS-01',
        stock_group: 'Fasteners & Hardware',
        category: 'Fasteners & Hardware',
        unit: 'Kilograms',
        current_stock: 120,
        opening_stock: 100,
        unit_cost: 260,
        standard_selling_price: 330,
        valuation_method: 'Avg Cost',
        description: 'SS-304 grade corrosion resistant precision threaded hex bolts',
        godown_name: 'Main Central Godown',
      },
    ];
  }

  public async getStockGroups(_config: TallyConnectionConfig): Promise<any[]> {
    return [
      { tally_guid: 'grp-bf', name: 'Bathroom Fittings', parent_group: '', hierarchy_path: 'Bathroom Fittings' },
      { tally_guid: 'grp-pp', name: 'Plumbing & Pipes', parent_group: '', hierarchy_path: 'Plumbing & Pipes' },
      { tally_guid: 'grp-ea', name: 'Electrical Accessories', parent_group: '', hierarchy_path: 'Electrical Accessories' },
      { tally_guid: 'grp-fh', name: 'Fasteners & Hardware', parent_group: '', hierarchy_path: 'Fasteners & Hardware' },
      { tally_guid: 'grp-ps', name: 'Paints & Sealants', parent_group: '', hierarchy_path: 'Paints & Sealants' },
    ];
  }

  public async getUnits(_config: TallyConnectionConfig): Promise<any[]> {
    return [
      { name: 'Pieces', symbol: 'PCS', formal_name: 'Pieces', decimal_places: 0 },
      { name: 'Meters', symbol: 'MTR', formal_name: 'Meters', decimal_places: 2 },
      { name: 'Kilograms', symbol: 'KGS', formal_name: 'Kilograms', decimal_places: 2 },
      { name: 'Numbers', symbol: 'NOS', formal_name: 'Numbers', decimal_places: 0 },
      { name: 'Boxes', symbol: 'BOX', formal_name: 'Boxes (100 Pcs)', decimal_places: 0 },
    ];
  }

  public async getGodowns(_config: TallyConnectionConfig): Promise<any[]> {
    return [
      {
        tally_guid: 'gdn-main',
        name: 'Main Central Godown',
        parent_godown: '',
        address: 'Warehouse Block A, Sector 18, Gurgaon',
      },
      {
        tally_guid: 'gdn-wh-b',
        name: 'Warehouse B - Dispatch Depot',
        parent_godown: '',
        address: 'Transport Nagar, Delhi Bypass',
      },
    ];
  }

  public async getVouchers(_config: TallyConnectionConfig, _options?: TallyQueryOptions): Promise<any[]> {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    return [
      {
        tally_guid: 'vch-mock-sales-01',
        voucher_number: 'INV-2026-088',
        voucher_type: 'Sales',
        date: today,
        party_name: 'Godrej Properties Ltd',
        party_ledger: 'Godrej Properties Ltd',
        reference_number: 'SO-1024',
        narration: 'Material delivery for Tower 4 plumbing fitments',
        total_amount: 52500,
        status: 'POSTED',
        items: [
          {
            stock_item_name: 'Angle Valve 1/2" Brass Chrome',
            quantity: 30,
            unit: 'PCS',
            rate: 350,
            amount: 10500,
            godown_name: 'Main Central Godown',
          },
          {
            stock_item_name: 'CPVC Pipe 1" SDR-11 (3 Meter)',
            quantity: 40,
            unit: 'PCS',
            rate: 450,
            amount: 18000,
            godown_name: 'Main Central Godown',
          },
          {
            stock_item_name: 'Industrial Switch 16A Modular',
            quantity: 100,
            unit: 'Pieces',
            rate: 110,
            amount: 11000,
            godown_name: 'Main Central Godown',
          },
        ],
      },
      {
        tally_guid: 'vch-mock-pur-01',
        voucher_number: 'PUR-2026-052',
        voucher_type: 'Purchase',
        date: yesterday,
        party_name: 'Jaquar & Company Pvt Ltd',
        party_ledger: 'Jaquar & Company Pvt Ltd',
        reference_number: 'PO-APEX-9921',
        narration: 'Bulk replenishment batch received at central godown',
        total_amount: 87000,
        status: 'POSTED',
        items: [
          {
            stock_item_name: 'Angle Valve 1/2" Brass Chrome',
            quantity: 100,
            unit: 'PCS',
            rate: 290,
            amount: 29000,
            godown_name: 'Main Central Godown',
          },
          {
            stock_item_name: 'Bib Cock Long Body Brass',
            quantity: 50,
            unit: 'Pieces',
            rate: 420,
            amount: 21000,
            godown_name: 'Main Central Godown',
          },
        ],
      },
      {
        tally_guid: 'vch-mock-stk-01',
        voucher_number: 'STK-TR-019',
        voucher_type: 'Stock Journal',
        date: yesterday,
        party_name: 'Internal Transfer',
        party_ledger: 'Stock Transfer Account',
        reference_number: 'TR-WH-04',
        narration: 'Inter-godown transfer from Central Godown to Warehouse B',
        total_amount: 19000,
        status: 'POSTED',
        items: [
          {
            stock_item_name: 'UPVC Ball Valve 1.5" Threaded',
            quantity: 20,
            unit: 'Pieces',
            rate: 510,
            amount: 10200,
            godown_name: 'Warehouse B - Dispatch Depot',
          },
        ],
      },
      {
        tally_guid: 'vch-mock-ret-01',
        voucher_number: 'CN-2026-004',
        voucher_type: 'Credit Note',
        date: today,
        party_name: 'Godrej Properties Ltd',
        party_ledger: 'Godrej Properties Ltd',
        reference_number: 'RET-GD-02',
        narration: 'Customer return for excess unused CPVC pipes',
        total_amount: 4500,
        status: 'POSTED',
        items: [
          {
            stock_item_name: 'CPVC Pipe 1" SDR-11 (3 Meter)',
            quantity: 10,
            unit: 'PCS',
            rate: 450,
            amount: 4500,
            godown_name: 'Main Central Godown',
          },
        ],
      },
    ];
  }

  public async getLedgers(_config: TallyConnectionConfig): Promise<any[]> {
    return [
      {
        tally_guid: 'led-godrej',
        name: 'Godrej Properties Ltd',
        parent_group: 'Sundry Debtors',
        opening_balance: 145000,
        closing_balance: 215000,
        current_balance: 215000,
        balance_type: 'Dr',
        address: 'Godrej One, Pirojshanagar, Vikhroli East, Mumbai',
        state: 'Maharashtra',
        gstin: '27AABCG1234F1Z8',
        pan: 'AABCG1234F',
        credit_period_days: 30,
      },
      {
        tally_guid: 'led-lnt',
        name: 'L&T Construction Infrastructure',
        parent_group: 'Sundry Debtors',
        opening_balance: 350000,
        closing_balance: 480000,
        current_balance: 480000,
        balance_type: 'Dr',
        address: 'Mount Poonamallee Road, Manapakkam, Chennai',
        state: 'Tamil Nadu',
        gstin: '33AABCL2345K1Z9',
        pan: 'AABCL2345K',
        credit_period_days: 45,
      },
      {
        tally_guid: 'led-dlf',
        name: 'DLF Commercial Developers Ltd',
        parent_group: 'Sundry Debtors',
        opening_balance: 95000,
        closing_balance: 180000,
        current_balance: 180000,
        balance_type: 'Dr',
        address: 'DLF Cyber City, Phase II, Gurugram',
        state: 'Haryana',
        gstin: '06AAACD5592P1ZF',
        pan: 'AAACD5592P',
        credit_period_days: 30,
      },
      {
        tally_guid: 'led-jaquar',
        name: 'Jaquar & Company Pvt Ltd',
        parent_group: 'Sundry Creditors',
        opening_balance: 85000,
        closing_balance: 142000,
        current_balance: 142000,
        balance_type: 'Cr',
        address: 'Plot 306, Phase II, IMT Manesar, Gurugram',
        state: 'Haryana',
        gstin: '06AAACJ4492K1ZO',
        pan: 'AAACJ4492K',
        credit_period_days: 30,
      },
      {
        tally_guid: 'led-astral',
        name: 'Astral Poly Technik Ltd',
        parent_group: 'Sundry Creditors',
        opening_balance: 120000,
        closing_balance: 95000,
        current_balance: 95000,
        balance_type: 'Cr',
        address: '207/1, Astral House, B/h Rajpath Club, Ahmedabad',
        state: 'Gujarat',
        gstin: '24AAACA1294F1ZK',
        pan: 'AAACA1294F',
        credit_period_days: 30,
      },
      {
        tally_guid: 'led-havells',
        name: 'Havells India Limited',
        parent_group: 'Sundry Creditors',
        opening_balance: 60000,
        closing_balance: 88000,
        current_balance: 88000,
        balance_type: 'Cr',
        address: 'QRG Towers, 2D, Expressway, Sector 126, Noida',
        state: 'Uttar Pradesh',
        gstin: '09AAACH0852K1ZY',
        pan: 'AAACH0852K',
        credit_period_days: 30,
      },
      {
        tally_guid: 'led-hdfc',
        name: 'HDFC Bank Current Account',
        parent_group: 'Bank Accounts',
        opening_balance: 840000,
        closing_balance: 1250000,
        current_balance: 1250000,
        balance_type: 'Dr',
      },
      {
        tally_guid: 'led-cash',
        name: 'Cash Account',
        parent_group: 'Cash-in-Hand',
        opening_balance: 45000,
        closing_balance: 38500,
        current_balance: 38500,
        balance_type: 'Dr',
      },
    ];
  }
}

/**
 * Global factory providing live or mock Tally Provider based on configuration
 */
export function getTallyClient(config?: TallyConnectionConfig): ITallyProvider {
  // If explicitly configured for mock or testing, return MockTallyProvider
  if (config?.useMockFallback) {
    return new MockTallyProvider();
  }
  return new LiveTallyProvider();
}

/**
 * Backward-compatible helper for connection testing
 */
export async function testTallyConnection(
  serverUrl: string,
  port: number,
  companyName: string
): Promise<TallyConnectionTestResult> {
  const live = new LiveTallyProvider();
  const res = await live.testConnection({ serverUrl, port, companyName, timeoutMs: 2500, useMockFallback: false });
  return res;
}
