
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Loader2, AlertCircle, Wifi, WifiOff, Layers, Bug, CheckCircle, X, SwitchCamera, Key, ExternalLink, Smartphone, Check, Grid3X3, Target, Settings2, ChevronDown } from 'lucide-react';
import { extractTimeDataFromImage } from '../services/aiService';
import { performOCR, mapWordsToEntries } from '../services/offlineService';
import { performPerspectiveWarp } from '../services/imageProcessing';
import { getSettings, saveSettings } from '../services/settingsService';
import { TimeEntry, ProcessingStatus, ScanResult, OfflineScanData, Point, AppSettings, AIProvider, OCRAlgorithm } from '../types';
import ColumnAdjuster from './ColumnAdjuster';
import CropEditor from './CropEditor';
import SettingsView from './SettingsView';

interface ScannerProps {
  onDataExtracted: (data: TimeEntry[]) => void;
  onImageCaptured?: (base64: string) => void; 
  onDisconnect?: () => void;
  isAppending?: boolean;
  remoteMode?: boolean; 
  isConnected?: boolean;
  initialImage?: string; 
}

const Scanner: React.FC<ScannerProps> = ({ 
    onDataExtracted, 
    onImageCaptured, 
    onDisconnect,
    isAppending = false, 
    remoteMode = false,
    isConnected = true,
    initialImage
}) => {
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  
  const [showSettings, setShowSettings] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [offlineScanData, setOfflineScanData] = useState<OfflineScanData | null>(null);
  const [debugResult, setDebugResult] = useState<ScanResult | null>(null);
  const [pendingEntries, setPendingEntries] = useState<TimeEntry[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [settings, setSettings] = useState<AppSettings>(getSettings());

  // Camera Stream Logic
  useEffect(() => {
      let stream: MediaStream | null = null;
      
      if (isCameraActive && videoRef.current) {
          setCameraError(null);
          const startCamera = async () => {
              try {
                  stream = await navigator.mediaDevices.getUserMedia({ 
                      video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } } 
                  });
                  if (videoRef.current) {
                      videoRef.current.srcObject = stream;
                  }
              } catch (err: any) {
                  console.error("Camera access failed:", err);
                  if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                      setCameraError("Camera access was denied. Please click the lock icon 🔒 in your browser's address bar to allow access, or refresh the page to reset permissions.");
                  } else {
                      setCameraError("Could not access camera. Please check your device permissions.");
                  }
                  setIsCameraActive(false);
              }
          };
          startCamera();
      }

      return () => {
          if (stream) {
              stream.getTracks().forEach(track => track.stop());
          }
      };
  }, [isCameraActive]);

  useEffect(() => {
      if (initialImage) {
          setTimeout(() => processBase64(initialImage, true), 500);
      }
  }, [initialImage]);

  useEffect(() => {
      if (remoteMode && !isConnected && onDisconnect) {
          onDisconnect();
      }
  }, [isConnected, remoteMode, onDisconnect]);

  // Refresh settings when modal closes
  const handleSettingsClose = () => {
      setShowSettings(false);
      setSettings(getSettings());
      setError(null);
  };

  const handleProviderChange = (provider: AIProvider) => {
      const newSettings = { ...settings, activeProvider: provider };
      saveSettings(newSettings);
      setSettings(newSettings);
  };

  const processBase64 = async (base64String: string, forceOffline: boolean = false) => {
      // CRITICAL FIX: Always fetch latest settings from storage before processing.
      // This ensures that if the user just updated the API key in SettingsView, we use the new one immediately.
      const currentSettings = getSettings();
      setSettings(currentSettings); // Keep UI in sync

      setStatus('processing');
      setError(null);
      setProgressMessage("Analyzing image...");

      setTimeout(async () => {
          try {
            if (remoteMode && onImageCaptured && !isOfflineMode && !forceOffline) {
                onImageCaptured(base64String);
                setStatus('success');
                setTimeout(() => setStatus('idle'), 1500);
                return;
            }

            if (isOfflineMode || forceOffline) {
                 setCropImageSrc(base64String);
                 setStatus('idle');
            } else {
                // Check if key exists before starting
                const currentProvider = currentSettings.activeProvider;
                const keyField = `${currentProvider}ApiKey` as keyof AppSettings;
                if (!currentSettings[keyField]) {
                    throw new Error(`Missing API Key for ${currentProvider.toUpperCase()}`);
                }

                const result = await extractTimeDataFromImage(base64String, (msg) => setProgressMessage(msg), currentSettings);
                
                // Debug Mode Handling: Log result but DO NOT stop flow
                if (currentSettings.debugMode) {
                    console.debug("[TimeSnap Debug] AI Result:", result);
                    setDebugResult(result);
                }
                
                if (result.entries.length === 0) {
                    setError("No data found.");
                    setStatus('error');
                } else {
                    setStatus('success');
                    onDataExtracted(result.entries);
                }
            }
          } catch (err: any) {
            console.error(err);
            setError(err.message || "Processing failed.");
            setStatus('error');
          }
      }, 50);
  };

  const handleCropConfirm = async (corners: Point[]) => {
      if (!cropImageSrc) return;
      setCropImageSrc(null); 
      setStatus('processing');
      setProgressMessage("Straightening image...");

      setTimeout(async () => {
          try {
              const processedImage = await performPerspectiveWarp(cropImageSrc, corners);
              const rawData = await performOCR(processedImage, (msg) => setProgressMessage(msg));
              setOfflineScanData(rawData);
              setStatus('idle');
          } catch (err) {
              setError("Failed to flatten image.");
              setStatus('error');
          }
      }, 50);
  };

  const handleRedoOCR = async (tunedImg: string, algo: OCRAlgorithm) => {
      setStatus('processing');
      setProgressMessage(`Re-running ${algo} OCR...`);
      setTimeout(async () => {
          try {
              const rawData = await performOCR(tunedImg, (msg) => setProgressMessage(msg), algo);
              setOfflineScanData(rawData);
              setStatus('idle');
          } catch (err) {
              setError("Manual re-scan failed.");
              setStatus('error');
          }
      }, 50);
  };

  const handleOfflineConfirm = (columns: number[]) => {
      if (!offlineScanData) return;
      try {
          // Note: mapWordsToEntries also uses settings, so we pass current state
          const result = mapWordsToEntries(offlineScanData, columns, settings);
          setOfflineScanData(null);
          onDataExtracted(result.entries);
      } catch (e) {
          setError("Mapping failed.");
          setStatus('error');
      }
  };

  // Handler for the new Grid-Based pipeline
  const handleGridConfirm = (entries: TimeEntry[]) => {
      setOfflineScanData(null);
      if (entries.length === 0) {
          setError("No valid grid data found.");
          setStatus('error');
      } else {
          onDataExtracted(entries);
      }
  };

  if (showSettings) {
      return (
          <div className="fixed inset-0 z-[60] bg-slate-50 dark:bg-slate-950 overflow-auto">
              <SettingsView onClose={handleSettingsClose} />
          </div>
      );
  }

  if (isCameraActive) {
      return (
          <div className="fixed inset-0 z-50 bg-black flex flex-col animate-fade-in">
              <video ref={videoRef} autoPlay playsInline className="flex-1 w-full h-full object-cover" />
              <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-6">
                   <button onClick={() => setIsCameraActive(false)} className="p-4 bg-white/20 rounded-full text-white"><X /></button>
                   <button onClick={() => {
                       const canvas = document.createElement('canvas');
                       canvas.width = videoRef.current!.videoWidth;
                       canvas.height = videoRef.current!.videoHeight;
                       canvas.getContext('2d')!.drawImage(videoRef.current!, 0, 0);
                       setIsCameraActive(false);
                       processBase64(canvas.toDataURL('image/jpeg'));
                   }} className="w-20 h-20 bg-white rounded-full border-4 border-slate-300" />
              </div>
          </div>
      );
  }

  if (cropImageSrc) return <CropEditor imageSrc={cropImageSrc} onConfirm={handleCropConfirm} onCancel={() => setCropImageSrc(null)} />;
  if (offlineScanData) return <ColumnAdjuster scanData={offlineScanData} onConfirm={handleOfflineConfirm} onConfirmGrid={handleGridConfirm} onCancel={() => setOfflineScanData(null)} onRedoOCR={handleRedoOCR} />;

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 mx-4 mt-8">
      <div className="text-center">
        <h2 className="text-2xl font-black text-slate-800 dark:text-white">Scan Timesheet</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Choose AI for speed or Offline for precision.</p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
          {/* Mode Switcher */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 w-full">
              <button onClick={() => setIsOfflineMode(false)} className={`flex-1 flex items-center justify-center py-2 rounded-lg text-xs font-black transition-all ${!isOfflineMode ? 'bg-white dark:bg-slate-700 shadow-md text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}><Wifi className="w-4 h-4 mr-2" />AI MODE</button>
              <button onClick={() => setIsOfflineMode(true)} className={`flex-1 flex items-center justify-center py-2 rounded-lg text-xs font-black transition-all ${isOfflineMode ? 'bg-white dark:bg-slate-700 shadow-md text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}><WifiOff className="w-4 h-4 mr-2" />OFFLINE</button>
          </div>

          {/* AI Provider Selector (Only in AI Mode) */}
          {!isOfflineMode && (
              <div className="relative group">
                  <select 
                    value={settings.activeProvider} 
                    onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
                    className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2 px-4 pr-8 rounded-lg text-xs font-bold uppercase tracking-wider outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-center"
                  >
                      <option value="gemini">Google Gemini</option>
                      <option value="openai">OpenAI GPT-4o</option>
                      <option value="claude">Anthropic Claude</option>
                      <option value="mistral">Mistral AI</option>
                      <option value="groq">Groq (Fast Llama)</option>
                      <option value="qwen">Alibaba Qwen</option>
                      <option value="openrouter">OpenRouter</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
          )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-md">
        <button onClick={() => setIsCameraActive(true)} className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group">
            <Camera className="w-10 h-10 text-blue-600 mb-2 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-slate-700 dark:text-slate-300">Camera</span>
        </button>
        <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group cursor-pointer">
            <input type="file" accept="image/*" onChange={(e) => {
                const file = e.target.files?.[0];
                if(file) {
                    const reader = new FileReader();
                    reader.onload = () => processBase64(reader.result as string);
                    reader.readAsDataURL(file);
                }
            }} className="hidden" />
            <Upload className="w-10 h-10 text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-slate-700 dark:text-slate-300">Upload</span>
        </label>
      </div>

      {cameraError && (
          <div className="w-full max-w-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-xl text-center animate-fade-in">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <h3 className="font-bold text-amber-700 dark:text-amber-400 mb-1">Camera Blocked</h3>
              <p className="text-sm text-amber-600 dark:text-amber-300 mb-4">{cameraError}</p>
              <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 transition-colors"
                  >
                      Reload Page to Show Prompt Again
                  </button>
                  <button 
                    onClick={() => setIsCameraActive(true)}
                    className="px-4 py-2 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-bold hover:bg-amber-100 dark:hover:bg-amber-800 transition-colors"
                  >
                      I've enabled it, try again
                  </button>
              </div>
          </div>
      )}

      {status !== 'idle' && status !== 'error' && (
        <div className="flex flex-col items-center animate-fade-in">
            {status === 'processing' ? <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" /> : <CheckCircle className="w-8 h-8 text-green-500 mb-2" />}
            <p className="text-sm font-bold text-slate-600 dark:text-slate-400">{progressMessage || status}</p>
        </div>
      )}

      {status === 'error' && error && (
          <div className="w-full max-w-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl text-center animate-fade-in">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <h3 className="font-bold text-red-600 dark:text-red-400 mb-1">Scanning Failed</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">{error}</p>
              
              <div className="flex gap-2 justify-center">
                  <button 
                    onClick={() => setIsOfflineMode(true)}
                    className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                      Try Offline Mode
                  </button>
                  <button 
                    onClick={() => setShowSettings(true)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 flex items-center"
                  >
                      <Settings2 className="w-4 h-4 mr-2" />
                      Configure API Key
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};

export default Scanner;
