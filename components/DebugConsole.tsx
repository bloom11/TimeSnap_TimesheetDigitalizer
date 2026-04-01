
import React, { useEffect, useState, useRef } from 'react';
import { Terminal, X, Trash2, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { SyncService } from '../services/syncService';
import { PeerLog } from '../types';

const DebugConsole: React.FC = () => {
    const [logs, setLogs] = useState<PeerLog[]>([]);
    const [minimized, setMinimized] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [copied, setCopied] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Resizing state
    const [height, setHeight] = useState(320);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartY = useRef(0);
    const dragStartHeight = useRef(0);

    useEffect(() => {
        const listener = (log: PeerLog) => {
            setLogs(prev => [...prev.slice(-99), log]); // Keep last 100
            setIsVisible(true);
            if (log.message.includes('opened manually')) {
                setMinimized(false);
            }
        };
        SyncService.logListeners.push(listener);
        return () => {
            SyncService.logListeners = SyncService.logListeners.filter(l => l !== listener);
        };
    }, []);

    useEffect(() => {
        if (scrollRef.current && !minimized) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs, minimized]);

    const handleCopy = () => {
        const text = logs.map(l => `[${new Date(l.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}] ${l.level.toUpperCase()}: ${l.message}`).join('\n');
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(err => console.error('Failed to copy logs', err));
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (minimized) return;
        setIsDragging(true);
        dragStartY.current = e.clientY;
        dragStartHeight.current = height;
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        const deltaY = dragStartY.current - e.clientY;
        const newHeight = Math.max(150, Math.min(window.innerHeight - 100, dragStartHeight.current + deltaY));
        setHeight(newHeight);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        setIsDragging(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    if (!isVisible || logs.length === 0) return null;

    return (
        <div 
            className={`fixed bottom-0 right-0 left-0 sm:bottom-4 sm:right-4 sm:left-auto z-[100] bg-slate-900 border-t sm:border border-slate-700 sm:rounded-xl shadow-2xl overflow-hidden flex flex-col sm:w-[400px] ${minimized ? 'h-[52px] sm:h-[60px]' : ''} ${isDragging ? '' : 'transition-all duration-200'}`}
            style={!minimized ? { height: `${height}px` } : undefined}
        >
            {/* Drag Handle */}
            {!minimized && (
                <div 
                    className="h-5 w-full bg-slate-800 flex items-center justify-center cursor-ns-resize touch-none hover:bg-slate-700 transition-colors"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                >
                    <div className="w-12 h-1.5 bg-slate-500 rounded-full" />
                </div>
            )}

            <div className="bg-slate-800 p-2 sm:p-3 flex items-center justify-between border-b border-slate-700 shrink-0">
                <div className="flex items-center gap-2 text-slate-300 font-mono text-xs sm:text-sm font-bold pl-2">
                    <Terminal className="w-4 h-4 text-blue-400" />
                    SYNC LOGS
                </div>
                <div className="flex items-center gap-1 sm:gap-2 pr-1">
                    <button onClick={handleCopy} title="Copy Logs" className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors">
                        {copied ? <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" /> : <Copy className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>
                    <button onClick={() => setLogs([])} title="Clear Logs" className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors">
                        <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <button onClick={() => setMinimized(!minimized)} title={minimized ? "Expand" : "Minimize"} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors">
                        {minimized ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>
                    <button onClick={() => setIsVisible(false)} title="Close" className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors">
                        <X className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                </div>
            </div>
            
            {!minimized && (
                <div ref={scrollRef} className="flex-1 overflow-auto p-3 sm:p-4 font-mono text-xs sm:text-sm space-y-2 bg-black/50 custom-scrollbar">
                    {logs.map((log, i) => (
                        <div key={i} className="flex gap-2">
                            <span className="text-slate-600 shrink-0">[{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                            <span className={`break-words ${
                                log.level === 'error' ? 'text-red-400' :
                                log.level === 'success' ? 'text-green-400' :
                                log.level === 'warn' ? 'text-yellow-400' : 'text-blue-300'
                            }`}>
                                {log.message}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DebugConsole;
