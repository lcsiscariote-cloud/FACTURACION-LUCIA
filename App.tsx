import React, { useState } from 'react';
import { FileUploader } from './components/FileUploader';
import { Dashboard } from './components/Dashboard';
import { processFiles } from './services/excelService';
import { ConsolidatedRecord, ProcessingOptions } from './types';
import { LayoutDashboard } from 'lucide-react';

const App: React.FC = () => {
  const [data, setData] = useState<ConsolidatedRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFilesSelected = async (platformFile: File, costFile: File, options: ProcessingOptions) => {
    try {
      setError(null);
      const results = await processFiles(platformFile, costFile, options);
      setData(results);
    } catch (err) {
      console.error(err);
      setError("Error al procesar los archivos. Por favor asegúrate de que sean archivos Excel válidos y que tengan la estructura esperada.");
    }
  };

  const handleReset = () => {
    setData(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 mb-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-700">
                <LayoutDashboard className="w-6 h-6" />
                <span className="font-bold text-xl tracking-tight">Satech Financial</span>
            </div>
            <div className="text-sm text-slate-500">v1.1.0</div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                <span className="font-bold">Error:</span> {error}
            </div>
        )}

        {!data ? (
          <FileUploader onFilesSelected={handleFilesSelected} />
        ) : (
          <Dashboard data={data} onReset={handleReset} />
        )}
      </main>
    </div>
  );
};

export default App;