export interface PlatformCounts {
  lease: number;
  wialon: number;
  combustible: number;
  adas: number;
  totalActive: number;
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
}

export interface DashboardStats {
  totalClients: number;
  totalActiveDevices: number;
  totalEstimatedBilling: number;
  clientsWithMissingCost: number;
}

// Helper for SheetJS raw row data
export type ExcelRow = Record<string, any>;
