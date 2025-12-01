
export interface DeviceDetail {
  name: string;
  imei: string;
  deviceType: string;
  deactivationDate: string;
  status: 'ACTIVO' | 'BAJA_RECIENTE';
  platform: string;
}

export interface PlatformCounts {
  lease: number;
  wialon: number;
  combustible: number;
  adas: number;
  totalActive: number; // Sum of purely active + recently deactivated
  recentlyDeactivated: number; // Subset of totalActive that are billable due to < 30 days rule
}

export interface CostData {
  costoUnitario: number;
  tipo: string;
  observaciones: string;
  nombreComercial: string;
}

export interface ConsolidatedRecord {
  id: string; // Normalized account name
  originalAccountName: string;
  counts: PlatformCounts;
  billing: CostData;
  calculatedTotal: number;
  hasDiscrepancy: boolean; // True if active units > 0 but no cost data, or vice versa
  devices: DeviceDetail[]; // Detailed list of all billable devices for this account
}

export interface DashboardStats {
  totalClients: number;
  totalActiveDevices: number;
  totalRecentlyDeactivated: number;
  totalEstimatedBilling: number;
  clientsWithMissingCost: number;
}

export type ExcelRow = Record<string, any>;

export interface ProcessingOptions {
  referenceDate: Date; // "Today" or specific cutoff date
  gracePeriodDays: number; // e.g., 30 days
}
