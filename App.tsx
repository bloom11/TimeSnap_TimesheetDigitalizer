
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, History, Settings, RotateCcw, X, AlertTriangle, Monitor, Smartphone, Loader2, Play, Trash2, WifiOff, CheckCircle2, Layers, Cpu, MousePointer2 } from "lucide-react";

import { AppState, ProcessingStatus, TimeEntry, SavedScan, ColumnConfig, FormulaType } from "./types";
import { getHistory, saveScan, deleteScan, updateScan } from "./services/storageService";
import { applyTheme, getSettings } from "./services/settingsService";
import { SyncService } from "./services/syncService";
import { extractTimeDataFromImage } from "./services/aiService";

import HomeView from "./components/HomeView";
import Scanner from "./components/Scanner";
import DataReview from "./components/DataReview";
import ExcelManager from "./components/ExcelManager";
import SettingsView, { SettingsViewHandle } from "./components/SettingsView";
import HistoryList from "./components/HistoryList";
import SyncPairing from "./components/SyncPairing";
import DebugConsole from "./components/DebugConsole";
import { InstallPrompt } from "./components/InstallPrompt";
import { UpdatePrompt } from "./components/UpdatePrompt";

type Overlay = "settings" | "history" | null;

type ConfirmState = {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
};

// Global Calculation Helper
const calculateValue = (row: TimeEntry, config: ColumnConfig, index: number): string => {
    const { formula, paramA, paramB, staticValue } = config;
    if (formula === 'none') return row[config.key] || '';
    if (formula === 'static') return staticValue;
    
    if (formula === 'increment') {
        const step = parseFloat(paramA) || 1;
        if (paramB === 'date') {
            const parts = staticValue.replace(/[\.-]/g, '/').split('/');
            if (parts.length === 3) {
                let d = parseInt(parts[0], 10);
                let m = parseInt(parts[1], 10) - 1;
                let y = parseInt(parts[2], 10);
                if (y < 100) y += 2000;
                const dateObj = new Date(y, m, d);
                if (!isNaN(dateObj.getTime())) {
                    dateObj.setDate(dateObj.getDate() + (index * step));
                    return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
                }
            }
            return staticValue;
        } else {
            const start = parseFloat(staticValue) || 0;
            return String(start + (index * step));
        }
    }

    const valA = row[paramA] || '';
    const valB = row[paramB] || '';

    if (formula === 'concat') return `${valA} ${valB}`.trim();

    const toMins = (t: string) => {
        if (!t || !t.includes(':')) return NaN;
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };
    
    const minsA = toMins(valA);
    const minsB = toMins(valB);

    if (isNaN(minsA) || isNaN(minsB)) return '';

    let resultMins = 0;
    if (formula === 'diff') resultMins = minsB - minsA;
    else if (formula === 'sum') resultMins = minsA + minsB;

    if (isNaN(resultMins)) return '';
    const h = Math.floor(Math.abs(resultMins) / 60);
    const m = Math.floor(Math.abs(resultMins) % 60);
    const sign = resultMins < 0 ? '-' : '';
    return `${sign}${h}:${m.toString().padStart(2, '0')}`;
};

