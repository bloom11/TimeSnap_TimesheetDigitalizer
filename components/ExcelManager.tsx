
import React, { useState, useMemo, useEffect } from 'react';
import { Download, FileSpreadsheet, Check, ChevronRight, Wand2, Copy, CheckCircle2, ArrowLeft, Table, Loader2, ScanLine, Save, Home, Trash2, X, AlertCircle } from 'lucide-react';
import { TimeEntry, ExcelColumnMapping, ExportProfile } from '../types';
import { readExcelFile, generateStandardExcel, mergeAndSave, getExportableColumns } from '../services/excelService';
import { suggestColumnMapping } from '../services/aiService';
import { getExportProfiles, saveExportProfile, deleteExportProfile } from '../services/storageService';
import { getSettings } from '../services/settingsService';
import * as XLSX from 'xlsx';

interface ExcelManagerProps {
  data: TimeEntry[];
  onBack: () => void;
  onScanMore?: () => void;
  onHome?: () => void;
}

interface ColumnSelectorProps {
  dataKey: string;
  mapping: ExcelColumnMapping;
  onMappingChange: (key: string, value: string) => void;
}

const ColumnSelector: React.FC<ColumnSelectorProps> = ({ dataKey, mapping, onMappingChange }) => (
  <div className="flex items-center justify-between p-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <span className="text-sm text-slate-600 dark:text-slate-300 font-medium capitalize">{dataKey.replace(/([A-Z])/g, ' $1')}</span>
      <select 
        value={mapping[`${dataKey}Col`] || ''} 
        onChange={(e) => onMappingChange(dataKey, e.target.value)}
        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm outline-none focus:border-blue-500 w-20 text-slate-900 dark:text-white"
      >
          <option value="">Skip</option>
          {Array.from({ length: 15 }, (_, i) => String.fromCharCode(65 + i)).map(char => (
              <option key={char} value={char}>{char}</option>
          ))}
      </select>
  </div>
);

