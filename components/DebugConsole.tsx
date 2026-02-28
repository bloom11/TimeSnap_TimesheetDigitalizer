
import React, { useEffect, useState, useRef } from 'react';
import { Terminal, X, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { SyncService } from '../services/syncService';
import { PeerLog } from '../types';

const DebugConsole: React.FC = () => {
    const [logs, setLogs] = useState<PeerLog[]>([]);
    const [minimized, setMinimized] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const listener = (log: PeerLog) => {
            setLogs(prev => [...prev.slice(-49), log]); // Keep last 50
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

    if (logs.length === 0) return null;

    return (
        <div className={`fixed bottom-4 right-4 z-[100] bg-slate-900 border border-slate-700 shadow-2xl rounded-lg overflow-hidden transition-all duration-300 flex flex-col ${minimized ? 'w-48 h-10' : 'w-80 h-64'}`}>
            <div className="bg-slate-800 p-2 flex items-center justify-between border-b border-slate-700 shrink-0">
                <div className="flex items-center gap-2 text-slate-300 font-mono text-xs font-bold">
                    <Terminal className="w-3 h-3 text-blue-400" />
                    SYNC LOGS
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setLogs([])} className="p-1 hover:bg-slate-700 rounded text-slate-500"><Trash2 className="w-3 h-3" /></button>
                    <button onClick={() => setMinimized(!minimized)} className="p-1 hover:bg-slate-700 rounded text-slate-500">
                        {minimized ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                </div>
            </div>
            
            {!minimized && (
                <div ref={scrollRef} className="flex-1 overflow-auto p-2 font-mono text-[10px] space-y-1 bg-black/50">
                    {logs.map((log, i) => (
                        <div key={i} className="flex gap-2">
                            <span className="text-slate-600">[{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                            <span className={
                                log.level === 'error' ? 'text-red-400' :
                                log.level === 'success' ? 'text-green-400' :
                                log.level === 'warn' ? 'text-yellow-400' : 'text-blue-300'
                            }>
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
