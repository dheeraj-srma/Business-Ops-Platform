export interface TallyConnectionConfig {
  serverUrl: string; // e.g. 'http://localhost'
  port: number; // e.g. 9000
  companyName?: string;
  timeoutMs?: number;
  useMockFallback?: boolean;
}

export interface TallyConnectionTestResult {
  connected: boolean;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  latencyMs: number;
  message: string;
  errorType?: 'CONNECTION_REFUSED' | 'TIMEOUT' | 'NO_COMPANY_LOADED' | 'INVALID_RESPONSE' | 'UNKNOWN';
  serverInfo?: {
    serverUrl: string;
    port: number;
    companyName: string;
    version?: string;
    isMock?: boolean;
  };
}

export interface TallyQueryOptions {
  fromDate?: string;
  toDate?: string;
  companyName?: string;
  lastSyncTimestamp?: string;
}

export interface ITallyProvider {
  testConnection(config: TallyConnectionConfig): Promise<TallyConnectionTestResult>;
  executeXmlRequest(xmlRequest: string, config: TallyConnectionConfig): Promise<string>;
  getCompanyDetails(config: TallyConnectionConfig): Promise<any>;
  getStockItems(config: TallyConnectionConfig, options?: TallyQueryOptions): Promise<any[]>;
  getStockGroups(config: TallyConnectionConfig): Promise<any[]>;
  getUnits(config: TallyConnectionConfig): Promise<any[]>;
  getGodowns(config: TallyConnectionConfig): Promise<any[]>;
  getVouchers(config: TallyConnectionConfig, options?: TallyQueryOptions): Promise<any[]>;
  getLedgers(config: TallyConnectionConfig): Promise<any[]>;
}
