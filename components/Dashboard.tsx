import React, { useMemo } from 'react';
import { ConsolidatedRecord, DashboardStats } from '../types';
import { DollarSign, Activity, AlertTriangle, Users, Download, TrendingUp, History } from 'lucide-react';
import { exportToExcel } from '../services/excelService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  data: ConsolidatedRecord[];
  onReset: () => void;
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
};

export const Dashboard: React.FC<Props> = ({ data, onReset }) => {
  
  const stats: DashboardStats = useMemo(() => {
    return data.reduce((acc, curr) => ({
      totalClients: acc.totalClients + 1,
      totalActiveDevices: acc.totalActiveDevices + curr.counts.totalActive,
      totalRecentlyDeactivated: acc.totalRecentlyDeactivated + curr.counts.recentlyDeactivated,
      totalEstimatedBilling: acc.totalEstimatedBilling + curr.calculatedTotal,
      clientsWithMissingCost: acc.clientsWithMissingCost + (curr.hasDiscrepancy ? 1 : 0)
    }), { totalClients: 0, totalActiveDevices: 0, totalRecentlyDeactivated: 0, totalEstimatedBilling: 0, clientsWithMissingCost: 0 });
  }, [data]);

  const topAccounts = data.slice(0, 10).map(d => ({
    name: d.originalAccountName.substring(0, 15),
    total: d.calculatedTotal
  }));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Resultado del Análisis</h2>
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
              +{stats.totalRecentlyDeactivated} Bajas Recientes Cobrables
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={onReset}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Nuevo Análisis
          </button>
          <button 
            onClick={() => exportToExcel(data)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Download size={16} />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Facturación Estimada" 
          value={formatCurrency(stats.totalEstimatedBilling)} 
          icon={<DollarSign className="text-green-600" size={24} />} 
          color="bg-green-50 border-green-200"
        />
        <StatCard 
          title="Dispositivos a Cobrar" 
          value={stats.totalActiveDevices.toLocaleString()} 
          icon={<Activity className="text-blue-600" size={24} />} 
          color="bg-blue-50 border-blue-200"
          subtext={`Incluye ${stats.totalRecentlyDeactivated} bajas recientes`}
        />
        <StatCard 
          title="Clientes Analizados" 
          value={stats.totalClients.toLocaleString()} 
          icon={<Users className="text-purple-600" size={24} />} 
          color="bg-purple-50 border-purple-200"
        />
        <StatCard 
          title="Discrepancias" 
          value={stats.clientsWithMissingCost.toString()} 
          icon={<AlertTriangle className="text-amber-600" size={24} />} 
          color="bg-amber-50 border-amber-200"
          subtext="Costos $0 o Sin Activos"
        />
      </div>

      {/* Main Content: Chart & Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Chart Section */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
            <TrendingUp size={18} /> Top 10 Cuentas
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topAccounts} layout="vertical" margin={{ left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11}} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {topAccounts.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index < 3 ? '#2563eb' : '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Table Section */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100">
             <h3 className="text-lg font-semibold text-slate-800">Detalle por Cuenta</h3>
          </div>
          <div className="overflow-auto flex-1 max-h-[600px]">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3">Cuenta / Cliente</th>
                  <th className="px-6 py-3 text-center">Unidades Cobrables</th>
                  <th className="px-6 py-3 text-right">Costo Unit.</th>
                  <th className="px-6 py-3 text-right">Total a Cobrar</th>
                  <th className="px-6 py-3">Tipo</th>
                  <th className="px-6 py-3">Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {row.originalAccountName}
                      {row.billing.nombreComercial && row.billing.nombreComercial !== row.originalAccountName && (
                        <div className="text-xs text-slate-400 font-normal">{row.billing.nombreComercial}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${row.counts.totalActive > 0 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'}`}>
                          {row.counts.totalActive}
                        </span>
                        {row.counts.recentlyDeactivated > 0 && (
                            <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100" title="Bajas recientes incluidas en el cobro">
                                <History size={10} />
                                +{row.counts.recentlyDeactivated} bajas
                            </span>
                        )}
                      </div>
                      
                      {row.counts.totalActive > 0 && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            {row.counts.wialon > 0 && `W:${row.counts.wialon} `}
                            {row.counts.lease > 0 && `L:${row.counts.lease} `}
                            {row.counts.adas > 0 && `A:${row.counts.adas}`}
                          </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {formatCurrency(row.billing.costoUnitario)}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">
                      {formatCurrency(row.calculatedTotal)}
                    </td>
                    <td className="px-6 py-4">
                        {row.billing.tipo}
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate text-xs" title={row.billing.observaciones}>
                      {row.billing.observaciones}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; color: string; subtext?: string }> = ({ title, value, icon, color, subtext }) => (
  <div className={`p-6 rounded-xl border ${color} shadow-sm transition-all hover:shadow-md`}>
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
        {subtext && <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">{subtext}</p>}
      </div>
      <div className="p-2 bg-white rounded-lg shadow-sm">
        {icon}
      </div>
    </div>
  </div>
);