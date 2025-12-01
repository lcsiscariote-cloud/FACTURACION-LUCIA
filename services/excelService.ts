
import { ConsolidatedRecord, ExcelRow, ProcessingOptions } from '../types';

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

// Parse flexible date formats (Excel serial number or string)
const parseDate = (value: any): Date | null => {
    if (!value) return null;

    // Excel Serial Number
    if (typeof value === 'number') {
        // Excel base date is 1899-12-30
        return new Date(Math.round((value - 25569) * 86400 * 1000));
    }

    // String Date (YYYY-MM-DD or DD/MM/YYYY)
    if (typeof value === 'string') {
        const clean = value.trim();
        if (!clean) return null;
        const d = new Date(clean);
        if (!isNaN(d.getTime())) return d;
    }

    return null;
};

// Helper to check if a device is "Active" based on LEGACY sheet rules
const isDeviceActiveLegacy = (sheetName: string, rowMap: Map<string, any>): boolean => {
  if (sheetName === 'LEASE' || sheetName === 'WIALON') {
    const deactivationDate = getValue(rowMap, ['DESACTIVACIÓN', 'DESACTIVACION', 'FECHA DE BAJA', 'BAJA', 'DESACTIVADO']);
    return !deactivationDate;
  }
  
  if (sheetName === 'ADAS') {
    const status = getValue(rowMap, ['STATUS', 'ESTADO', 'ESTATUS']);
    const statusStr = status ? status.toString().toLowerCase() : '';
    return statusStr !== 'unuse' && statusStr !== 'baja' && statusStr !== 'inactive';
  }

  if (sheetName === 'COMBUSTIBLE') {
    return true;
  }

  return true;
};

const createEmptyRecord = (id: string, name: string): ConsolidatedRecord => ({
  id,
  originalAccountName: name,
  counts: { lease: 0, wialon: 0, combustible: 0, adas: 0, totalActive: 0, recentlyDeactivated: 0 },
  billing: { costoUnitario: 0, tipo: '-', observaciones: '-', nombreComercial: '' },
  calculatedTotal: 0,
  hasDiscrepancy: false,
  devices: []
});

