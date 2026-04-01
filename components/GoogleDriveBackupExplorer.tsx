
import React, { useState, useEffect } from 'react';
import { DriveFileMetadata } from '../types';
import { getFileMetadata, deleteFileFromDrive } from '../services/googleDriveService';
import { Cloud, Trash2, RefreshCw, AlertTriangle, CheckCircle2, FileJson, HardDrive } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GoogleDriveBackupExplorerProps {
    clientId: string;
    onClose: () => void;
}

export default function GoogleDriveBackupExplorer({ clientId, onClose }: GoogleDriveBackupExplorerProps) {
    const [loading, setLoading] = useState(true);
    const [file, setFile] = useState<DriveFileMetadata | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const metadata = await getFileMetadata(clientId);
            setFile(metadata);
        } catch (err: any) {
            setError(err.message || "Failed to fetch cloud data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [clientId]);

    const handleDelete = async () => {
        if (!file) return;
        setDeleting(true);
        try {
            await deleteFileFromDrive(file.id, clientId);
            setFile(null);
            setShowConfirm(false);
        } catch (err: any) {
            setError(err.message || "Failed to delete file");
        } finally {
            setDeleting(false);
        }
    };

    const formatSize = (bytes?: string) => {
        if (!bytes) return 'Unknown size';
        const b = parseInt(bytes, 10);
        if (b < 1024) return `${b} B`;
        if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
        return `${(b / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'Unknown date';
        return new Date(dateStr).toLocaleString();
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                        <Cloud size={20} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">Cloud Storage Explorer</h3>
                        <p className="text-xs text-gray-500">Manage your data in Google Drive appDataFolder</p>
                    </div>
                </div>
                <button 
                    onClick={fetchData}
                    disabled={loading}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            <AnimatePresence mode="wait">
                {loading ? (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center py-12 space-y-4"
                    >
                        <RefreshCw size={32} className="text-blue-500 animate-spin" />
                        <p className="text-sm text-gray-500">Scanning Google Drive...</p>
                    </motion.div>
                ) : error ? (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3"
                    >
                        <AlertTriangle className="text-red-500 shrink-0" size={20} />
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-red-800">Connection Error</p>
                            <p className="text-xs text-red-600">{error}</p>
                            <button 
                                onClick={fetchData}
                                className="text-xs font-semibold text-red-700 underline mt-2"
                            >
                                Try again
                            </button>
                        </div>
                    </motion.div>
                ) : !file ? (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center py-12 space-y-4 border-2 border-dashed border-gray-100 rounded-2xl"
                    >
                        <div className="p-4 bg-gray-50 rounded-full text-gray-300">
                            <HardDrive size={40} />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium text-gray-900">No backup found</p>
                            <p className="text-xs text-gray-500">Your cloud storage is currently empty.</p>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-4"
                    >
                        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
                                <div className="p-2 bg-white rounded-lg border border-gray-200 text-blue-500">
                                    <FileJson size={20} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{file.name}</p>
                                    <p className="text-[10px] font-mono text-gray-400 truncate">{file.id}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-gray-900">{formatSize(file.size)}</p>
                                    <p className="text-[10px] text-gray-500">JSON Data</p>
                                </div>
                            </div>
                            
                            <div className="p-4 space-y-3">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Last Modified</span>
                                    <span className="text-gray-900 font-medium">{formatDate(file.modifiedTime)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Location</span>
                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">appDataFolder</span>
                                </div>
                            </div>

                            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                                {!showConfirm ? (
                                    <button 
                                        onClick={() => setShowConfirm(true)}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                    >
                                        <Trash2 size={16} />
                                        Delete from Cloud
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <p className="text-xs font-medium text-red-600">Permanently delete?</p>
                                        <button 
                                            onClick={() => setShowConfirm(false)}
                                            className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            onClick={handleDelete}
                                            disabled={deleting}
                                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {deleting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                            Yes, Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
                            <AlertTriangle className="text-amber-500 shrink-0" size={18} />
                            <p className="text-[11px] text-amber-700 leading-relaxed">
                                <strong>Note:</strong> Deleting this file will remove your cloud backup. 
                                Your local data on this device will remain untouched. 
                                A new backup will be created automatically on your next sync.
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
