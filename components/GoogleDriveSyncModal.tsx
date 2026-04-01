
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Cloud, Key, Info, CheckCircle, AlertCircle, ExternalLink, HelpCircle, ChevronDown, ChevronUp, Database, ArrowLeft } from 'lucide-react';
import { AppSettings } from '../types';
import { getSettings, saveSettings } from '../services/settingsService';
import { uploadToDrive, downloadFromDrive } from '../services/googleDriveService';
import GoogleDriveBackupExplorer from './GoogleDriveBackupExplorer';

interface GoogleDriveSyncModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const GoogleDriveSyncModal: React.FC<GoogleDriveSyncModalProps> = ({ isOpen, onClose }) => {
    const [settings, setSettings] = useState<AppSettings>(getSettings());
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [showGuide, setShowGuide] = useState(false);
    const [view, setView] = useState<'config' | 'explorer'>('config');

    const handleSave = () => {
        const currentSettings = getSettings();
        saveSettings({
            ...currentSettings,
            googleClientId: settings.googleClientId,
            googleDriveSyncEnabled: settings.googleDriveSyncEnabled
        });
        onClose();
    };

    const handleTestConnection = async () => {
        if (!settings.googleClientId) {
            setTestResult({ success: false, message: "Please enter a Client ID first." });
            return;
        }

        try {
            setIsTesting(true);
            setTestResult(null);
            
            // Try to download (this will trigger auth)
            await downloadFromDrive(settings.googleClientId, true);
            
            setTestResult({ success: true, message: "Successfully connected to Google Drive!" });
        } catch (error: any) {
            console.error("Test connection failed", error);
            
            let errorMessage = "Failed to connect. Please check your Client ID and try again.";
            
            if (error.error === 'popup_blocked_by_browser') {
                errorMessage = "Popup blocked by browser. Please allow popups for this site.";
            } else if (error.result?.error?.code === 403 && error.result?.error?.message?.includes('Google Drive API has not been used')) {
                errorMessage = "The Google Drive API is not enabled in your Google Cloud Project. Please go to the Google Cloud Console, search for 'Google Drive API', and enable it for your project.";
            } else if (error.message) {
                errorMessage = error.message;
            }

            setTestResult({ 
                success: false, 
                message: errorMessage
            });
        } finally {
            setIsTesting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/50">
                        <div className="flex items-center gap-3">
                            {view === 'explorer' ? (
                                <button 
                                    onClick={() => setView('config')}
                                    className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                                </button>
                            ) : (
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                                    <Cloud className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                </div>
                            )}
                            <div>
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                                    {view === 'config' ? 'Google Drive Sync' : 'Cloud Data Explorer'}
                                </h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                    {view === 'config' ? 'Securely sync your data across devices' : 'Manage your files in Google Drive'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5 text-zinc-500" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6 custom-scrollbar">
                        {view === 'config' ? (
                            <>
                                {/* Setup Guide Toggle */}
                                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl overflow-hidden">
                                    <button
                                        onClick={() => setShowGuide(!showGuide)}
                                        className="w-full p-4 flex items-center justify-between text-blue-700 dark:text-blue-300 font-medium hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <HelpCircle className="w-5 h-5" />
                                            <span>How to get a Google Client ID?</span>
                                        </div>
                                        {showGuide ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                    </button>
                                    
                                    <AnimatePresence>
                                        {showGuide && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="px-4 pb-4 space-y-3 text-sm text-blue-600/80 dark:text-blue-300/70"
                                            >
                                                <ol className="list-decimal list-inside space-y-2">
                                                    <li>Go to the <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="underline font-bold inline-flex items-center gap-1">Google Cloud Console <ExternalLink className="w-3 h-3" /></a></li>
                                                    <li>Create a new project or select an existing one.</li>
                                                    <li>Navigate to <b>APIs & Services &gt; Library</b> and enable the <b>Google Drive API</b>.</li>
                                                    <li>Go to <b>APIs & Services &gt; OAuth consent screen</b>, configure it as "External", and add your email as a test user.</li>
                                                    <li>Go to <b>Credentials &gt; Create Credentials &gt; OAuth client ID</b>.</li>
                                                    <li>Select <b>Web application</b> as the application type.</li>
                                                    <li>Add <code>{window.location.origin}</code> to <b>Authorized JavaScript origins</b>.</li>
                                                    <li>Copy the <b>Client ID</b> and paste it below.</li>
                                                </ol>
                                                <div className="p-3 bg-blue-100/50 dark:bg-blue-900/30 rounded-xl flex gap-3">
                                                    <Info className="w-5 h-5 shrink-0" />
                                                    <p>This app uses the <code>appDataFolder</code> scope, meaning it can only access files it creates. Your personal files remain private.</p>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Form */}
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                                            <Key className="w-4 h-4" />
                                            Google Client ID
                                        </label>
                                        <input
                                            type="text"
                                            value={settings.googleClientId}
                                            onChange={(e) => setSettings({ ...settings, googleClientId: e.target.value })}
                                            placeholder="your-client-id.apps.googleusercontent.com"
                                            className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                                        />
                                    </div>

                                    <div className="flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-100 dark:border-zinc-700">
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-zinc-900 dark:text-white">Enable Auto-Sync</h4>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Automatically backup data on every change</p>
                                        </div>
                                        <button
                                            onClick={() => setSettings({ ...settings, googleDriveSyncEnabled: !settings.googleDriveSyncEnabled })}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                                                settings.googleDriveSyncEnabled ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-600'
                                            }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                    settings.googleDriveSyncEnabled ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                            />
                                        </button>
                                    </div>

                                    {settings.googleClientId && (
                                        <button 
                                            onClick={() => setView('explorer')}
                                            className="w-full p-4 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-2xl border border-zinc-100 dark:border-zinc-700 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white dark:bg-zinc-900 rounded-lg text-zinc-500 dark:text-zinc-400 group-hover:text-blue-500 transition-colors">
                                                    <Database size={18} />
                                                </div>
                                                <div className="text-left">
                                                    <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">Manage Cloud Data</h4>
                                                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">View or delete your backup in Google Drive</p>
                                                </div>
                                            </div>
                                            <ChevronDown className="w-4 h-4 text-zinc-400 -rotate-90" />
                                        </button>
                                    )}
                                </div>

                                {/* Test Result */}
                                {testResult && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`p-4 rounded-2xl flex items-center gap-3 ${
                                            testResult.success 
                                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30' 
                                                : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30'
                                        }`}
                                    >
                                        {testResult.success ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                        <span className="text-sm font-medium">{testResult.message}</span>
                                    </motion.div>
                                )}
                            </>
                        ) : (
                            <GoogleDriveBackupExplorer 
                                clientId={settings.googleClientId} 
                                onClose={() => setView('config')} 
                            />
                        )}
                    </div>

                    {/* Footer */}
                    {view === 'config' && (
                        <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row gap-3 bg-zinc-50/50 dark:bg-zinc-800/50">
                            <button
                                onClick={handleTestConnection}
                                disabled={isTesting || !settings.googleClientId}
                                className="flex-1 px-6 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isTesting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                                        Testing...
                                    </>
                                ) : (
                                    <>
                                        <Cloud className="w-4 h-4" />
                                        Test Connection
                                    </>
                                )}
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex-1 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all"
                            >
                                Save Configuration
                            </button>
                        </div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
