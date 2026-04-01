import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, CheckCircle, AlertCircle, RefreshCw, X } from 'lucide-react';
import { SyncService } from '../services/syncService';
import { PeerLog } from '../types';

export const SyncStatusToast: React.FC = () => {
    const [status, setStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;

        const listener = (log: PeerLog) => {
            if (log.message.includes('Starting upload') || log.message.includes('Starting download')) {
                setStatus('syncing');
                setMessage('Syncing with Google Drive...');
                setVisible(true);
            } else if (log.level === 'error') {
                if (log.message.includes('popup_blocked_by_browser')) {
                    // Don't show toast for background popup blocks to avoid annoying the user
                    return;
                }
                setStatus('error');
                setMessage('Sync failed. Check console.');
                setVisible(true);
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => setVisible(false), 5000);
            } else if (log.message.includes('New file created successfully') || log.message.includes('File updated successfully') || log.message.includes('Download complete')) {
                setStatus('success');
                setMessage('Sync complete!');
                setVisible(true);
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => setVisible(false), 3000);
            }
        };

        SyncService.logListeners.push(listener);
        return () => {
            SyncService.logListeners = SyncService.logListeners.filter(l => l !== listener);
            clearTimeout(timeoutId);
        };
    }, []);

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.9 }}
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700"
                >
                    {status === 'syncing' && <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />}
                    {status === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
                    {status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                    
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {message}
                    </span>

                    <button 
                        onClick={() => setVisible(false)}
                        className="ml-2 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
