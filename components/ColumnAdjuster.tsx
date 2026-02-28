
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { MoveHorizontal, Check, Plus, Trash2, X, Calendar, MoveVertical, FlaskConical, Sliders, Target, Sparkles, Zap, Grid, Layers, Cpu, Maximize } from 'lucide-react';
import { OfflineScanData, OCRWord, OCRAlgorithm, RegionOfInterest, OCRStrategy, OCREngine } from '../types';
import { applyTuningToCanvas, ImageTuningParams, detectRowSeparators } from '../services/imageProcessing';
import { performGridScan } from '../services/advancedOfflineService';
import { performOCR } from '../services/offlineService';
import { getSettings } from '../services/settingsService';

interface ColumnAdjusterProps {
  scanData: OfflineScanData;
  onConfirm: (columnXs: number[]) => void;
  onConfirmGrid?: (result: any) => void;
  onCancel: () => void;
  onRedoOCR: (tunedImg: string, algo: OCRAlgorithm) => void;
}

const COLUMN_COLORS = [
  'rgba(34, 197, 94, 0.4)',    // Green (Date)
  'rgba(59, 130, 246, 0.4)',   // Blue (Entrance)
  'rgba(168, 85, 247, 0.4)',   // Purple (Lunch Start)
  'rgba(245, 158, 11, 0.4)',   // Amber (Lunch End)
  'rgba(99, 102, 241, 0.4)',   // Indigo (Exit)
  'rgba(236, 72, 153, 0.4)',   // Pink (Misc)
];

