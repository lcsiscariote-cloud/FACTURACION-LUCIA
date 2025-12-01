import React, { useCallback, useState } from 'react';
import { UploadCloud, FileSpreadsheet, Check } from 'lucide-react';

interface Props {
  onFilesSelected: (platformFile: File, costFile: File) => void;
}

export const FileUploader: React.FC<Props> = ({ onFilesSelected }) => {
  const [platformFile, setPlatformFile] = useState<File | null>(null);
  const [costFile, setCostFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleProcess = () => {
    if (platformFile && costFile) {
      setIsProcessing(true);
      // Small timeout to allow UI to update before heavy processing
      setTimeout(() => {
        onFilesSelected(platformFile, costFile);
      }, 100);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-12 bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <FileSpreadsheet size={32} />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Carga de Datos</h1>
        <p className="text-slate-500">
          Sube los archivos Excel para iniciar el cruce de información.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Input 1: Plataformas */}
        <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">1. Archivo PLATAFORMAS (Operativo)</label>
            <FileInput 
                file={platformFile} 
                onChange={setPlatformFile} 
                placeholder="Selecciona PLATAFORMAS 01-12-25.xlsx"
            />
        </div>

        {/* Input 2: Costos */}
        <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">2. Archivo COSTOS (Facturación)</label>
            <FileInput 
                file={costFile} 
                onChange={setCostFile} 
                placeholder="Selecciona COSTOS SATECH FACTURACION.xlsx"
            />
        </div>

        <button
          onClick={handleProcess}
          disabled={!platformFile || !costFile || isProcessing}
          className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all transform hover:-translate-y-0.5
            ${(!platformFile || !costFile) 
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
            }
            ${isProcessing ? 'opacity-75 cursor-wait' : ''}
          `}
        >
          {isProcessing ? 'Procesando Datos...' : 'Generar Reporte de Cobranza'}
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
