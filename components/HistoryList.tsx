
import React, { useRef, useState } from 'react';
import { Clock, ChevronRight, Trash2, Calendar, FileText, FileJson, UploadCloud } from 'lucide-react';
import { SavedScan } from '../types';
import { getSettings } from '../services/settingsService';
import { importSavedScan, getHistory } from '../services/storageService';

interface HistoryListProps {
  history: SavedScan[];
  onSelect: (scan: SavedScan) => void;
  onDelete: (id: string) => void;
}

const HistoryList: React.FC<HistoryListProps> = ({ history: initialHistory, onSelect, onDelete }) => {
  const settings = getSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localHistory, setLocalHistory] = useState<SavedScan[]>(initialHistory);

  // Sync prop updates to local state
  React.useEffect(() => {
    setLocalHistory(initialHistory);
  }, [initialHistory]);

  const handleExport = (e: React.MouseEvent, scan: SavedScan) => {
      e.stopPropagation();
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(scan, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `debug_scan_${scan.id}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  const handleImportClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          const content = event.target?.result as string;
          if (content) {
              const success = importSavedScan(content);
              if (success) {
                  // Force refresh the list from storage
                  setLocalHistory(getHistory());
                  alert("Scan imported successfully for debugging.");
              } else {
                  alert("Failed to import. Invalid JSON format.");
              }
          }
      };
      reader.readAsText(file);
      // Reset input
      e.target.value = ""; 
  };

  const displayHistory = localHistory;

  if (displayHistory.length === 0) {
    return (
      <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 mt-6">
        <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
        <p className="text-slate-500 dark:text-slate-400 text-sm">No previous scans found.</p>
        
        {settings.debugMode && (
             <div className="mt-4">
                 <button 
                    onClick={handleImportClick}
                    className="text-xs flex items-center justify-center mx-auto px-3 py-2 bg-purple-100 text-purple-700 rounded-lg font-bold hover:bg-purple-200"
                 >
                     <UploadCloud className="w-3 h-3 mr-2" /> Import Debug Scan
                 </button>
                 <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
             </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center">
             <Clock className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" /> Recent Scans
          </h3>
          {settings.debugMode && (
             <>
                <button 
                   onClick={handleImportClick}
                   className="text-xs flex items-center px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-purple-600 border border-purple-200 dark:border-purple-900 rounded-lg font-bold hover:bg-purple-50 dark:hover:bg-purple-900/30"
                >
                    <UploadCloud className="w-3 h-3 mr-1" /> Import
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
             </>
          )}
      </div>

      <div className="space-y-3">
        {displayHistory.map((scan) => (
          <div 
            key={scan.id} 
            className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex items-center justify-between group cursor-pointer"
            onClick={() => onSelect(scan)}
          >
            <div className="flex items-center">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-2.5 rounded-lg mr-4">
                    <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                    <h4 className="font-semibold text-slate-800 dark:text-white text-sm">{scan.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center mt-1">
                        <Calendar className="w-3 h-3 mr-1" />
                        {new Date(scan.timestamp).toLocaleDateString()} at {new Date(scan.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        <span className="mx-2">•</span>
                        {scan.entries.length} entries
                    </p>
                </div>
            </div>
            
            <div className="flex items-center gap-2">
                 {/* Debug Export Button */}
                 {settings.debugMode && (
                     <button 
                        onClick={(e) => handleExport(e, scan)}
                        className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                        title="Export JSON for Debug"
                    >
                        <FileJson className="w-4 h-4" />
                    </button>
                 )}

                 <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(scan.id); }}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
                <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryList;