export const processFiles = async (platformFile: File, costFile: File, options: ProcessingOptions): Promise<ConsolidatedRecord[]> => {
  const platformData = await readExcel(platformFile);
  const costData = await readExcel(costFile);

  const accountMap = new Map<string, ConsolidatedRecord>();
  const referenceTime = options.referenceDate.getTime();
  const gracePeriodMs = options.gracePeriodDays * 24 * 60 * 60 * 1000;

  // 1. Process Platform File (Operations)
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
            
            const rawDate = getValue(rowMap, ['FECHA_DE_DESACTIVACION', 'FECHA_DE_DE', 'FECHA DE DESACTIVACION', 'DESACTIVACION']);
            
            let isBillable = false;
            let isRecentlyDeactivated = false;
            let deactivationDateObj: Date | null = null;

            if (!rawDate || rawDate.toString().trim() === '') {
                // Case 1: Active (No deactivation date)
                isBillable = true;
            } else {
                // Case 2: Has deactivation date, check grace period
                deactivationDateObj = parseDate(rawDate);
                if (deactivationDateObj) {
                    const diffTime = referenceTime - deactivationDateObj.getTime();
                    // If diffTime is negative, date is in future (still active)
                    // If diffTime is positive, check if within grace period
                    if (diffTime < 0 || diffTime <= gracePeriodMs) {
                        isBillable = true;
                        isRecentlyDeactivated = true;
                    }
                }
            }

            if (!isBillable) return;

            const accountRaw = getValue(rowMap, ['CLIENTE_CUENTA', 'CLIENTE_CUENT', 'CLIENTE']);
            const originRaw = getValue(rowMap, ['ORIGEN']);

            if (accountRaw && originRaw) {
                const normalizedAccount = normalizeKey(accountRaw);
                
                if (!accountMap.has(normalizedAccount)) {
                    accountMap.set(normalizedAccount, createEmptyRecord(normalizedAccount, accountRaw));
                }
                
                const record = accountMap.get(normalizedAccount)!;
                record.counts.totalActive++;
                if (isRecentlyDeactivated) {
                    record.counts.recentlyDeactivated++;
                }

                // Add detailed info for export
                record.devices.push({
                    name: getValue(rowMap, ['NOMBRE', 'NAME', 'UNIT', 'UNIDAD']) || 'S/N',
                    imei: getValue(rowMap, ['IMEI']) || '-',
                    deviceType: getValue(rowMap, ['TIPO_DE_DISPOSITIVO', 'DEVICE_TYPE', 'MODELO']) || '-',
                    deactivationDate: deactivationDateObj ? deactivationDateObj.toISOString().split('T')[0] : (rawDate ? rawDate.toString() : ''),
                    status: isRecentlyDeactivated ? 'BAJA_RECIENTE' : 'ACTIVO',
                    platform: originRaw
                });

                // Map 'Origen' to platform counters
                const originUpper = normalizeKey(originRaw);
                if (originUpper.includes('WIALON')) record.counts.wialon++;
                else if (originUpper.includes('ADAS')) record.counts.adas++;
                else if (originUpper.includes('COMBUSTIBLE')) record.counts.combustible++;
                else record.counts.lease++;
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
                
                if (isDeviceActiveLegacy(sheetName, rowMap)) {
                    const accountRaw = getValue(rowMap, accountKeys);
                    if (accountRaw) {
                        const normalizedAccount = normalizeKey(accountRaw);
                        
                        if (!accountMap.has(normalizedAccount)) {
                            accountMap.set(normalizedAccount, createEmptyRecord(normalizedAccount, accountRaw));
                        }
                        
                        const record = accountMap.get(normalizedAccount)!;
                        record.counts.totalActive++;
                        if (platformType) {
                             // @ts-ignore - dynamic key access safe due to if block
                            record.counts[platformType]++;
                        }

                        // Add detailed info (Legacy - best effort)
                        record.devices.push({
                            name: getValue(rowMap, ['NOMBRE', 'NAME', 'UNIT', 'UNIDAD']) || 'S/N',
                            imei: getValue(rowMap, ['IMEI', 'ID', 'SERIAL']) || '-',
                            deviceType: getValue(rowMap, ['TIPO', 'MODELO']) || '-',
                            deactivationDate: '',
                            status: 'ACTIVO',
                            platform: platformType!.toUpperCase()
                        });
                    }
                }
            });
        }
    }
  });

  // 2. Process Cost File (Billing)
  let costSheetName = Object.keys(costData.Sheets).find(name => 
      normalizeHeader(name).includes('COSTOS') || normalizeHeader(name).includes('SATECH')
  );
  if (!costSheetName) costSheetName = Object.keys(costData.Sheets)[0];

  const costSheet = costData.Sheets[costSheetName];
  if (costSheet) {
    const costRows: ExcelRow[] = XLSX.utils.sheet_to_json(costSheet);
    
    costRows.forEach(row => {
        const rowMap = createRowMap(row);
        const accountRaw = getValue(rowMap, ['CUENTA', 'CLIENTE', 'ACCOUNT']);
        
        if (accountRaw) {
            const normalizedAccount = normalizeKey(accountRaw);
            
            if (!accountMap.has(normalizedAccount)) {
                accountMap.set(normalizedAccount, createEmptyRecord(normalizedAccount, accountRaw));
            }

            const record = accountMap.get(normalizedAccount)!;
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
    
    // Flag discrepancies
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
    const wb = XLSX.utils.book_new();

    // 1. Resumen Facturación
    const exportSummary = data.map(r => ({
        'Cuenta': r.originalAccountName,
        'Nombre Comercial': r.billing.nombreComercial,
        'Total Cobrable': r.counts.totalActive,
        'Activos Reales': r.counts.totalActive - r.counts.recentlyDeactivated,
        'Bajas Recientes (Cobrables)': r.counts.recentlyDeactivated,
        'Wialon': r.counts.wialon,
        'Lease': r.counts.lease,
        'ADAS': r.counts.adas,
        'Combustible': r.counts.combustible,
        'Costo Unitario': r.billing.costoUnitario,
        'Tipo Cobro': r.billing.tipo,
        'Total a Cobrar': r.calculatedTotal,
        'Observaciones': r.billing.observaciones
    }));
    const wsSummary = XLSX.utils.json_to_sheet(exportSummary);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen Facturación");

    // 2. Detalle Bajas Recientes
    const recentDeactivationsData = data.flatMap(record => 
        record.devices
            .filter(d => d.status === 'BAJA_RECIENTE')
            .map(d => ({
                'Cuenta': record.originalAccountName,
                'Nombre Unidad': d.name,
                'IMEI': d.imei,
                'Tipo Dispositivo': d.deviceType,
                'Fecha Baja': d.deactivationDate,
                'Plataforma': d.platform,
                'Estatus Cobro': 'COBRABLE (Regla de días)'
            }))
    );
    if (recentDeactivationsData.length > 0) {
        const wsRecent = XLSX.utils.json_to_sheet(recentDeactivationsData);
        XLSX.utils.book_append_sheet(wb, wsRecent, "Detalle Bajas Cobrables");
    }

    // 3. Detalle Global Activos (Absolutamente todo)
    const allDetailsData = data.flatMap(record => 
        record.devices.map(d => ({
            'Cuenta': record.originalAccountName,
            'Nombre Unidad': d.name,
            'IMEI': d.imei,
            'Tipo Dispositivo': d.deviceType,
            'Fecha Baja': d.deactivationDate,
            'Plataforma': d.platform,
            'Estatus': d.status
        }))
    );
    const wsAll = XLSX.utils.json_to_sheet(allDetailsData);
    XLSX.utils.book_append_sheet(wb, wsAll, "Detalle Global Activos");

    XLSX.writeFile(wb, "Satech_Reporte_Facturacion.xlsx");
};