const ExcelManager: React.FC<ExcelManagerProps> = ({ data, onBack, onScanMore, onHome }) => {
  const [mode, setMode] = useState<'create' | 'merge' | null>(null);
  
  // File State
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sheetPreviews, setSheetPreviews] = useState<Record<string, any[][]> | null>(null);
  
  // Merge Config
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [startRow, setStartRow] = useState<number>(1);
  const [mapping, setMapping] = useState<ExcelColumnMapping>({});
  
  // Profile State
  const [profiles, setProfiles] = useState<ExportProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [newProfileName, setNewProfileName] = useState("");
  const [showSaveProfile, setShowSaveProfile] = useState(false);
  
  const [isMappingLoading, setIsMappingLoading] = useState(false);
  const [mappingStatus, setMappingStatus] = useState("");
  const [mappingError, setMappingError] = useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Use the shared logic to get all columns (Standard + Calculated)
  const exportableColumns = useMemo(() => getExportableColumns(data), [data]);

  // Load profiles on mount
  useEffect(() => {
      setProfiles(getExportProfiles());
  }, []);

  const handleCreateNew = () => {
    generateStandardExcel(data);
  };

  const handleCopyToClipboard = () => {
     // Join headers based on the centralized column order
     const header = exportableColumns.join("\t");
     // Map rows using the same column order
     const rows = data.map(entry => exportableColumns.map(k => entry[k] || '').join("\t")).join("\n");
     
     navigator.clipboard.writeText(`${header}\n${rows}`);
     setCopied(true);
     setTimeout(() => setCopied(false), 2000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setUploadedFile(file);
        const { workbook, previews } = await readExcelFile(file);
        setSheetPreviews(previews);
        setSheetNames(workbook.SheetNames);
        setMappingError(null);
        
        if (workbook.SheetNames.length > 0) {
            setSelectedSheet(workbook.SheetNames[0]);
        }
      } catch (err) {
        console.error(err);
        alert("Failed to read Excel file structure.");
        setUploadedFile(null);
      }
    }
  };

  const autoMapColumns = async () => {
      if (!sheetPreviews || !data[0]) return;
      
      const settings = getSettings();
      // Reset State
      setMappingError(null);
      setIsMappingLoading(true);
      setMappingStatus("Checking configuration...");

      try {
          // 1. Check for API Key validity before sending
          const keyField = `${settings.activeProvider}ApiKey` as keyof typeof settings;
          if (!settings[keyField]) {
              throw new Error(`Missing API Key for ${settings.activeProvider}. Please configure it in Settings.`);
          }

          setMappingStatus(`Asking ${settings.activeProvider}...`);

          // 2. Call AI Service
          const result = await suggestColumnMapping(sheetPreviews, data[0], settings);
          
          setMappingStatus("Applying mapping...");

          if (result.targetSheet && sheetNames.includes(result.targetSheet)) {
              setSelectedSheet(result.targetSheet);
          }
          if (result.headerRow) {
              setStartRow(result.headerRow + 1);
          }
          
          if (result.mapping) {
              const newMapping: any = {};
              Object.entries(result.mapping).forEach(([key, col]) => {
                  // SANITIZATION: Ensure key ends with 'Col' to match component state expectations
                  // Fixes issue where AI returns "date": "A" instead of "dateCol": "A"
                  const safeKey = key.endsWith('Col') ? key : `${key}Col`;
                  newMapping[safeKey] = col;
              });
              setMapping(prev => ({ ...prev, ...newMapping }));
          }

      } catch (e: any) {
          console.error(e);
          setMappingError(e.message || "Auto-detection failed.");
      } finally {
          setIsMappingLoading(false);
          setMappingStatus("");
      }
  };

  const loadProfile = (id: string) => {
      const profile = profiles.find(p => p.id === id);
      if (profile) {
          setSelectedProfileId(id);
          setMapping(profile.mapping);
          if (sheetNames.includes(profile.targetSheet)) {
              setSelectedSheet(profile.targetSheet);
          }
          setStartRow(profile.startRow);
      } else {
          setSelectedProfileId("");
      }
  };

  const handleSaveProfile = () => {
      if (!newProfileName) return;
      const saved = saveExportProfile({
          name: newProfileName,
          mapping,
          targetSheet: selectedSheet,
          startRow
      });
      setProfiles(getExportProfiles());
      setSelectedProfileId(saved.id);
      setShowSaveProfile(false);
      setNewProfileName("");
  };

  const handleDeleteProfile = () => {
      if (!selectedProfileId) return;
      deleteExportProfile(selectedProfileId);
      setProfiles(getExportProfiles());
      setSelectedProfileId("");
  };

  const handleMerge = async () => {
    if (!uploadedFile) return;
    setIsProcessing(true);
    
    try {
        await mergeAndSave(uploadedFile, selectedSheet, startRow, data, mapping);
        setIsProcessing(false);
    } catch (e: any) {
        console.error("Merge Error", e);
        alert("Failed to update Excel file: " + e.message);
        setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto p-4 space-y-6 pb-20">
      <div className="flex items-center mb-6">
          <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 mr-2">
              <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 text-center"> 
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Export Options</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Choose how to save {data.length} entries</p>
          </div>
          <div className="flex gap-2">
            {onScanMore && (
                <button 
                    onClick={onScanMore}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full"
                    title="Scan more pages"
                >
                    <ScanLine className="w-5 h-5" />
                </button>
            )}
            {onHome && (
                <button 
                    onClick={onHome}
                    className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                    title="Return Home"
                >
                    <Home className="w-5 h-5" />
                </button>
            )}
          </div>
      </div>

      {!mode && (
          <div className="space-y-4">
            <button 
                onClick={() => setMode('create')}
                className="w-full flex items-center p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-blue-500 hover:shadow-md transition-all group text-left"
            >
                <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg mr-4 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                    <Download className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                    <h3 className="font-semibold text-slate-800 dark:text-white">Create New Excel</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Generate a standard format timesheet</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 ml-auto" />
            </button>

            <button 
                onClick={() => setMode('merge')}
                className="w-full flex items-center p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-green-500 hover:shadow-md transition-all group text-left"
            >
                <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg mr-4 group-hover:bg-green-100 dark:group-hover:bg-green-900/50 transition-colors">
                    <FileSpreadsheet className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                    <h3 className="font-semibold text-slate-800 dark:text-white">Update Existing File</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Merge data into your company's template</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 ml-auto" />
            </button>

            <button 
                onClick={handleCopyToClipboard}
                className="w-full flex items-center p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-slate-500 hover:shadow-md transition-all group text-left"
            >
                <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg mr-4 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                    {copied ? <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" /> : <Copy className="w-6 h-6 text-slate-600 dark:text-slate-300" />}
                </div>
                <div>
                    <h3 className="font-semibold text-slate-800 dark:text-white">{copied ? "Copied!" : "Copy to Clipboard"}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Paste directly into any spreadsheet tool</p>
                </div>
            </button>
          </div>
      )}

      {mode === 'create' && (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 text-center animate-fade-in">
              <div className="bg-blue-50 dark:bg-blue-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Download className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Ready to Download</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">This will generate a new .xlsx file with standard formatting.</p>
              
              <div className="flex gap-3">
                  <button onClick={() => setMode(null)} className="flex-1 py-2 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">Cancel</button>
                  <button onClick={handleCreateNew} className="flex-1 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700">Download Now</button>
              </div>
          </div>
      )}

      {mode === 'merge' && (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-6 animate-fade-in">
              {!uploadedFile ? (
                  <div className="text-center space-y-4">
                      <div className="bg-green-50 dark:bg-green-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                        <FileSpreadsheet className="w-8 h-8 text-green-600 dark:text-green-400" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white">Upload Template</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">Select your company's Excel file (.xlsx) to update.</p>
                      <label className="block w-full py-3 bg-slate-800 dark:bg-slate-700 text-white rounded-lg font-medium cursor-pointer hover:bg-slate-900 dark:hover:bg-slate-600 transition-colors">
                          Select File
                          <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
                      </label>
                      <button onClick={() => setMode(null)} className="text-slate-500 dark:text-slate-400 text-sm hover:underline">Go Back</button>
                  </div>
              ) : (
                  <div className="space-y-4">
                      <div className="flex items-center justify-between">
                          <h3 className="font-bold text-slate-800 dark:text-white">Configure & Map</h3>
                          <button onClick={() => setUploadedFile(null)} className="text-xs text-red-500 font-medium">Reset File</button>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                          {showSaveProfile ? (
                              <div className="flex gap-2">
                                  <input 
                                    type="text" 
                                    placeholder="Profile Name (e.g. Standard Timesheet)"
                                    value={newProfileName}
                                    onChange={(e) => setNewProfileName(e.target.value)}
                                    className="flex-1 p-2 text-xs border border-slate-300 rounded"
                                  />
                                  <button onClick={handleSaveProfile} className="bg-green-600 text-white p-2 rounded hover:bg-green-700"><Check className="w-3 h-3" /></button>
                                  <button onClick={() => setShowSaveProfile(false)} className="bg-slate-300 text-slate-700 p-2 rounded hover:bg-slate-400"><X className="w-3 h-3" /></button>
                              </div>
                          ) : (
                              <div className="flex items-center gap-2">
                                  <select 
                                    value={selectedProfileId} 
                                    onChange={(e) => loadProfile(e.target.value)}
                                    className="flex-1 p-2 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                                  >
                                      <option value="">-- Load Saved Profile --</option>
                                      {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                  </select>
                                  {selectedProfileId && (
                                      <button onClick={handleDeleteProfile} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 className="w-3 h-3" /></button>
                                  )}
                                  <button onClick={() => setShowSaveProfile(true)} className="text-blue-600 hover:bg-blue-50 p-2 rounded" title="Save current config"><Save className="w-3 h-3" /></button>
                              </div>
                          )}
                      </div>
                      
                      {/* AI Auto-Detect Section with Feedback */}
                      <div className={`p-3 rounded-lg border flex flex-col gap-2 transition-colors ${mappingError ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-purple-50 dark:bg-purple-900/30 border-purple-100 dark:border-purple-900/50'}`}>
                          <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                  <span className={`text-xs font-medium ${mappingError ? 'text-red-700 dark:text-red-400' : 'text-purple-700 dark:text-purple-300'}`}>Auto-detect Structure?</span>
                                  <span className="text-[10px] opacity-70">Finds Sheet, Row & Columns</span>
                              </div>
                              <button 
                                onClick={autoMapColumns}
                                disabled={isMappingLoading}
                                className="bg-purple-600 text-white text-xs px-3 py-1.5 rounded-md hover:bg-purple-700 flex items-center disabled:opacity-50 transition-colors"
                              >
                                  {isMappingLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Wand2 className="w-3 h-3 mr-1" />} 
                                  {isMappingLoading ? "Scanning..." : "Auto Detect"}
                              </button>
                          </div>
                          
                          {/* Status / Error Feedback Area */}
                          {(isMappingLoading || mappingStatus) && !mappingError && (
                              <div className="text-[10px] font-mono text-purple-600 dark:text-purple-300 flex items-center animate-pulse">
                                  <ChevronRight className="w-3 h-3 mr-1" /> {mappingStatus}
                              </div>
                          )}
                          
                          {mappingError && (
                              <div className="flex items-start gap-2 text-[10px] text-red-600 dark:text-red-400 mt-1 bg-white dark:bg-slate-900 p-2 rounded border border-red-100 dark:border-red-900/50">
                                  <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                                  <div className="flex-1 break-words">{mappingError}</div>
                              </div>
                          )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Target Sheet</label>
                              <select 
                                value={selectedSheet}
                                onChange={(e) => setSelectedSheet(e.target.value)}
                                className="w-full p-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                              >
                                  {sheetNames.map(name => (
                                      <option key={name} value={name}>{name}</option>
                                  ))}
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Data Start Row</label>
                              <input 
                                type="number" 
                                min="1"
                                value={startRow}
                                onChange={(e) => setStartRow(parseInt(e.target.value) || 1)}
                                className="w-full p-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                              />
                          </div>
                      </div>

                      <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />

                      <p className="text-xs text-slate-500 dark:text-slate-400">Map data to Excel columns (A, B, C...).</p>
                      
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-2 max-h-52 overflow-y-auto">
                        {exportableColumns.map(key => (
                            <ColumnSelector 
                                key={key} 
                                dataKey={key} 
                                mapping={mapping}
                                onMappingChange={(k, v) => setMapping(prev => ({...prev, [`${k}Col`]: v}))}
                            />
                        ))}
                      </div>

                      <div className="flex gap-3 pt-2">
                        <button onClick={() => setUploadedFile(null)} className="flex-1 py-3 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">Cancel</button>
                        <button 
                            onClick={handleMerge}
                            disabled={isProcessing}
                            className="flex-[2] py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 flex items-center justify-center disabled:opacity-50"
                        >
                            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5 mr-2" /> Merge & Download</>}
                        </button>
                      </div>
                  </div>
              )}
          </div>
      )}
    </div>
  );
};

export default ExcelManager;
