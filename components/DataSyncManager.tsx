import React, { useState, useEffect } from 'react';
import { SyncService } from '../services/syncService';
import { getHistory, getExportProfiles, saveScan, saveExportProfile, getTableProfiles, saveTableProfile, importSyncData, getDashboardConfig } from '../services/storageService';
import { exportSettingsByCategory, applyImportedSettings } from '../services/settingsService';
import { SavedScan, ExportProfile, TableProfile, SyncDataPayload, DashboardConfig } from '../types';
import { Check, Download, Upload, Loader2, AlertCircle, Database, FileSpreadsheet, LayoutTemplate, ChevronDown, Settings, LayoutDashboard } from 'lucide-react';
import { ExpandableList } from './ExpandableList';

const SETTINGS_CATEGORIES = [
    { id: 'appearance', name: 'Appearance (Theme)' },
    { id: 'aiConfig', name: 'AI Configuration (Models, Providers)' },
    { id: 'prompts', name: 'AI Prompts' },
    { id: 'general', name: 'General Settings' }
];

interface DataSyncManagerProps {
    service: SyncService;
    onClose: () => void;
}

export default function DataSyncManager({ service, onClose }: DataSyncManagerProps) {
    const [status, setStatus] = useState<string>("Connected. Ready to sync.");
    const [isSending, setIsSending] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [receivedData, setReceivedData] = useState<SyncDataPayload | null>(null);

    // Local Data
    const [localScans, setLocalScans] = useState<SavedScan[]>([]);
    const [localExportProfiles, setLocalExportProfiles] = useState<ExportProfile[]>([]);
    const [localTableProfiles, setLocalTableProfiles] = useState<TableProfile[]>([]);
    const [localDashboardConfig, setLocalDashboardConfig] = useState<DashboardConfig | null>(null);

    // Selection state for sending
    const [selectedLocalScans, setSelectedLocalScans] = useState<Set<string>>(new Set());
    const [selectedLocalExportProfiles, setSelectedLocalExportProfiles] = useState<Set<string>>(new Set());
    const [selectedLocalTableProfiles, setSelectedLocalTableProfiles] = useState<Set<string>>(new Set());
    const [selectedLocalSettings, setSelectedLocalSettings] = useState<Set<string>>(new Set());
    const [selectedLocalWidgets, setSelectedLocalWidgets] = useState<Set<string>>(new Set());

    // Selection state for receiving
    const [selectedReceivedScans, setSelectedReceivedScans] = useState<Set<string>>(new Set());
    const [selectedReceivedExportProfiles, setSelectedReceivedExportProfiles] = useState<Set<string>>(new Set());
    const [selectedReceivedTableProfiles, setSelectedReceivedTableProfiles] = useState<Set<string>>(new Set());
    const [selectedReceivedSettings, setSelectedReceivedSettings] = useState<Set<string>>(new Set());
    const [selectedReceivedWidgets, setSelectedReceivedWidgets] = useState<Set<string>>(new Set());

    // Expand state
    const [expandedSection, setExpandedSection] = useState<string | null>(null);

    // Conflict Dialog State
    const [conflictDialog, setConflictDialog] = useState<{
        isOpen: boolean;
        details: {
            scans: string[];
            exportProfiles: string[];
            tableProfiles: string[];
            widgets: string[];
        };
    }>({ isOpen: false, details: { scans: [], exportProfiles: [], tableProfiles: [], widgets: [] } });

    useEffect(() => {
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
        setSelectedLocalWidgets(new Set(dashboardConfig?.widgets.map(w => w.id) || []));

        const handleData = (data: any) => {
            if (data.type === 'SYNC_DATA_PAYLOAD') {
                setReceivedData(data.payload);
                setSelectedReceivedScans(new Set());
                setSelectedReceivedExportProfiles(new Set());
                setSelectedReceivedTableProfiles(new Set());
                setSelectedReceivedSettings(new Set());
                setSelectedReceivedWidgets(new Set());

                setStatus("Data received! Review and save.");
            } else if (data.type === 'SYNC_ACK') {
                setIsSending(false);
                setStatus("Data successfully sent!");
                setTimeout(() => setStatus("Connected. Ready to sync."), 3000);
            }
        };

        const handleStatus = (msg: string, connected: boolean) => {
            if (!connected) {
                setStatus("Disconnected.");
            }
        };

        // Override existing handlers for this component
        service.onDataReceived = handleData;
        service.onStatusChange = handleStatus;

    }, [service]);

    const handleSendData = () => {
        setIsSending(true);
        setStatus("Sending data...");
        const payload: SyncDataPayload = {
            scans: localScans.filter(s => selectedLocalScans.has(s.id)),
            exportProfiles: localExportProfiles.filter(p => selectedLocalExportProfiles.has(p.id)),
            tableProfiles: localTableProfiles.filter(p => selectedLocalTableProfiles.has(p.id))
        };

        if (selectedLocalSettings.size > 0) {
            payload.settings = exportSettingsByCategory(Array.from(selectedLocalSettings));
        }

        if (localDashboardConfig && selectedLocalWidgets.size > 0) {
            payload.widgets = localDashboardConfig.widgets.filter(w => selectedLocalWidgets.has(w.id));
        }

        service.send({ type: 'SYNC_DATA_PAYLOAD', payload });
    };

    const handleSaveReceivedDataClick = () => {
        if (!receivedData) return;

        const existingScanIds = new Set(localScans.map(s => s.id));
        const existingExportIds = new Set(localExportProfiles.map(p => p.id));
        const existingTableIds = new Set(localTableProfiles.map(p => p.id));
        const existingWidgetIds = new Set(localDashboardConfig?.widgets.map(w => w.id) || []);

        const conflictingScans = receivedData.scans.filter(s => selectedReceivedScans.has(s.id) && existingScanIds.has(s.id)).map(s => s.name);
        const conflictingExportProfiles = receivedData.exportProfiles.filter(p => selectedReceivedExportProfiles.has(p.id) && existingExportIds.has(p.id)).map(p => p.name);
        const conflictingTableProfiles = receivedData.tableProfiles.filter(p => selectedReceivedTableProfiles.has(p.id) && existingTableIds.has(p.id)).map(p => p.name);
        const conflictingWidgets = (receivedData.widgets || []).filter(w => selectedReceivedWidgets.has(w.id) && existingWidgetIds.has(w.id)).map(w => w.title);

        const totalConflicts = conflictingScans.length + conflictingExportProfiles.length + conflictingTableProfiles.length + conflictingWidgets.length;

        if (totalConflicts > 0) {
            setConflictDialog({ 
                isOpen: true, 
                details: {
                    scans: conflictingScans,
                    exportProfiles: conflictingExportProfiles,
                    tableProfiles: conflictingTableProfiles,
                    widgets: conflictingWidgets
                }
            });
        } else {
            handleSaveReceivedData('skip');
        }
    };

    const handleSaveReceivedData = (resolution: 'skip' | 'overwrite' | 'rename') => {
        setConflictDialog({ isOpen: false, details: { scans: [], exportProfiles: [], tableProfiles: [], widgets: [] } });
        if (!receivedData) return;
        
        setIsSaving(true);
        setStatus("Saving received data...");

        try {
            importSyncData(
                receivedData,
                selectedReceivedScans,
                selectedReceivedExportProfiles,
                selectedReceivedTableProfiles,
                selectedReceivedWidgets,
                resolution
            );

            if (receivedData.settings && selectedReceivedSettings.size > 0) {
                applyImportedSettings(receivedData.settings, Array.from(selectedReceivedSettings));
            }

            // Refresh local state
            const newScans = getHistory();
            const newExportProfiles = getExportProfiles();
            const newTableProfiles = getTableProfiles();
            const newDashboardConfig = getDashboardConfig();
            
            setLocalScans(newScans);
            setLocalExportProfiles(newExportProfiles);
            setLocalTableProfiles(newTableProfiles);
            setLocalDashboardConfig(newDashboardConfig);
            
            // Update local selection to include newly saved items
            setSelectedLocalScans(new Set(newScans.map(s => s.id)));
            setSelectedLocalExportProfiles(new Set(newExportProfiles.map(p => p.id)));
            setSelectedLocalTableProfiles(new Set(newTableProfiles.map(p => p.id)));
            setSelectedLocalWidgets(new Set(newDashboardConfig?.widgets.map(w => w.id) || []));
            
            setReceivedData(null);
            setStatus("Data saved successfully!");
            service.send({ type: 'SYNC_ACK', payload: { success: true } });
            
            setTimeout(() => {
                setIsSaving(false);
                setStatus("Connected. Ready to sync.");
                if (selectedReceivedSettings.size > 0 || selectedReceivedWidgets.size > 0) {
                    window.location.reload();
                }
            }, 2000);

        } catch (error) {
            console.error("Error saving synced data", error);
            setStatus("Error saving data.");
            setIsSaving(false);
        }
    };

    const handleDiscardReceivedData = () => {
        setReceivedData(null);
        setStatus("Received data discarded.");
        setTimeout(() => setStatus("Connected. Ready to sync."), 2000);
    };

    const handleSelectAllReceived = () => {
        if (!receivedData) return;
        setSelectedReceivedScans(new Set(receivedData.scans.map(s => s.id)));
        setSelectedReceivedExportProfiles(new Set(receivedData.exportProfiles.map(p => p.id)));
        setSelectedReceivedTableProfiles(new Set(receivedData.tableProfiles.map(p => p.id)));
        if (receivedData.settings) setSelectedReceivedSettings(new Set(Object.keys(receivedData.settings)));
        if (receivedData.widgets) setSelectedReceivedWidgets(new Set(receivedData.widgets.map(w => w.id)));
    };

    const handleDeselectAllReceived = () => {
        setSelectedReceivedScans(new Set());
        setSelectedReceivedExportProfiles(new Set());
        setSelectedReceivedTableProfiles(new Set());
        setSelectedReceivedSettings(new Set());
        setSelectedReceivedWidgets(new Set());
    };

    const toggleSet = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
        const newSet = new Set(set);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setter(newSet);
    };

    const totalLocalSelected = selectedLocalScans.size + selectedLocalExportProfiles.size + selectedLocalTableProfiles.size + selectedLocalSettings.size + selectedLocalWidgets.size;
    const totalReceivedSelected = selectedReceivedScans.size + selectedReceivedExportProfiles.size + selectedReceivedTableProfiles.size + selectedReceivedSettings.size + selectedReceivedWidgets.size;

    return (
        <div className="p-4 max-w-4xl mx-auto animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-4 justify-between items-start sm:items-center bg-slate-50 dark:bg-slate-900/50">
                    <div className="min-w-0 flex-1">
                        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 truncate">
                            <Database className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 shrink-0" />
                            <span className="truncate">Data Synchronization</span>
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500 mt-1 truncate">{status}</p>
                    </div>
                    <button onClick={onClose} className="shrink-0 px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                        Disconnect
                    </button>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Local Data Section */}
                    <div className="space-y-6">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b pb-2">Your Data</h3>
                        
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
                            <ExpandableList 
                                title="Dashboard Widgets" 
                                icon={<LayoutDashboard className="w-5 h-5 text-teal-500" />} 
                                items={localDashboardConfig?.widgets || []} 
                                selectedIds={selectedLocalWidgets} 
                                onToggle={(id) => toggleSet(selectedLocalWidgets, id, setSelectedLocalWidgets)} 
                                onSelectAll={() => setSelectedLocalWidgets(new Set(localDashboardConfig?.widgets.map(w => w.id) || []))} 
                                onDeselectAll={() => setSelectedLocalWidgets(new Set())} 
                                renderItem={(w) => w.title} 
                                getId={(w) => w.id} 
                                isExpanded={expandedSection === 'localWidgets'} 
                                onToggleExpand={() => setExpandedSection(expandedSection === 'localWidgets' ? null : 'localWidgets')} 
                            />
                        </div>

                        <button 
                            onClick={handleSendData}
                            disabled={isSending || isSaving || totalLocalSelected === 0}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                        >
                            {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                            Send Selected ({totalLocalSelected})
                        </button>
                    </div>

                    {/* Remote Data Section */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between border-b pb-2">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Received Data</h3>
                            {receivedData && (
                                <div className="flex gap-2">
                                    <button onClick={handleSelectAllReceived} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">Select All</button>
                                    <span className="text-slate-300 dark:text-slate-600">|</span>
                                    <button onClick={handleDeselectAllReceived} className="text-xs font-medium text-slate-500 hover:underline">None</button>
                                </div>
                            )}
                        </div>
                        
                        {receivedData ? (
                            <div className="space-y-6 animate-fade-in">
                                <div className="space-y-4">
                                    <ExpandableList 
                                        title="Scans to import" 
                                        icon={<Database className="w-5 h-5 text-blue-500" />} 
                                        items={receivedData.scans} 
                                        selectedIds={selectedReceivedScans} 
                                        onToggle={(id) => toggleSet(selectedReceivedScans, id, setSelectedReceivedScans)} 
                                        onSelectAll={() => setSelectedReceivedScans(new Set(receivedData.scans.map(s => s.id)))} 
                                        onDeselectAll={() => setSelectedReceivedScans(new Set())} 
                                        renderItem={(s) => `${s.name} (${new Date(s.timestamp).toLocaleDateString()})`} 
                                        getId={(s) => s.id} 
                                        isExpanded={expandedSection === 'receivedScans'} 
                                        onToggleExpand={() => setExpandedSection(expandedSection === 'receivedScans' ? null : 'receivedScans')} 
                                    />
                                    <ExpandableList 
                                        title="Table Profiles to import" 
                                        icon={<LayoutTemplate className="w-5 h-5 text-purple-500" />} 
                                        items={receivedData.tableProfiles} 
                                        selectedIds={selectedReceivedTableProfiles} 
                                        onToggle={(id) => toggleSet(selectedReceivedTableProfiles, id, setSelectedReceivedTableProfiles)} 
                                        onSelectAll={() => setSelectedReceivedTableProfiles(new Set(receivedData.tableProfiles.map(p => p.id)))} 
                                        onDeselectAll={() => setSelectedReceivedTableProfiles(new Set())} 
                                        renderItem={(p) => p.name} 
                                        getId={(p) => p.id} 
                                        isExpanded={expandedSection === 'receivedTableProfiles'} 
                                        onToggleExpand={() => setExpandedSection(expandedSection === 'receivedTableProfiles' ? null : 'receivedTableProfiles')} 
                                    />
                                    <ExpandableList 
                                        title="Export Profiles to import" 
                                        icon={<FileSpreadsheet className="w-5 h-5 text-green-500" />} 
                                        items={receivedData.exportProfiles} 
                                        selectedIds={selectedReceivedExportProfiles} 
                                        onToggle={(id) => toggleSet(selectedReceivedExportProfiles, id, setSelectedReceivedExportProfiles)} 
                                        onSelectAll={() => setSelectedReceivedExportProfiles(new Set(receivedData.exportProfiles.map(p => p.id)))} 
                                        onDeselectAll={() => setSelectedReceivedExportProfiles(new Set())} 
                                        renderItem={(p) => p.name} 
                                        getId={(p) => p.id} 
                                        isExpanded={expandedSection === 'receivedExportProfiles'} 
                                        onToggleExpand={() => setExpandedSection(expandedSection === 'receivedExportProfiles' ? null : 'receivedExportProfiles')} 
                                    />
                                    {receivedData.settings && Object.keys(receivedData.settings).length > 0 && (
                                        <ExpandableList 
                                            title="Settings to import" 
                                            icon={<Settings className="w-5 h-5 text-orange-500" />} 
                                            items={SETTINGS_CATEGORIES.filter(c => Object.keys(receivedData.settings!).includes(c.id))} 
                                            selectedIds={selectedReceivedSettings} 
                                            onToggle={(id) => toggleSet(selectedReceivedSettings, id, setSelectedReceivedSettings)} 
                                            onSelectAll={() => setSelectedReceivedSettings(new Set(Object.keys(receivedData.settings!)))} 
                                            onDeselectAll={() => setSelectedReceivedSettings(new Set())} 
                                            renderItem={(c) => c.name} 
                                            getId={(c) => c.id} 
                                            isExpanded={expandedSection === 'receivedSettings'} 
                                            onToggleExpand={() => setExpandedSection(expandedSection === 'receivedSettings' ? null : 'receivedSettings')} 
                                        />
                                    )}
                                    {receivedData.widgets && receivedData.widgets.length > 0 && (
                                        <ExpandableList 
                                            title="Widgets to import" 
                                            icon={<LayoutDashboard className="w-5 h-5 text-teal-500" />} 
                                            items={receivedData.widgets} 
                                            selectedIds={selectedReceivedWidgets} 
                                            onToggle={(id) => toggleSet(selectedReceivedWidgets, id, setSelectedReceivedWidgets)} 
                                            onSelectAll={() => setSelectedReceivedWidgets(new Set(receivedData.widgets!.map(w => w.id)))} 
                                            onDeselectAll={() => setSelectedReceivedWidgets(new Set())} 
                                            renderItem={(w) => w.title} 
                                            getId={(w) => w.id} 
                                            isExpanded={expandedSection === 'receivedWidgets'} 
                                            onToggleExpand={() => setExpandedSection(expandedSection === 'receivedWidgets' ? null : 'receivedWidgets')} 
                                        />
                                    )}
                                </div>

                                <div className="flex gap-3">
                                    <button 
                                        onClick={handleDiscardReceivedData}
                                        disabled={isSaving}
                                        className="flex-1 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
                                    >
                                        Discard
                                    </button>
                                    <button 
                                        onClick={handleSaveReceivedDataClick}
                                        disabled={isSaving || totalReceivedSelected === 0}
                                        className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                                    >
                                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                                        Save Selected ({totalReceivedSelected})
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center">
                                <Download className="w-12 h-12 mb-3 opacity-20" />
                                <p className="text-sm font-medium">Waiting for data...</p>
                                <p className="text-xs opacity-60 mt-1">Ask the other device to send data.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Conflict Resolution Dialog */}
            {conflictDialog.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-amber-50 dark:bg-amber-900/20 shrink-0">
                            <h3 className="text-xl font-bold text-amber-800 dark:text-amber-400 flex items-center gap-2">
                                <AlertCircle className="w-6 h-6" />
                                Data Conflict Detected
                            </h3>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <p className="text-slate-600 dark:text-slate-300 mb-4">
                                The following items already exist on this device. How would you like to handle them?
                            </p>
                            
                            <div className="space-y-4 mb-6">
                                {conflictDialog.details.scans.length > 0 && (
                                    <div>
                                        <h4 className="font-bold text-red-600 dark:text-red-400 mb-1">Scans ({conflictDialog.details.scans.length})</h4>
                                        <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-400">
                                            {conflictDialog.details.scans.map((name, i) => <li key={i}>{name}</li>)}
                                        </ul>
                                    </div>
                                )}
                                {conflictDialog.details.exportProfiles.length > 0 && (
                                    <div>
                                        <h4 className="font-bold text-red-600 dark:text-red-400 mb-1">Export Profiles ({conflictDialog.details.exportProfiles.length})</h4>
                                        <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-400">
                                            {conflictDialog.details.exportProfiles.map((name, i) => <li key={i}>{name}</li>)}
                                        </ul>
                                    </div>
                                )}
                                {conflictDialog.details.tableProfiles.length > 0 && (
                                    <div>
                                        <h4 className="font-bold text-red-600 dark:text-red-400 mb-1">Table Profiles ({conflictDialog.details.tableProfiles.length})</h4>
                                        <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-400">
                                            {conflictDialog.details.tableProfiles.map((name, i) => <li key={i}>{name}</li>)}
                                        </ul>
                                    </div>
                                )}
                                {conflictDialog.details.widgets.length > 0 && (
                                    <div>
                                        <h4 className="font-bold text-red-600 dark:text-red-400 mb-1">Widgets ({conflictDialog.details.widgets.length})</h4>
                                        <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-400">
                                            {conflictDialog.details.widgets.map((name, i) => <li key={i}>{name}</li>)}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <button
                                    onClick={() => handleSaveReceivedData('skip')}
                                    className="w-full p-4 text-left border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    <div className="font-bold text-slate-900 dark:text-white">Skip Existing</div>
                                    <div className="text-sm text-slate-500 dark:text-slate-400">Only import new items. Existing items will not be modified.</div>
                                </button>
                                <button
                                    onClick={() => handleSaveReceivedData('rename')}
                                    className="w-full p-4 text-left border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    <div className="font-bold text-slate-900 dark:text-white">Import as Copies</div>
                                    <div className="text-sm text-slate-500 dark:text-slate-400">Keep both versions. Imported items will be renamed with "(Copy)".</div>
                                </button>
                                <button
                                    onClick={() => handleSaveReceivedData('overwrite')}
                                    className="w-full p-4 text-left border border-red-200 dark:border-red-900/50 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                >
                                    <div className="font-bold text-red-600 dark:text-red-400">Overwrite Existing</div>
                                    <div className="text-sm text-slate-500 dark:text-slate-400">Replace local items with the imported versions. This cannot be undone.</div>
                                </button>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 shrink-0 flex justify-end bg-slate-50 dark:bg-slate-900/50">
                            <button
                                onClick={() => setConflictDialog({ isOpen: false, details: { scans: [], exportProfiles: [], tableProfiles: [], widgets: [] } })}
                                className="px-6 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