export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.HOME);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [history, setHistory] = useState<SavedScan[]>([]);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>("idle");
  const [isAppending, setIsAppending] = useState(false);
  const [scanSessionId, setScanSessionId] = useState(0);
  const [currentScanId, setCurrentScanId] = useState<string | null>(null);

  const [syncService, setSyncService] = useState<SyncService | null>(null);
  const [syncStatus, setSyncStatus] = useState("");
  const [syncConnected, setSyncConnected] = useState(false);
  
  const [remoteImages, setRemoteImages] = useState<string[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [currentProcessIndex, setCurrentProcessIndex] = useState(-1);
  const [preloadedOfflineImage, setPreloadedOfflineImage] = useState<string | null>(null);

  const [confirm, setConfirm] = useState<ConfirmState>({
    open: false,
    title: "",
    message: "",
  });
  const pendingActionRef = useRef<null | (() => void)>(null);
  const settingsRef = useRef<SettingsViewHandle>(null);

  useEffect(() => {
    applyTheme();
  }, []);

  const requestConfirm = useCallback(
    (cfg: Omit<ConfirmState, "open">, onConfirm: () => void) => {
      pendingActionRef.current = onConfirm;
      setConfirm({ open: true, ...cfg });
    },
    []
  );

  const closeConfirm = useCallback(() => {
    pendingActionRef.current = null;
    setConfirm({ open: false, title: "", message: "" });
  }, []);

  const acceptConfirm = useCallback(() => {
    const action = pendingActionRef.current;
    closeConfirm();
    if (action) action();
  }, [closeConfirm]);

  useEffect(() => {
    setHistory(getHistory());
  }, [overlay, appState]);

  const safeNavigate = (action: () => void) => {
      if (overlay === "settings" && settingsRef.current) {
          settingsRef.current.attemptClose(() => {
              setOverlay(null);
              action();
          });
      } else {
          action();
      }
  };

  const isBusy = processingStatus === "processing";

  const doStartNewScan = useCallback(() => {
    setOverlay(null);
    setIsAppending(false);
    setEntries([]);
    setColumnConfigs([]);
    setColumnOrder([]);
    setCurrentScanId(null);
    setPreloadedOfflineImage(null);
    setProcessingStatus("idle");
    setScanSessionId(Date.now());
    setAppState(AppState.SCANNING);
  }, []);

  const doGoHomeAndClear = useCallback(() => {
    setEntries([]);
    setColumnConfigs([]);
    setColumnOrder([]);
    setCurrentScanId(null);
    if (syncService) {
        syncService.destroy();
        setSyncService(null);
    }
    setAppState(AppState.HOME);
  }, [syncService]);

  const startNewScan = useCallback(() => {
    safeNavigate(() => {
        if (isBusy) return;
        if (entries.length > 0 && appState !== AppState.HOME) {
          requestConfirm(
            { title: "Start a new scan?", message: "Your current session will be cleared.", confirmText: "Start New Scan", cancelText: "Cancel" },
            () => doStartNewScan()
          );
          return;
        }
        setAppState(AppState.MODALITY_SELECTION);
    });
  }, [isBusy, entries.length, appState, requestConfirm, doStartNewScan, overlay]);

  const scanMore = useCallback(() => {
    if (isBusy) return;
    setOverlay(null);
    setIsAppending(true);
    setProcessingStatus("idle");
    if (syncService) setAppState(AppState.SYNC_HOST);
    else setAppState(AppState.SCANNING);
  }, [isBusy, syncService]);

  const goBack = useCallback(() => {
    safeNavigate(() => {
        if (isBusy) return;
        if (overlay) { setOverlay(null); return; }
        if (appState === AppState.EXPORT) { setAppState(AppState.REVIEW); return; }
        if (appState === AppState.MODALITY_SELECTION) { setAppState(AppState.HOME); return; }
        if (appState === AppState.SYNC_HOST || appState === AppState.SYNC_CLIENT) {
            setAppState(AppState.MODALITY_SELECTION);
            syncService?.destroy();
            setSyncService(null);
            return;
        }
        if (appState === AppState.REVIEW) {
          if (entries.length > 0) {
            requestConfirm(
              { title: "Return to Home?", message: "Current session will be cleared.", confirmText: "Go Home", cancelText: "Stay" },
              () => doGoHomeAndClear()
            );
          } else { setAppState(AppState.HOME); }
          return;
        }
        if (appState === AppState.SCANNING) {
          if (syncService) { setAppState(AppState.SYNC_CLIENT); return; }
          setAppState(AppState.HOME);
          return;
        }
    });
  }, [appState, overlay, isBusy, entries.length, requestConfirm, doGoHomeAndClear, syncService]);

  const applyFormulas = (data: TimeEntry[], configs: ColumnConfig[]): TimeEntry[] => {
      if (configs.length === 0) return data;
      return data.map((row, index) => {
          const newRow = { ...row };
          configs.forEach(cfg => {
              if (cfg.formula !== 'none') {
                  newRow[cfg.key] = calculateValue(row, cfg, index);
              }
          });
          return newRow;
      });
  };

  const handleScanSuccess = useCallback(
    (newEntries: TimeEntry[]) => {
      setProcessingStatus("success");
      
      let merged: TimeEntry[];
      
      // Smart Merge Logic: Sort by date and overwrite existing dates
      if (isAppending && entries.length > 0) {
          const getTimestamp = (d: string) => {
              if (!d) return null;
              // Clean and parse DD/MM/YYYY or DD-MM-YYYY
              const clean = d.trim().replace(/[\.-]/g, '/');
              const parts = clean.split('/');
              if (parts.length !== 3) return null;
              
              const day = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10) - 1;
              let year = parseInt(parts[2], 10);
              
              // Handle 2-digit years assuming 2000s
              if (year < 100) year += 2000;
              
              const date = new Date(year, month, day);
              return isNaN(date.getTime()) ? null : date.getTime();
          };

          const validMap = new Map<number, TimeEntry>();
          const invalidList: TimeEntry[] = [];

          // Helper to process list
          const process = (list: TimeEntry[]) => {
              list.forEach(e => {
                  const ts = getTimestamp(e.date);
                  if (ts !== null) {
                      validMap.set(ts, e); // Will overwrite if exists (New overwrites Old)
                  } else {
                      invalidList.push(e);
                  }
              });
          };

          // 1. Process existing entries
          process(entries);

          // 2. Process new entries (this ensures new data updates old data for same date)
          process(newEntries);

          // 3. Sort valid dates chronologically
          const sorted = Array.from(validMap.entries())
              .sort((a, b) => a[0] - b[0])
              .map(x => x[1]);
          
          // 4. Append invalid/non-date entries at the end
          merged = [...sorted, ...invalidList];
      } else {
          // If not appending, or if list was empty, just use the new data
          merged = isAppending ? [...entries, ...newEntries] : newEntries;
      }
      
      const updatedWithFormulas = applyFormulas(merged, columnConfigs);
      setEntries(updatedWithFormulas);

      if (currentScanId) {
           updateScan(currentScanId, updatedWithFormulas, columnConfigs);
      } else {
           const saved = saveScan(updatedWithFormulas, columnConfigs);
           setCurrentScanId(saved.id);
      }
      
      setIsAppending(false);
      setAppState(AppState.REVIEW);
    },
    [isAppending, currentScanId, entries, columnConfigs]
  );
  
  const handleLoadHistory = useCallback((scan: SavedScan) => {
    setEntries(scan.entries);
    setColumnConfigs(scan.columnConfigs || []);
    setColumnOrder(scan.columnOrder || []);
    setCurrentScanId(scan.id);
    setAppState(AppState.REVIEW);
    setOverlay(null);
  }, []);

  const handleDeleteHistory = useCallback((id: string) => {
    deleteScan(id);
    setHistory(getHistory());
    if (id === currentScanId) {
        setCurrentScanId(null);
        setEntries([]);
        setColumnConfigs([]);
        setColumnOrder([]);
        setAppState(AppState.HOME);
    }
  }, [currentScanId]);

  const handleEntriesUpdate = (updatedEntries: TimeEntry[], updatedConfigs?: ColumnConfig[], updatedOrder?: string[]) => {
      const finalConfigs = updatedConfigs || columnConfigs;
      const finalOrder = updatedOrder || columnOrder;
      const calculated = applyFormulas(updatedEntries, finalConfigs);
      
      setEntries(calculated);
      if (updatedConfigs) setColumnConfigs(updatedConfigs);
      if (updatedOrder) setColumnOrder(updatedOrder);

      if (currentScanId) {
          updateScan(currentScanId, calculated, finalConfigs, finalOrder);
      } else {
          const saved = saveScan(calculated, finalConfigs, finalOrder);
          setCurrentScanId(saved.id);
      }
  };

  const processBatchImagesWithAI = async () => {
      if (selectedIndices.length === 0) return;
      setProcessingStatus("processing");
      const results: TimeEntry[] = [];
      const imagesToProcess = selectedIndices.map(idx => remoteImages[idx]);
      
      for (let i = 0; i < imagesToProcess.length; i++) {
          setCurrentProcessIndex(selectedIndices[i]);
          setSyncStatus(`Analyzing page ${i + 1} of ${imagesToProcess.length}...`);
          try {
              const res = await extractTimeDataFromImage(imagesToProcess[i], (s) => setSyncStatus(s), getSettings());
              results.push(...res.entries);
          } catch (e: any) {
              setSyncStatus(`Error: ${e.message}`);
              setProcessingStatus("error");
              setCurrentProcessIndex(-1);
              return; 
          }
      }
      
      setRemoteImages(prev => prev.filter((_, idx) => !selectedIndices.includes(idx)));
      setSelectedIndices([]);
      setCurrentProcessIndex(-1);
      handleScanSuccess(results);
  };

  const handleOfflineAnalysis = () => {
      if (selectedIndices.length === 0) return;
      const imageToProcess = remoteImages[selectedIndices[0]];
      setPreloadedOfflineImage(imageToProcess);
      setAppState(AppState.SCANNING);
  };

  const toggleSelection = (idx: number) => {
      if (isBusy) return;
      setSelectedIndices(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  };

  const handleHostConnect = (service: SyncService) => {
      setSyncService(service);
      setSyncConnected(true);
      setSyncStatus("Phone Connected!");
  };

  const handleClientConnect = (service: SyncService) => {
      setSyncService(service);
      setSyncConnected(true);
      setAppState(AppState.SCANNING);
  };
  
  const onSyncStatusChange = (msg: string, connected: boolean) => {
      setSyncStatus(msg);
      setSyncConnected(connected);
  };
  
  const onSyncDataReceived = (data: any) => {
      if (data.type === 'IMAGE_DATA' && data.payload.image) {
          setRemoteImages(prev => [...prev, data.payload.image]);
          setSyncStatus("New image received!");
          setTimeout(() => setSyncStatus("Ready for next photo."), 2000);
      }
  };

  const title = useMemo(() => {
    if (overlay === "settings") return "Preferences";
    if (overlay === "history") return "History";
    if (appState === AppState.HOME) return "TimeSnap";
    if (appState === AppState.MODALITY_SELECTION) return "Choose Workflow";
    if (appState === AppState.SCANNING) return syncService ? "Remote Scan" : "Scanning";
    if (appState === AppState.REVIEW) return "Review";
    if (appState === AppState.EXPORT) return "Export";
    if (appState === AppState.SYNC_HOST) return "Desktop Station";
    if (appState === AppState.SYNC_CLIENT) return "Mobile Scanner";
    return "TimeSnap";
  }, [appState, overlay, syncService]);

  const settings = getSettings();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-10 transition-colors duration-200">
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm h-16 flex items-center px-4">
        <div className="w-full max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            {(appState !== AppState.HOME || overlay) && (
              <button onClick={goBack} disabled={isBusy} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 disabled:opacity-50"><ArrowLeft className="w-5 h-5" /></button>
            )}
            <span className="font-semibold text-slate-800 dark:text-white text-lg">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            {!syncService && appState === AppState.HOME && (
                <button onClick={startNewScan} disabled={isBusy} className="flex items-center gap-2 bg-slate-800 dark:bg-blue-600 hover:bg-slate-700 dark:hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-medium transition-colors shadow-sm text-sm disabled:opacity-50"><RotateCcw className="w-4 h-4" /><span className="hidden sm:inline">New Session</span></button>
            )}
            <button onClick={() => safeNavigate(() => setOverlay("history"))} className={`p-2 rounded-lg transition-colors ${overlay === "history" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}><History className="w-5 h-5" /></button>
            <button onClick={() => safeNavigate(() => setOverlay("settings"))} className={`p-2 rounded-lg transition-colors ${overlay === "settings" ? "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-white" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}><Settings className="w-5 h-5" /></button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-[1600px] mx-auto relative">
        {overlay === "settings" && (
            <div className="fixed inset-0 top-16 z-40 bg-slate-50 dark:bg-slate-950 flex flex-col">
                <div className="max-w-[1600px] mx-auto w-full flex-1 overflow-hidden flex flex-col">
                    <SettingsView ref={settingsRef} onClose={() => setOverlay(null)} />
                </div>
            </div>
        )}
        {overlay === "history" && (
            <div className="fixed inset-0 top-16 z-40 bg-slate-50 dark:bg-slate-950 overflow-y-auto">
                <div className="max-w-[1600px] mx-auto min-h-full p-4">
                    <HistoryList history={history} onSelect={handleLoadHistory} onDelete={handleDeleteHistory} />
                </div>
            </div>
        )}

        <div className={overlay ? "hidden" : "block"}>
          {appState === AppState.HOME && (<HomeView onStart={startNewScan} />)}
          {appState === AppState.MODALITY_SELECTION && (<HomeView onStart={startNewScan} showModalityModal={true} onSelectLocal={doStartNewScan} onSelectHost={() => setAppState(AppState.SYNC_HOST)} onSelectClient={() => setAppState(AppState.SYNC_CLIENT)} onCancel={() => setAppState(AppState.HOME)} />)}
          
          {appState === AppState.SYNC_HOST && (
              <div className="p-4 space-y-6 animate-fade-in">
                  {!syncService || (!syncConnected && remoteImages.length === 0) ? (
                      <div className="flex justify-center pt-8">
                        <SyncPairing mode="host" onConnect={handleHostConnect} onCancel={() => setAppState(AppState.MODALITY_SELECTION)} />
                      </div>
                  ) : (
                      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                          <div className="flex items-center justify-between mb-6">
                              <div className="flex items-center gap-3">
                                  <div className={`p-3 rounded-xl ${syncConnected ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                      {syncConnected ? <Smartphone className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />}
                                  </div>
                                  <div>
                                      <h3 className="font-bold text-slate-800 dark:text-white">{syncConnected ? "Phone Connected" : "Connection Lost"}</h3>
                                      <p className="text-xs text-slate-500">{syncConnected ? "Taking photos from phone inbox" : "Check phone connection"}</p>
                                  </div>
                              </div>
                              <button onClick={() => { syncService.destroy(); setSyncService(null); setAppState(AppState.HOME); }} className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors">DISCONNECT STATION</button>
                          </div>

                          <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                      <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Remote Inbox ({remoteImages.length})</h4>
                                      {selectedIndices.length > 0 && (
                                          <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">{selectedIndices.length} Selected</span>
                                      )}
                                  </div>
                                  <div className="flex items-center gap-3">
                                      <button onClick={() => setSelectedIndices(selectedIndices.length === remoteImages.length ? [] : remoteImages.map((_, i) => i))} className="text-xs text-blue-600 hover:underline font-medium">{selectedIndices.length === remoteImages.length ? "Deselect All" : "Select All"}</button>
                                      <button disabled={remoteImages.length === 0} onClick={() => {setRemoteImages([]); setSelectedIndices([])}} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 disabled:opacity-50"><Trash2 className="w-3 h-3" /> Clear Inbox</button>
                                  </div>
                              </div>
                              
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 min-h-[120px]">
                                  {remoteImages.map((img, i) => (
                                      <div key={i} onClick={() => toggleSelection(i)} className={`relative aspect-[3/4] bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${selectedIndices.includes(i) ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600 shadow-sm'} ${currentProcessIndex === i ? 'animate-pulse' : ''}`}>
                                          <img src={img} alt="" className={`w-full h-full object-cover ${selectedIndices.includes(i) ? 'opacity-90' : 'opacity-100'}`} />
                                          <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedIndices.includes(i) ? 'bg-blue-500 border-blue-500' : 'bg-black/20 border-white/50'}`}>{selectedIndices.includes(i) && <CheckCircle2 className="w-4 h-4 text-white" />}</div>
                                          {currentProcessIndex === i && <div className="absolute inset-0 bg-blue-500/30 flex items-center justify-center backdrop-blur-[2px]"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}
                                      </div>
                                  ))}
                                  {remoteImages.length === 0 && (<div className="col-span-full py-16 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-400"><Monitor className="w-12 h-12 mb-3 opacity-20" /><p className="text-sm font-medium">Waiting for images...</p><p className="text-xs opacity-60">Snap photos on your phone</p></div>)}
                              </div>

                              <div className="pt-4 flex flex-col gap-3">
                                  <div className={`p-3 rounded-xl border flex items-center justify-center text-sm font-medium transition-colors ${processingStatus === 'error' ? 'bg-red-50 border-red-100 text-red-600' : processingStatus === 'success' ? 'bg-green-50 border-green-100 text-green-600' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                                      {isBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                      {syncStatus || "Standing by"}
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                      <button onClick={handleOfflineAnalysis} disabled={selectedIndices.length === 0 || isBusy} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"><Layers className="w-5 h-5" /> Manual / Offline</button>
                                      <button onClick={processBatchImagesWithAI} disabled={selectedIndices.length === 0 || isBusy} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-all"><Cpu className="w-5 h-5" /> AI Analysis</button>
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}
              </div>
          )}

          {appState === AppState.SYNC_CLIENT && (<div className="pt-8 px-4"><SyncPairing mode="client" onConnect={handleClientConnect} onCancel={() => setAppState(AppState.MODALITY_SELECTION)} /></div>)}

          {appState === AppState.SCANNING && (
              <Scanner 
                key={scanSessionId} 
                onDataExtracted={handleScanSuccess} 
                onImageCaptured={(b64) => syncService?.send({ type: 'IMAGE_DATA', payload: { image: b64 } })} 
                onDisconnect={() => setAppState(AppState.SYNC_CLIENT)}
                isAppending={isAppending} 
                remoteMode={!!syncService} 
                isConnected={syncConnected}
                {...(preloadedOfflineImage ? { initialImage: preloadedOfflineImage } : {})}
              />
          )}

          {appState === AppState.REVIEW && (<DataReview key={currentScanId || 'new'} data={entries} configs={columnConfigs} initialColumnOrder={columnOrder} onUpdate={handleEntriesUpdate} onNext={() => setAppState(AppState.EXPORT)} onScanMore={scanMore} onRequestConfirm={requestConfirm} />)}
          {appState === AppState.EXPORT && (<div className="animate-slide-up pt-8 px-4"><ExcelManager key={currentScanId || 'new'} data={entries} configs={columnConfigs} columnOrder={columnOrder} onBack={() => setAppState(AppState.REVIEW)} onScanMore={scanMore} onHome={() => requestConfirm({ title: "Return Home", message: "Finish export session?", confirmText: "Yes, Done" }, doGoHomeAndClear)} /></div>)}
        </div>
      </main>

      {syncService && (<SyncHandlerBridge service={syncService} onData={onSyncDataReceived} onStatus={onSyncStatusChange} />)}
      {settings.debugMode && <DebugConsole />}
      <InstallPrompt />
      <UpdatePrompt />

      {confirm.open && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-start gap-3"><div className="mt-0.5 text-amber-600"><AlertTriangle className="w-5 h-5" /></div><div className="flex-1"><div className="font-bold text-slate-900 dark:text-white">{confirm.title}</div><div className="text-sm text-slate-600 dark:text-slate-400 mt-1">{confirm.message}</div></div><button onClick={closeConfirm} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5 text-slate-500 dark:text-slate-400" /></button></div>
            <div className="p-5 flex gap-3 justify-end"><button onClick={closeConfirm} className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">{confirm.cancelText ?? "Cancel"}</button><button onClick={acceptConfirm} className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors">{confirm.confirmText ?? "OK"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

const SyncHandlerBridge = ({ service, onData, onStatus }: { service: SyncService, onData: any, onStatus: any }) => {
    useEffect(() => {
        (service as any).onDataReceived = onData;
        (service as any).onStatusChange = onStatus;
    }, [service, onData, onStatus]);
    return null;
}