const ColumnAdjuster: React.FC<ColumnAdjusterProps> = ({ scanData: initialScanData, onConfirm, onConfirmGrid, onCancel }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // We maintain local state for scan data because Advanced Lab might update it
  const [scanData, setScanData] = useState<OfflineScanData>(initialScanData);

  // Strategy State
  const [strategy, setStrategy] = useState<OCRStrategy>('page_scan');
  const [engine, setEngine] = useState<OCREngine>('tesseract');
  const [isProcessing, setIsProcessing] = useState(false);
  const [procMessage, setProcMessage] = useState("");

  // Grid State
  const [columns, setColumns] = useState<number[]>([]);
  const [rows, setRows] = useState<number[]>([]);
  const [editMode, setEditMode] = useState<'cols' | 'rows'>('cols');
  const [draggingLine, setDraggingLine] = useState<number | null>(null);
  
  // Advanced Lab State
  const [showLab, setShowLab] = useState(false);
  const [algorithm, setAlgorithm] = useState<OCRAlgorithm>('neural');
  const [zones, setZones] = useState<RegionOfInterest[]>([]);
  const [isZoning, setIsZoning] = useState(false);
  const [startPos, setStartPos] = useState<{x: number, y: number} | null>(null);
  const [currentRect, setCurrentRect] = useState<RegionOfInterest | null>(null);
  
  const [tuning, setTuning] = useState<ImageTuningParams>({
      brightness: 0,
      contrast: 15,
      sharpen: true,
      grayscale: true,
      binarize: true
  });

  // Initialization: Populate Grid from Smart Detection
  useEffect(() => {
    // 1. Columns
    if (scanData.suggestedColumns && scanData.suggestedColumns.length > 0) {
      setColumns([...scanData.suggestedColumns].slice(0, 5).sort((a, b) => a - b));
    } else {
      const w = scanData.imageWidth;
      setColumns([w * 0.25, w * 0.4, w * 0.55, w * 0.7, w * 0.85]);
    }

    // 2. Rows (If available in scanData)
    if (scanData.suggestedRows && scanData.suggestedRows.length > 0) {
        setRows(scanData.suggestedRows);
    } else if (strategy === 'grid_cell' && rows.length === 0) {
        // Fallback: Run detection if not present
        detectRowSeparators(scanData.base64Image).then(setRows);
    }
  }, [scanData, strategy]);

  const handlePointerDown = (index: number) => setDraggingLine(index);
  
  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingLine !== null && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const scale = scanData.imageWidth / rect.width;
        
        if (editMode === 'cols') {
            const x = e.clientX - rect.left;
            const actualX = Math.max(0, Math.min(scanData.imageWidth, x * scale));
            setColumns(prev => {
                const next = [...prev];
                next[draggingLine] = actualX;
                return next;
            });
        } else {
            const y = e.clientY - rect.top;
            const actualY = Math.max(0, Math.min(scanData.imageHeight, y * scale));
            setRows(prev => {
                const next = [...prev];
                next[draggingLine] = actualY;
                return next;
            });
        }
        return;
    }

    // Zoning Logic
    if (isZoning && startPos && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const scale = scanData.imageWidth / rect.width;
        const endX = (e.clientX - rect.left) * scale;
        const endY = (e.clientY - rect.top) * scale;

        const x = Math.min(startPos.x, endX);
        const y = Math.min(startPos.y, endY);
        const w = Math.abs(startPos.x - endX);
        const h = Math.abs(startPos.y - endY);

        setCurrentRect({ id: 'temp', x, y, w, h });
    }
  };

  const startZoning = (e: React.PointerEvent) => {
      if (!isZoning || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const scale = scanData.imageWidth / rect.width;
      const x = (e.clientX - rect.left) * scale;
      const y = (e.clientY - rect.top) * scale;
      setStartPos({ x, y });
  };

  const handlePointerUp = () => {
    setDraggingLine(null);
    if (isZoning && currentRect && currentRect.w > 5) {
        setZones(prev => [...prev, { ...currentRect, id: Date.now().toString() }]);
    }
    setStartPos(null);
    setCurrentRect(null);
    if (editMode === 'cols') setColumns(prev => [...prev].sort((a, b) => a - b));
    if (editMode === 'rows') setRows(prev => [...prev].sort((a, b) => a - b));
  };

  const handleFinish = async () => {
      if (strategy === 'page_scan') {
          onConfirm(columns);
      } else {
          if (!onConfirmGrid) return;
          setIsProcessing(true);
          try {
              const settings = getSettings();
              const result = await performGridScan(
                  scanData.base64Image, // Use the (potentially tuned) image
                  columns, 
                  rows, 
                  engine, 
                  settings, 
                  (msg) => setProcMessage(msg)
              );
              onConfirmGrid(result.entries); 
          } catch (e: any) {
              alert("Grid Scan Failed: " + e.message);
              setIsProcessing(false);
          }
      }
  };

  // Re-run the full OCR process with new visual settings
  const handleApplyAdvanced = async () => {
      setIsProcessing(true);
      setProcMessage(`Applying filters & Re-running ${algorithm} OCR...`);

      // 1. Process Image onto Canvas
      const canvas = document.createElement('canvas');
      canvas.width = scanData.imageWidth;
      canvas.height = scanData.imageHeight;
      
      const img = new Image();
      img.src = initialScanData.base64Image; // Always start from original to avoid artifact compounding
      await new Promise(r => img.onload = r);
      
      applyTuningToCanvas(canvas, tuning, zones);
      const tunedBase64 = canvas.toDataURL('image/jpeg', 0.95);

      // 2. Perform OCR on new image
      try {
          // This calls the improved performOCR which respects algorithm (PSM)
          const newData = await performOCR(tunedBase64, (msg) => setProcMessage(msg), algorithm);
          
          // 3. Update State
          setScanData(newData);
          // Auto-update columns/rows based on new data if they changed drastically
          if (newData.suggestedColumns.length > 0) setColumns(newData.suggestedColumns);
          if (newData.suggestedRows && newData.suggestedRows.length > 0) setRows(newData.suggestedRows);
          
          setIsProcessing(false);
      } catch (e: any) {
          alert("Re-processing failed: " + e.message);
          setIsProcessing(false);
      }
  };

  const wordAssignments = useMemo(() => {
    if (strategy === 'grid_cell') return [];
    const sortedCols = [...columns].sort((a, b) => a - b);
    const LEFT_REACH = scanData.imageWidth * 0.12; 
    const RIGHT_REACH = scanData.imageWidth * 0.05; 

    return scanData.words.map(word => {
        let bestColIdx = -1;
        for (let i = 0; i < sortedCols.length; i++) {
            const diff = sortedCols[i] - word.centerX;
            if (diff >= -RIGHT_REACH && diff <= LEFT_REACH) {
                bestColIdx = i;
                break;
            }
        }
        return { word, colIdx: bestColIdx };
    });
  }, [columns, scanData.words, scanData.imageWidth, strategy]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col font-sans select-none overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-slate-900 text-white flex justify-between items-center shrink-0 border-b border-slate-800 shadow-xl z-20">
         <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-900/40"><Grid className="w-5 h-5" /></div>
            <div>
                <h3 className="font-bold text-lg leading-tight">Structure & Extraction</h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                    {strategy === 'grid_cell' ? `Grid Mode (${rows.length} Rows)` : `Page Mode (${scanData.words.length} Words)`}
                </p>
            </div>
         </div>
         <div className="flex items-center gap-3">
            <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                 <button onClick={() => setStrategy('page_scan')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${strategy === 'page_scan' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                     Page Scan
                 </button>
                 <button onClick={() => { setStrategy('grid_cell'); setEditMode('rows'); }} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${strategy === 'grid_cell' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                     Grid Cell
                 </button>
            </div>
            <button 
                onClick={() => setShowLab(!showLab)} 
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all border-2 ${showLab ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
            >
                <FlaskConical className="w-4 h-4" />
            </button>
            <button onClick={onCancel} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-500"><X className="w-6 h-6" /></button>
         </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Processing Overlay */}
        {isProcessing && (
            <div className="absolute inset-0 z-[60] bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
                <h3 className="text-white font-bold text-xl">Processing...</h3>
                <p className="text-blue-400 font-mono mt-2">{procMessage}</p>
            </div>
        )}

        {/* Main Viewport */}
        <div 
            className="flex-1 relative overflow-hidden bg-black flex items-center justify-center p-8 touch-none"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onPointerDown={startZoning}
        >
            <div 
                ref={containerRef}
                className={`relative shadow-2xl bg-slate-900 border border-slate-800 transition-all ${isZoning ? 'cursor-crosshair' : 'cursor-default'}`}
                style={{ 
                    aspectRatio: `${scanData.imageWidth} / ${scanData.imageHeight}`,
                    maxHeight: '100%',
                    maxWidth: '100%'
                }}
            >
                <img 
                    src={scanData.base64Image} 
                    alt="Scan" 
                    className={`w-full h-full object-contain pointer-events-none transition-all ${showLab ? 'opacity-40' : 'opacity-80'}`} 
                />

                {/* Zones (ROI) */}
                {zones.map(z => (
                    <div 
                        key={z.id}
                        className="absolute border-2 border-dashed border-cyan-400 bg-cyan-400/20 group z-10"
                        style={{
                            left: `${(z.x / scanData.imageWidth) * 100}%`,
                            top: `${(z.y / scanData.imageHeight) * 100}%`,
                            width: `${(z.w / scanData.imageWidth) * 100}%`,
                            height: `${(z.h / scanData.imageHeight) * 100}%`,
                        }}
                    >
                        <button 
                            onClick={(e) => { e.stopPropagation(); setZones(prev => prev.filter(pz => pz.id !== z.id)); }}
                            className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                ))}

                {currentRect && (
                    <div 
                        className="absolute border-2 border-cyan-400 bg-cyan-400/10 z-10"
                        style={{
                            left: `${(currentRect.x / scanData.imageWidth) * 100}%`,
                            top: `${(currentRect.y / scanData.imageHeight) * 100}%`,
                            width: `${(currentRect.w / scanData.imageWidth) * 100}%`,
                            height: `${(currentRect.h / scanData.imageHeight) * 100}%`,
                        }}
                    />
                )}

                {/* Highlight Boxes (Only Page Mode) */}
                {strategy === 'page_scan' && wordAssignments.map(({ word, colIdx }, i) => {
                    if (colIdx === -1 || showLab) return null;
                    const color = COLUMN_COLORS[colIdx % COLUMN_COLORS.length];
                    return (
                        <div 
                            key={i}
                            className="absolute rounded-sm border border-white/5 pointer-events-none transition-all"
                            style={{
                                left: `${(word.bbox.x0 / scanData.imageWidth) * 100}%`,
                                top: `${(word.bbox.y0 / scanData.imageHeight) * 100}%`,
                                width: `${((word.bbox.x1 - word.bbox.x0) / scanData.imageWidth) * 100}%`,
                                height: `${((word.bbox.y1 - word.bbox.y0) / scanData.imageHeight) * 100}%`,
                                backgroundColor: color,
                            }}
                        />
                    );
                })}

                {/* Column Lines */}
                {(strategy === 'page_scan' || editMode === 'cols' || strategy === 'grid_cell') && columns.map((colX, idx) => (
                    <div
                        key={`col-${idx}`}
                        className={`absolute top-0 bottom-0 w-12 -ml-6 flex flex-col items-center z-30 ${editMode === 'cols' ? 'cursor-col-resize group' : 'pointer-events-none opacity-50'}`}
                        style={{ left: `${(colX / scanData.imageWidth) * 100}%`, touchAction: 'none' }}
                        onPointerDown={editMode === 'cols' ? (e) => { e.preventDefault(); handlePointerDown(idx); } : undefined}
                    >
                        <div className={`w-0.5 h-full transition-all ${editMode === 'cols' ? 'group-hover:w-1 bg-cyan-400 shadow-[0_0_10px_cyan]' : 'bg-cyan-400/50'}`} />
                        {editMode === 'cols' && (
                             <div className="absolute top-0 w-8 h-8 rounded-b-xl bg-cyan-500 flex items-center justify-center shadow-lg border border-white/20">
                                {idx === 0 ? <Calendar className="w-4 h-4 text-white" /> : <MoveHorizontal className="w-4 h-4 text-white" />}
                            </div>
                        )}
                    </div>
                ))}
                
                {/* Row Lines (Grid Mode Only) */}
                {strategy === 'grid_cell' && rows.map((rowY, idx) => (
                    <div
                        key={`row-${idx}`}
                        className={`absolute left-0 right-0 h-12 -mt-6 flex flex-row items-center z-30 ${editMode === 'rows' ? 'cursor-row-resize group' : 'pointer-events-none opacity-50'}`}
                        style={{ top: `${(rowY / scanData.imageHeight) * 100}%`, touchAction: 'none' }}
                        onPointerDown={editMode === 'rows' ? (e) => { e.preventDefault(); handlePointerDown(idx); } : undefined}
                    >
                        <div className={`h-0.5 w-full transition-all ${editMode === 'rows' ? 'group-hover:h-1 bg-purple-400 shadow-[0_0_10px_purple]' : 'bg-purple-400/50'}`} />
                         {editMode === 'rows' && (
                             <div className="absolute left-0 h-8 w-8 rounded-r-xl bg-purple-500 flex items-center justify-center shadow-lg border border-white/20">
                                <MoveVertical className="w-4 h-4 text-white" />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>

        {/* Sidebar Lab Controls */}
        {showLab && (
            <div className="w-80 bg-slate-900 border-l border-slate-800 p-6 overflow-y-auto space-y-8 animate-slide-left z-30">
                {/* 1. Algorithm Selection */}
                <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Target className="w-3 h-3" /> OCR ALGORITHM (Page Mode)
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                        {[
                            { id: 'neural', label: 'Neural AI', desc: 'Best for standard text', icon: Sparkles },
                            { id: 'sparse', label: 'Sparse Text', desc: 'Good for empty tables', icon: Cpu },
                            { id: 'raw_matrix', label: 'Matrix Mode', desc: 'Uniform block of text', icon: Zap }
                        ].map(algo => (
                            <button 
                                key={algo.id}
                                onClick={() => setAlgorithm(algo.id as OCRAlgorithm)}
                                className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all text-left ${algorithm === algo.id ? 'bg-blue-600/20 border-blue-500' : 'bg-slate-800 border-slate-700 hover:bg-slate-750'}`}
                            >
                                <algo.icon className={`w-5 h-5 mt-0.5 ${algorithm === algo.id ? 'text-blue-400' : 'text-slate-500'}`} />
                                <div>
                                    <div className={`text-xs font-bold ${algorithm === algo.id ? 'text-white' : 'text-slate-300'}`}>{algo.label}</div>
                                    <div className="text-[9px] text-slate-500">{algo.desc}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 2. Image Tuning */}
                <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Sliders className="w-3 h-3" /> Image Cleanup
                    </h4>
                    
                    <div className="space-y-6">
                         <div className="space-y-2">
                            <label className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl cursor-pointer hover:bg-slate-800 transition-colors">
                                <span className="text-xs font-bold text-slate-300">Auto Binarize (B/W)</span>
                                <input type="checkbox" checked={tuning.binarize} onChange={(e) => setTuning({...tuning, binarize: e.target.checked})} className="w-4 h-4 rounded accent-blue-500" />
                            </label>
                            <p className="text-[9px] text-slate-500 px-1">Forces text to black and background to white. Highly recommended.</p>
                        </div>

                        {!tuning.binarize && (
                            <>
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-bold text-slate-400">
                                    <span>BRIGHTNESS</span>
                                    <span className="text-blue-400">{tuning.brightness}</span>
                                </div>
                                <input type="range" min="-50" max="50" value={tuning.brightness} onChange={(e) => setTuning({...tuning, brightness: parseInt(e.target.value)})} className="w-full accent-blue-500" />
                            </div>
                            
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-bold text-slate-400">
                                    <span>CONTRAST</span>
                                    <span className="text-blue-400">{tuning.contrast}</span>
                                </div>
                                <input type="range" min="-50" max="100" value={tuning.contrast} onChange={(e) => setTuning({...tuning, contrast: parseInt(e.target.value)})} className="w-full accent-blue-500" />
                            </div>
                             <label className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl cursor-pointer hover:bg-slate-800 transition-colors">
                                <span className="text-xs font-bold text-slate-300">Sharpen Edge</span>
                                <input type="checkbox" checked={tuning.sharpen} onChange={(e) => setTuning({...tuning, sharpen: e.target.checked})} className="w-4 h-4 rounded accent-blue-500" />
                            </label>
                            <label className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl cursor-pointer hover:bg-slate-800 transition-colors">
                                <span className="text-xs font-bold text-slate-300">Grayscale</span>
                                <input type="checkbox" checked={tuning.grayscale} onChange={(e) => setTuning({...tuning, grayscale: e.target.checked})} className="w-4 h-4 rounded accent-blue-500" />
                            </label>
                            </>
                        )}
                    </div>
                </div>

                 {/* 3. Zoning */}
                <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Maximize className="w-3 h-3" /> ROI & Perspective
                    </h4>
                     <button 
                        onClick={() => setIsZoning(!isZoning)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${isZoning ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}
                    >
                        <span className="text-xs font-bold">Draw Masking Zones</span>
                        <Target className="w-4 h-4" />
                    </button>
                     {zones.length > 0 && (
                        <button onClick={() => setZones([])} className="text-[10px] text-red-500 font-bold hover:underline w-full text-right">Clear Zones</button>
                    )}
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-slate-800">
                    <button 
                        onClick={handleApplyAdvanced}
                        className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-50 transition-all flex items-center justify-center gap-2 shadow-xl shadow-white/5"
                    >
                        <Layers className="w-4 h-4" />
                        Re-Process Now
                    </button>
                </div>
            </div>
        )}
      </div>

      <div className="bg-slate-900 p-6 border-t border-slate-800 shrink-0 shadow-2xl z-20">
        <div className="flex gap-4 max-w-4xl mx-auto w-full items-center">
            
            {/* Strategy Specific Controls */}
            {strategy === 'grid_cell' ? (
                <div className="flex items-center gap-4 flex-1">
                    {/* Mode Toggle */}
                    <div className="flex bg-slate-800 p-1 rounded-xl">
                        <button onClick={() => setEditMode('cols')} className={`px-4 py-2 rounded-lg text-xs font-bold ${editMode === 'cols' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>Edit Cols</button>
                        <button onClick={() => setEditMode('rows')} className={`px-4 py-2 rounded-lg text-xs font-bold ${editMode === 'rows' ? 'bg-purple-600 text-white' : 'text-slate-400'}`}>Edit Rows</button>
                    </div>

                    {/* Add/Remove */}
                    <div className="flex gap-2">
                        <button 
                            onClick={() => {
                                if (editMode === 'cols' && columns.length > 1) setColumns(columns.slice(0, -1));
                                if (editMode === 'rows' && rows.length > 1) setRows(rows.slice(0, -1));
                            }}
                            className="p-3 bg-slate-800 text-slate-400 rounded-xl border-2 border-slate-700"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => {
                                if (editMode === 'cols' && columns.length < 8) setColumns([...columns, Math.min(columns[columns.length-1]+50, scanData.imageWidth)].sort((a,b)=>a-b));
                                if (editMode === 'rows') setRows([...rows, Math.min(rows[rows.length-1]+30, scanData.imageHeight)].sort((a,b)=>a-b));
                            }}
                            className="p-3 bg-slate-800 text-slate-200 rounded-xl border-2 border-slate-700"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Engine Selector */}
                    <div className="flex-1 px-4">
                        <div className="text-[9px] text-slate-500 font-bold mb-1 uppercase tracking-wider">Per-Cell Engine</div>
                        <div className="flex bg-slate-800 p-1 rounded-lg w-full">
                            <button onClick={() => setEngine('tesseract')} className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase ${engine === 'tesseract' ? 'bg-slate-600 text-white' : 'text-slate-500'}`}>Tesseract</button>
                            <button onClick={() => setEngine('paddle')} className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase ${engine === 'paddle' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>PaddleOCR</button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex gap-2 flex-1">
                    <button 
                        onClick={() => columns.length > 1 && setColumns(columns.slice(0, -1))}
                        className="p-4 bg-slate-800 text-slate-400 rounded-2xl border-2 border-slate-700 disabled:opacity-20"
                        disabled={columns.length <= 1}
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={() => {
                            if (columns.length < 8) {
                                const last = columns[columns.length - 1];
                                setColumns([...columns, Math.min(last + 80, scanData.imageWidth)].sort((a,b) => a-b));
                            }
                        }}
                        className="px-6 py-4 bg-slate-800 text-slate-200 rounded-2xl border-2 border-slate-700 font-bold text-sm flex items-center transition-all hover:border-slate-500"
                    >
                        <Plus className="w-4 h-4 mr-2 text-cyan-400" /> Add Line
                    </button>
                    <div className="flex-1"></div>
                </div>
            )}
            
            <button 
                onClick={handleFinish}
                className="px-8 py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-sm rounded-2xl hover:bg-blue-500 shadow-xl shadow-blue-900/40 active:scale-95 transition-all whitespace-nowrap"
            >
                <Check className="w-6 h-6 mr-2 inline" />
                {strategy === 'grid_cell' ? 'Run Grid Extraction' : 'Finish Extraction'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default ColumnAdjuster;
