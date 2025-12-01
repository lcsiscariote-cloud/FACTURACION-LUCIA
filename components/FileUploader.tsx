import React, { useState } from 'react';
import { UploadCloud, FileSpreadsheet, Check, Calendar, Settings } from 'lucide-react';
import { ProcessingOptions } from '../types';

interface Props {
  onFilesSelected: (platformFile: File, costFile: File, options: ProcessingOptions) => void;
}

export const FileUploader: React.FC<Props> = ({ onFilesSelected }) => {
  const [platformFile, setPlatformFile] = useState<File | null>(null);
  const [costFile, setCostFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Settings State
  const [referenceDate, setReferenceDate] = useState(new Date().toISOString().split('T')[0]);
  const [graceDays, setGraceDays] = useState(30);

  const handleProcess = () => {
    if (platformFile && costFile) {
      setIsProcessing(true);
      // Small timeout to allow UI to update before heavy processing
      setTimeout(() => {
        onFilesSelected(platformFile, costFile, {
            referenceDate: new Date(referenceDate),
            gracePeriodDays: graceDays
        });
      }, 100);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-8 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
      <div className="bg-slate-50 p-6 border-b border-slate-100 text-center">
        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
          <FileSpreadsheet size={24} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Carga de Datos</h1>
        <p className="text-slate-500 text-sm">
          Sube los archivos y configura las reglas de cobro.
        </p>
      </div>

      <div className="p-8 grid gap-8">
        
        {/* Configuration Section */}
        <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-100">
            <h3 className="text-sm font-semibold text-blue-900 flex items-center gap-2 mb-4">
                <Settings size={16} /> Reglas de Cobranza (Bajas)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600 block">Fecha de Corte (Referencia)</label>
                    <div className="relative">
                        <input 
                            type="date" 
                            value={referenceDate}
                            onChange={(e) => setReferenceDate(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <Calendar size={16} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600 block">Días de Gracia (Cobrar Bajas)</label>
                    <div className="flex items-center gap-2">
                        <input 
                            type="number" 
                            min="0"
                            max="365"
                            value={graceDays}
                            onChange={(e) => setGraceDays(parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <span className="text-xs text-slate-400 whitespace-nowrap">días de antigüedad</span>
                    </div>
                </div>
            </div>
            <p className="text-xs text-blue-600/80 mt-3 italic">
                * Las unidades desactivadas hace menos de <strong>{graceDays} días</strong> (desde la fecha de corte) se cobrarán como activas.
            </p>
        </div>

        {/* Upload Inputs */}
        <div className="grid gap-5">
            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">1. Archivo PLATAFORMAS (Operativo)</label>
                <FileInput 
                    file={platformFile} 
                    onChange={setPlatformFile} 
                    placeholder="Selecciona PLATAFORMAS.xlsx"
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">2. Archivo COSTOS (Facturación)</label>
                <FileInput 
                    file={costFile} 
                    onChange={setCostFile} 
                    placeholder="Selecciona COSTOS FACTURACION.xlsx"
                />
            </div>
        </div>

        <button
          onClick={handleProcess}
          disabled={!platformFile || !costFile || isProcessing}
          className={`w-full py-3.5 rounded-xl font-bold text-base shadow-lg transition-all transform hover:-translate-y-0.5
            ${(!platformFile || !costFile) 
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
            }
            ${isProcessing ? 'opacity-75 cursor-wait' : ''}
          `}
        >
          {isProcessing ? 'Procesando Reglas...' : 'Generar Reporte de Cobranza'}
        </button>
      </div>
    </div>
  );
};

const FileInput: React.FC<{ file: File | null; onChange: (f: File) => void; placeholder: string }> = ({ file, onChange, placeholder }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onChange(e.target.files[0]);
        }
    };

    return (
        <div className={`relative border-2 border-dashed rounded-xl p-4 transition-colors ${file ? 'border-green-300 bg-green-50' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'}`}>
            <input 
                type="file" 
                accept=".xlsx, .xls"
                onChange={handleChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${file ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                    {file ? <Check size={20} /> : <UploadCloud size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${file ? 'text-green-800' : 'text-slate-600'}`}>
                        {file ? file.name : placeholder}
                    </p>
                    {file && <p className="text-xs text-green-600">{(file.size / 1024).toFixed(1)} KB</p>}
                </div>
            </div>
        </div>
    );
}