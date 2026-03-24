import React, { useState, useEffect, useRef } from 'react';
import { getHistory, getExportProfiles, getTableProfiles, importSyncData, getDashboardConfig } from '../services/storageService';
import { exportSettingsByCategory, applyImportedSettings } from '../services/settingsService';
import { SavedScan, ExportProfile, TableProfile, SyncDataPayload, DashboardConfig } from '../types';
import { Download, Upload, Database, FileSpreadsheet, LayoutTemplate, FileJson, ArrowLeft, Settings, LayoutDashboard } from 'lucide-react';
import { ExpandableList } from './ExpandableList';

const SETTINGS_CATEGORIES = [
    { id: 'appearance', name: 'Appearance (Theme)' },
    { id: 'aiConfig', name: 'AI Configuration (Models, Providers)' },
    { id: 'prompts', name: 'AI Prompts' },
    { id: 'general', name: 'General Settings' }
];

interface ManualDataTransferProps {
    onClose: () => void;
}

export default function ManualDataTransfer({ onClose }: ManualDataTransferProps) {
    const [mode, setMode] = useState<'select' | 'export' | 'import'>('select');
    
    // Export State
    const [localScans, setLocalScans] = useState<SavedScan[]>([]);
    const [localExportProfiles, setLocalExportProfiles] = useState<ExportProfile[]>([]);
    const [localTableProfiles, setLocalTableProfiles] = useState<TableProfile[]>([]);
    const [localDashboardConfig, setLocalDashboardConfig] = useState<DashboardConfig | null>(null);
    
    const [selectedLocalScans, setSelectedLocalScans] = useState<Set<string>>(new Set());
    const [selectedLocalExportProfiles, setSelectedLocalExportProfiles] = useState<Set<string>>(new Set());
    const [selectedLocalTableProfiles, setSelectedLocalTableProfiles] = useState<Set<string>>(new Set());
    const [selectedLocalSettings, setSelectedLocalSettings] = useState<Set<string>>(new Set());
    const [selectedLocalDashboard, setSelectedLocalDashboard] = useState<boolean>(true);

    // Import State
    const [importedData, setImportedData] = useState<SyncDataPayload | null>(null);
    const [selectedImportScans, setSelectedImportScans] = useState<Set<string>>(new Set());
    const [selectedImportExportProfiles, setSelectedImportExportProfiles] = useState<Set<string>>(new Set());
    const [selectedImportTableProfiles, setSelectedImportTableProfiles] = useState<Set<string>>(new Set());
    const [selectedImportSettings, setSelectedImportSettings] = useState<Set<string>>(new Set());
    const [selectedImportDashboard, setSelectedImportDashboard] = useState<boolean>(true);
    const [importError, setImportError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [expandedSection, setExpandedSection] = useState<string | null>(null);
    const [status, setStatus] = useState<string>("");

    useEffect(() => {
        if (mode === 'export') {
            const scans = getHistory();
            const exportProfiles = getExportProfiles();
            const tableProfiles = getTableProfiles();
            const dashboardConfig = getDashboardConfig();
            
            setLocalScans(scans);
            setLocalExportProfiles(exportProfiles);
            setLocalTableProfiles(tableProfiles);
            setLocalDashboardConfig(dashboardConfig);

            setSelectedLocalScans(new Set(scans.map(s => s.id)));
            setSelectedLocalExportProfiles(new Set(exportProfiles.map(p => p.id)));
            setSelectedLocalTableProfiles(new Set(tableProfiles.map(p => p.id)));
            setSelectedLocalSettings(new Set(SETTINGS_CATEGORIES.map(c => c.id)));
            setSelectedLocalDashboard(true);
        }
    }, [mode]);

    const handleExport = () => {
        const payload: SyncDataPayload = {
            scans: localScans.filter(s => selectedLocalScans.has(s.id)),
            exportProfiles: localExportProfiles.filter(p => selectedLocalExportProfiles.has(p.id)),
            tableProfiles: localTableProfiles.filter(p => selectedLocalTableProfiles.has(p.id))
        };

        if (selectedLocalSettings.size > 0) {
            payload.settings = exportSettingsByCategory(Array.from(selectedLocalSettings));
        }
        
        if (selectedLocalDashboard && localDashboardConfig) {
            payload.dashboardConfig = localDashboardConfig;
        }

        const dataStr = JSON.stringify(payload, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `timesnap_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        setStatus("Export successful!");
        setTimeout(() => setStatus(""), 3000);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                const parsed = JSON.parse(content);
                
                if (parsed && Array.isArray(parsed.scans) && Array.isArray(parsed.exportProfiles) && Array.isArray(parsed.tableProfiles)) {
                    setImportedData(parsed);
                    setSelectedImportScans(new Set(parsed.scans.map((s: any) => s.id)));
                    setSelectedImportExportProfiles(new Set(parsed.exportProfiles.map((p: any) => p.id)));
                    setSelectedImportTableProfiles(new Set(parsed.tableProfiles.map((p: any) => p.id)));
                    
                    if (parsed.settings) {
                        setSelectedImportSettings(new Set(Object.keys(parsed.settings)));
                    } else {
                        setSelectedImportSettings(new Set());
                    }
                    
                    if (parsed.dashboardConfig) {
                        setSelectedImportDashboard(true);
                    } else {
                        setSelectedImportDashboard(false);
                    }

                    setImportError(null);
                    setStatus("File loaded successfully.");
                } else {
                    setImportError("Invalid file format. Please select a valid TimeSnap export file.");
                    setImportedData(null);
                }
            } catch (err) {
                setImportError("Failed to parse file. Ensure it is a valid JSON.");
                setImportedData(null);
            }
        };
        reader.readAsText(file);
        
        // Reset file input so the same file can be selected again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleImport = () => {
        if (!importedData) return;

        try {
            importSyncData(
                importedData,
                selectedImportScans,
                selectedImportExportProfiles,
                selectedImportTableProfiles,
                selectedImportDashboard
            );
            
            if (importedData.settings && selectedImportSettings.size > 0) {
                applyImportedSettings(importedData.settings, Array.from(selectedImportSettings));
            }
            
            setStatus("Data imported successfully!");
            setImportedData(null);
            setTimeout(() => {
                setStatus("");
                setMode('select');
                // Reload to apply settings immediately
                if (selectedImportSettings.size > 0 || selectedImportDashboard) {
                    window.location.reload();
                }
            }, 2000);
        } catch (error) {
            console.error("Error importing data", error);
            setImportError("An error occurred while saving the imported data.");
        }
    };

    const toggleSet = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
        const newSet = new Set(set);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setter(newSet);
    };

    const totalLocalSelected = selectedLocalScans.size + selectedLocalExportProfiles.size + selectedLocalTableProfiles.size + selectedLocalSettings.size + (selectedLocalDashboard ? 1 : 0);
    const totalImportSelected = selectedImportScans.size + selectedImportExportProfiles.size + selectedImportTableProfiles.size + selectedImportSettings.size + (selectedImportDashboard ? 1 : 0);

    return (
        <div className="p-4 max-w-2xl mx-auto animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        {mode !== 'select' && (
                            <button onClick={() => setMode('select')} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                            </button>
                        )}
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <FileJson className="w-6 h-6 text-indigo-600" />
                                Manual Data Transfer
                            </h2>
                            {status && <p className="text-sm text-green-600 dark:text-green-400 mt-1">{status}</p>}
                            {importError && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{importError}</p>}
                        </div>
                    </div>
                    <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                        Close
                    </button>
                </div>

                <div className="p-6">
                    {mode === 'select' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button 
                                onClick={() => setMode('export')}
                                className="flex flex-col items-center justify-center p-8 border-2 border-slate-200 dark:border-slate-700 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group"
                            >
                                <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Upload className="w-8 h-8" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Export Data</h3>
                                <p className="text-sm text-slate-500 text-center mt-2">Save your data to a JSON file for backup or transfer.</p>
                            </button>
                            
                            <button 
                                onClick={() => setMode('import')}
                                className="flex flex-col items-center justify-center p-8 border-2 border-slate-200 dark:border-slate-700 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all group"
                            >
                                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Download className="w-8 h-8" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Import Data</h3>
                                <p className="text-sm text-slate-500 text-center mt-2">Load data from a previously exported JSON file.</p>
                            </button>
                        </div>
                    )}

                    {mode === 'export' && (
                        <div className="space-y-6 animate-fade-in">
                            <p className="text-slate-600 dark:text-slate-400">Select the data you want to include in the export file.</p>
                            
                            <div className="space-y-4">
                                <ExpandableList 
                                    title="Saved Scans" 
                                    icon={<Database className="w-5 h-5 text-blue-500" />} 
                                    items={localScans} 
                                    selectedIds={selectedLocalScans} 
                                    onToggle={(id) => toggleSet(selectedLocalScans, id, setSelectedLocalScans)} 
                                    onSelectAll={() => setSelectedLocalScans(new Set(localScans.map(s => s.id)))} 
                                    onDeselectAll={() => setSelectedLocalScans(new Set())} 
                                    renderItem={(s) => `${s.name} (${new Date(s.timestamp).toLocaleDateString()})`} 
                                    getId={(s) => s.id} 
                                    isExpanded={expandedSection === 'localScans'} 
                                    onToggleExpand={() => setExpandedSection(expandedSection === 'localScans' ? null : 'localScans')} 
                                />
                                <ExpandableList 
                                    title="Table Profiles" 
                                    icon={<LayoutTemplate className="w-5 h-5 text-purple-500" />} 
                                    items={localTableProfiles} 
                                    selectedIds={selectedLocalTableProfiles} 
                                    onToggle={(id) => toggleSet(selectedLocalTableProfiles, id, setSelectedLocalTableProfiles)} 
                                    onSelectAll={() => setSelectedLocalTableProfiles(new Set(localTableProfiles.map(p => p.id)))} 
                                    onDeselectAll={() => setSelectedLocalTableProfiles(new Set())} 
                                    renderItem={(p) => p.name} 
                                    getId={(p) => p.id} 
                                    isExpanded={expandedSection === 'localTableProfiles'} 
                                    onToggleExpand={() => setExpandedSection(expandedSection === 'localTableProfiles' ? null : 'localTableProfiles')} 
                                />
                                <ExpandableList 
                                    title="Export Profiles" 
                                    icon={<FileSpreadsheet className="w-5 h-5 text-green-500" />} 
                                    items={localExportProfiles} 
                                    selectedIds={selectedLocalExportProfiles} 
                                    onToggle={(id) => toggleSet(selectedLocalExportProfiles, id, setSelectedLocalExportProfiles)} 
                                    onSelectAll={() => setSelectedLocalExportProfiles(new Set(localExportProfiles.map(p => p.id)))} 
                                    onDeselectAll={() => setSelectedLocalExportProfiles(new Set())} 
                                    renderItem={(p) => p.name} 
                                    getId={(p) => p.id} 
                                    isExpanded={expandedSection === 'localExportProfiles'} 
                                    onToggleExpand={() => setExpandedSection(expandedSection === 'localExportProfiles' ? null : 'localExportProfiles')} 
                                />
                                <ExpandableList 
                                    title="Application Settings" 
                                    icon={<Settings className="w-5 h-5 text-orange-500" />} 
                                    items={SETTINGS_CATEGORIES} 
                                    selectedIds={selectedLocalSettings} 
                                    onToggle={(id) => toggleSet(selectedLocalSettings, id, setSelectedLocalSettings)} 
                                    onSelectAll={() => setSelectedLocalSettings(new Set(SETTINGS_CATEGORIES.map(c => c.id)))} 
                                    onDeselectAll={() => setSelectedLocalSettings(new Set())} 
                                    renderItem={(c) => c.name} 
                                    getId={(c) => c.id} 
                                    isExpanded={expandedSection === 'localSettings'} 
                                    onToggleExpand={() => setExpandedSection(expandedSection === 'localSettings' ? null : 'localSettings')} 
                                />
                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                                    <div 
                                        className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                        onClick={() => setSelectedLocalDashboard(!selectedLocalDashboard)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
                                                <LayoutDashboard className="w-5 h-5 text-teal-500" />
                                            </div>
                                            <div className="text-left">
                                                <h3 className="font-semibold text-slate-900 dark:text-white">Dashboard Widgets & Layout</h3>
                                                <p className="text-sm text-slate-500">Include your custom dashboard configuration</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedLocalDashboard}
                                                onChange={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedLocalDashboard(e.target.checked);
                                                }}
                                                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={handleExport}
                                disabled={totalLocalSelected === 0}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                            >
                                <Upload className="w-5 h-5" />
                                Export Selected ({totalLocalSelected})
                            </button>
                        </div>
                    )}

                    {mode === 'import' && (
                        <div className="space-y-6 animate-fade-in">
                            {!importedData ? (
                                <div className="text-center py-8">
                                    <input 
                                        type="file" 
                                        accept=".json" 
                                        onChange={handleFileUpload} 
                                        className="hidden" 
                                        ref={fileInputRef}
                                    />
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="inline-flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all group w-full"
                                    >
                                        <FileJson className="w-12 h-12 text-slate-400 group-hover:text-emerald-500 mb-4 transition-colors" />
                                        <span className="text-lg font-medium text-slate-700 dark:text-slate-300">Click to select a JSON file</span>
                                        <span className="text-sm text-slate-500 mt-1">or drag and drop it here</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <p className="text-slate-600 dark:text-slate-400">Select the data you want to import from the file.</p>
                                    
                                    <div className="space-y-4">
                                        <ExpandableList 
                                            title="Scans to import" 
                                            icon={<Database className="w-5 h-5 text-blue-500" />} 
                                            items={importedData.scans} 
                                            selectedIds={selectedImportScans} 
                                            onToggle={(id) => toggleSet(selectedImportScans, id, setSelectedImportScans)} 
                                            onSelectAll={() => setSelectedImportScans(new Set(importedData.scans.map(s => s.id)))} 
                                            onDeselectAll={() => setSelectedImportScans(new Set())} 
                                            renderItem={(s) => `${s.name} (${new Date(s.timestamp).toLocaleDateString()})`} 
                                            getId={(s) => s.id} 
                                            isExpanded={expandedSection === 'importScans'} 
                                            onToggleExpand={() => setExpandedSection(expandedSection === 'importScans' ? null : 'importScans')} 
                                        />
                                        <ExpandableList 
                                            title="Table Profiles to import" 
                                            icon={<LayoutTemplate className="w-5 h-5 text-purple-500" />} 
                                            items={importedData.tableProfiles} 
                                            selectedIds={selectedImportTableProfiles} 
                                            onToggle={(id) => toggleSet(selectedImportTableProfiles, id, setSelectedImportTableProfiles)} 
                                            onSelectAll={() => setSelectedImportTableProfiles(new Set(importedData.tableProfiles.map(p => p.id)))} 
                                            onDeselectAll={() => setSelectedImportTableProfiles(new Set())} 
                                            renderItem={(p) => p.name} 
                                            getId={(p) => p.id} 
                                            isExpanded={expandedSection === 'importTableProfiles'} 
                                            onToggleExpand={() => setExpandedSection(expandedSection === 'importTableProfiles' ? null : 'importTableProfiles')} 
                                        />
                                        <ExpandableList 
                                            title="Export Profiles to import" 
                                            icon={<FileSpreadsheet className="w-5 h-5 text-green-500" />} 
                                            items={importedData.exportProfiles} 
                                            selectedIds={selectedImportExportProfiles} 
                                            onToggle={(id) => toggleSet(selectedImportExportProfiles, id, setSelectedImportExportProfiles)} 
                                            onSelectAll={() => setSelectedImportExportProfiles(new Set(importedData.exportProfiles.map(p => p.id)))} 
                                            onDeselectAll={() => setSelectedImportExportProfiles(new Set())} 
                                            renderItem={(p) => p.name} 
                                            getId={(p) => p.id} 
                                            isExpanded={expandedSection === 'importExportProfiles'} 
                                            onToggleExpand={() => setExpandedSection(expandedSection === 'importExportProfiles' ? null : 'importExportProfiles')} 
                                        />
                                        {importedData.settings && Object.keys(importedData.settings).length > 0 && (
                                            <ExpandableList 
                                                title="Settings to import" 
                                                icon={<Settings className="w-5 h-5 text-orange-500" />} 
                                                items={SETTINGS_CATEGORIES.filter(c => Object.keys(importedData.settings!).includes(c.id))} 
                                                selectedIds={selectedImportSettings} 
                                                onToggle={(id) => toggleSet(selectedImportSettings, id, setSelectedImportSettings)} 
                                                onSelectAll={() => setSelectedImportSettings(new Set(Object.keys(importedData.settings!)))} 
                                                onDeselectAll={() => setSelectedImportSettings(new Set())} 
                                                renderItem={(c) => c.name} 
                                                getId={(c) => c.id} 
                                                isExpanded={expandedSection === 'importSettings'} 
                                                onToggleExpand={() => setExpandedSection(expandedSection === 'importSettings' ? null : 'importSettings')} 
                                            />
                                        )}
                                        {importedData.dashboardConfig && (
                                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                                                <div 
                                                    className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                                    onClick={() => setSelectedImportDashboard(!selectedImportDashboard)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
                                                            <LayoutDashboard className="w-5 h-5 text-teal-500" />
                                                        </div>
                                                        <div className="text-left">
                                                            <h3 className="font-semibold text-slate-900 dark:text-white">Dashboard Widgets & Layout</h3>
                                                            <p className="text-sm text-slate-500">Import custom dashboard configuration</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedImportDashboard}
                                                            onChange={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedImportDashboard(e.target.checked);
                                                            }}
                                                            className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-3">
                                        <button 
                                            onClick={() => setImportedData(null)}
                                            className="flex-1 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            onClick={handleImport}
                                            disabled={totalImportSelected === 0}
                                            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                                        >
                                            <Download className="w-5 h-5" />
                                            Import Selected ({totalImportSelected})
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
