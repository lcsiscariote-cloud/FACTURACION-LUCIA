import { ConsolidatedRecord, ExcelRow } from '../types';

// We access the global XLSX variable loaded via CDN in index.html
declare const XLSX: any;

const normalizeKey = (key: string): string => {
  if (!key) return "DESCONOCIDO";
  return key.toString().trim().toUpperCase();
};

const parseCurrency = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Remove $, commas, and spaces
    const clean = value.replace(/[$,\s]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

// Helper to normalize header string
const normalizeHeader = (h: string) => h ? h.toString().trim().toUpperCase() : '';

// Helper to create a normalized map for a row to handle case/space insensitivity
const createRowMap = (row: ExcelRow): Map<string, any> => {
    const map = new Map<string, any>();
    Object.keys(row).forEach(key => {
        map.set(normalizeHeader(key), row[key]);
    });
    return map;
};

// Helper to get value from normalized map with multiple possible keys
const getValue = (rowMap: Map<string, any>, possibleKeys: string[]): any => {
    for (const key of possibleKeys) {
        if (rowMap.has(key)) return rowMap.get(key);
    }
    return undefined;
};

// Helper to check if a device is "Active" based on LEGACY sheet rules
const isDeviceActive = (sheetName: string, rowMap: Map<string, any>): boolean => {
  if (sheetName === 'LEASE' || sheetName === 'WIALON') {
    // Active if 'Desactivación' is empty, null, or undefined
    // Check various common headers for deactivation
    const deactivationDate = getValue(rowMap, ['DESACTIVACIÓN', 'DESACTIVACION', 'FECHA DE BAJA', 'BAJA', 'DESACTIVADO']);
    return !deactivationDate;
  }
  
  if (sheetName === 'ADAS') {
    // Active if Status is usually 'Online' or not 'Unuse'. 
    const status = getValue(rowMap, ['STATUS', 'ESTADO', 'ESTATUS']);
    const statusStr = status ? status.toString().toLowerCase() : '';
    return statusStr !== 'unuse' && statusStr !== 'baja' && statusStr !== 'inactive';
  }

  if (sheetName === 'COMBUSTIBLE') {
    // Assuming all rows in this sheet are active sensors
    return true;
  }

  return true;
};

const createEmptyRecord = (id: string, name: string): ConsolidatedRecord => ({
  id,
  originalAccountName: name,
  counts: { lease: 0, wialon: 0, combustible: 0, adas: 0, totalActive: 0 },
  billing: { costoUnitario: 0, tipo: '-', observaciones: '-', nombreComercial: '' },
  calculatedTotal: 0,
  hasDiscrepancy: false
});

export const processFiles = async (platformFile: File, costFile: File): Promise<ConsolidatedRecord[]> => {
  const platformData = await readExcel(platformFile);
  const costData = await readExcel(costFile);

  const accountMap = new Map<string, ConsolidatedRecord>();

  // 1. Process Platform File (Operations)
  // Supports two formats:
  // A) Consolidated: Single sheet with columns 'CLIENTE_CUENTA' and 'ORIGEN'.
  // B) Legacy: Separate sheets named LEASE, WIALON, etc.
  
  const platformSheets = Object.keys(platformData.Sheets);
  
  platformSheets.forEach(sheetName => {
    const sheet = platformData.Sheets[sheetName];
    const rows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet);
    if (rows.length === 0) return;

    // Detect format based on headers of the first row
    const firstRowMap = createRowMap(rows[0]);
    
    // Check for Consolidated Format indicators (Client Account & Origin)
    const isConsolidated = (
        (getValue(firstRowMap, ['CLIENTE_CUENTA', 'CLIENTE_CUENT']) !== undefined) && 
        getValue(firstRowMap, ['ORIGEN']) !== undefined
    );

    if (isConsolidated) {
        // --- CONSOLIDATED FORMAT PROCESSING ---
        rows.forEach(row => {
            const rowMap = createRowMap(row);
            
            // Check for Deactivation Date - MUST BE EMPTY to be active
            const deactivationDate = getValue(rowMap, ['FECHA_DE_DESACTIVACION', 'FECHA_DE_DE', 'FECHA DE DESACTIVACION', 'DESACTIVACION']);
            
            // If deactivation date is present and not just whitespace, skip (inactive)
            if (deactivationDate && deactivationDate.toString().trim() !== '') {
                return; 
            }

            const accountRaw = getValue(rowMap, ['CLIENTE_CUENTA', 'CLIENTE_CUENT', 'CLIENTE']);
            const originRaw = getValue(rowMap, ['ORIGEN']);

            if (accountRaw && originRaw) {
                const normalizedAccount = normalizeKey(accountRaw);
                
                if (!accountMap.has(normalizedAccount)) {
                    accountMap.set(normalizedAccount, createEmptyRecord(normalizedAccount, accountRaw));
                }
                
                const record = accountMap.get(normalizedAccount)!;
                record.counts.totalActive++;

                // Map 'Origen' to platform counters
                const originUpper = normalizeKey(originRaw);
                if (originUpper.includes('WIALON')) record.counts.wialon++;
                else if (originUpper.includes('ADAS')) record.counts.adas++;
                else if (originUpper.includes('COMBUSTIBLE')) record.counts.combustible++;
                else record.counts.lease++; // Default bucket (e.g. for 'LEASE' or 'RUPTELA')
            }
        });
    } else {
        // --- LEGACY FORMAT PROCESSING (By Sheet Name) ---
        let platformType: keyof ConsolidatedRecord['counts'] | null = null;
        const sn = normalizeHeader(sheetName);
        
        if (sn.includes('LEASE')) platformType = 'lease';
        else if (sn.includes('WIALON')) platformType = 'wialon';
        else if (sn.includes('ADAS')) platformType = 'adas';
        else if (sn.includes('COMBUSTIBLE')) platformType = 'combustible';

        if (platformType) {
            const accountKeys = ['CUENTA', 'CLIENTE', 'ACCOUNT', 'CUSTOMER'];

            rows.forEach(row => {
                const rowMap = createRowMap(row);
                // Apply legacy active check (looking for empty deactivation date)
                if (isDeviceActive(sheetName, rowMap)) {
                    const accountRaw = getValue(rowMap, accountKeys);
                    if (accountRaw) {
                        const normalizedAccount = normalizeKey(accountRaw);
                        
                        if (!accountMap.has(normalizedAccount)) {
                            accountMap.set(normalizedAccount, createEmptyRecord(normalizedAccount, accountRaw));
                        }
                        
                        const record = accountMap.get(normalizedAccount)!;
                        record.counts.totalActive++;
                        record.counts[platformType!]++;
                    }
                }
            });
        }
    }
  });

  // 2. Process Cost File (Billing)
  // Find the sheet, fallback to first one if specific name not found
  let costSheetName = Object.keys(costData.Sheets).find(name => 
      normalizeHeader(name).includes('COSTOS') || normalizeHeader(name).includes('SATECH')
  );
  if (!costSheetName) costSheetName = Object.keys(costData.Sheets)[0];

  const costSheet = costData.Sheets[costSheetName];
  if (costSheet) {
    const costRows: ExcelRow[] = XLSX.utils.sheet_to_json(costSheet);
    
    costRows.forEach(row => {
        const rowMap = createRowMap(row);
        
        // Find Account Column
        const accountRaw = getValue(rowMap, ['CUENTA', 'CLIENTE', 'ACCOUNT']);
        
        if (accountRaw) {
            const normalizedAccount = normalizeKey(accountRaw);
            
            if (!accountMap.has(normalizedAccount)) {
                 // Account exists in billing but maybe not in platforms (active = 0)
                accountMap.set(normalizedAccount, createEmptyRecord(normalizedAccount, accountRaw));
            }

            const record = accountMap.get(normalizedAccount)!;
            
            // Robust search for Cost column
            const rawCost = getValue(rowMap, ['COSTO', 'COSTO UNITARIO', 'PRECIO', 'IMPORTE', 'MONTO', 'VALOR', 'COSTOS']);
            record.billing.costoUnitario = parseCurrency(rawCost);
            
            record.billing.tipo = getValue(rowMap, ['TIPO', 'PERIODICIDAD', 'FRECUENCIA', 'PLAN']) || 'N/A';
            record.billing.observaciones = getValue(rowMap, ['OBSERVACIONES', 'NOTAS', 'COMENTARIOS', 'OBS']) || '';
            record.billing.nombreComercial = getValue(rowMap, ['NOMBRE COMERCIAL', 'RAZON SOCIAL', 'NOMBRE', 'CLIENTE']) || '';
        }
    });
  }

  // 3. Final Calculations
  const results = Array.from(accountMap.values()).map(record => {
    record.calculatedTotal = record.counts.totalActive * record.billing.costoUnitario;
    
    // Flag discrepancies: 
    // 1. Has active units but 0 cost.
    // 2. Has cost defined but 0 active units.
    if ((record.counts.totalActive > 0 && record.billing.costoUnitario === 0) || 
        (record.counts.totalActive === 0 && record.billing.costoUnitario > 0)) {
        record.hasDiscrepancy = true;
    }
    
    return record;
  });

  return results.sort((a, b) => b.calculatedTotal - a.calculatedTotal);
};

const readExcel = (file: File): Promise<any> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      resolve(workbook);
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
};

export const exportToExcel = (data: ConsolidatedRecord[]) => {
    const exportData = data.map(r => ({
        'Cuenta': r.originalAccountName,
        'Nombre Comercial': r.billing.nombreComercial,
        'Total Activos': r.counts.totalActive,
        'Wialon': r.counts.wialon,
        'Lease': r.counts.lease,
        'ADAS': r.counts.adas,
        'Combustible': r.counts.combustible,
        'Costo Unitario': r.billing.costoUnitario,
        'Tipo Cobro': r.billing.tipo,
        'Total a Cobrar': r.calculatedTotal,
        'Observaciones': r.billing.observaciones
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte Facturación");
    XLSX.writeFile(wb, "Satech_Reporte_Facturacion.xlsx");
};
