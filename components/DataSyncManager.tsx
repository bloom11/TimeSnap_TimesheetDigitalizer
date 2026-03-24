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
    const [isSyncing, setIsSyncing] = useState(false);
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
    const [selectedLocalDashboard, setSelectedLocalDashboard] = useState<boolean>(true);

    // Selection state for receiving
    const [selectedReceivedScans, setSelectedReceivedScans] = useState<Set<string>>(new Set());
    const [selectedReceivedExportProfiles, setSelectedReceivedExportProfiles] = useState<Set<string>>(new Set());
    const [selectedReceivedTableProfiles, setSelectedReceivedTableProfiles] = useState<Set<string>>(new Set());
    const [selectedReceivedSettings, setSelectedReceivedSettings] = useState<Set<string>>(new Set());
    const [selectedReceivedDashboard, setSelectedReceivedDashboard] = useState<boolean>(true);

    // Expand state
    const [expandedSection, setExpandedSection] = useState<string | null>(null);

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
        setSelectedLocalDashboard(!!dashboardConfig);

        const handleData = (data: any) => {
            if (data.type === 'SYNC_DATA_PAYLOAD') {
                setReceivedData(data.payload);
                setSelectedReceivedScans(new Set(data.payload.scans.map((s: any) => s.id)));
                setSelectedReceivedExportProfiles(new Set(data.payload.exportProfiles.map((p: any) => p.id)));
                setSelectedReceivedTableProfiles(new Set(data.payload.tableProfiles.map((p: any) => p.id)));
                setSelectedReceivedDashboard(!!data.payload.dashboardConfig);
                
                if (data.payload.settings) {
                    setSelectedReceivedSettings(new Set(Object.keys(data.payload.settings)));
                } else {
                    setSelectedReceivedSettings(new Set());
                }

                setStatus("Data received! Review and save.");
            } else if (data.type === 'SYNC_ACK') {
                setIsSyncing(false);
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
        (service as any).onDataReceived = handleData;
        (service as any).onStatusChange = handleStatus;

    }, [service]);

    const handleSendData = () => {
        setIsSyncing(true);
        setStatus("Sending data...");
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

        service.send({ type: 'SYNC_DATA_PAYLOAD', payload });
    };

    const handleSaveReceivedData = () => {
        if (!receivedData) return;
        
        setIsSyncing(true);
        setStatus("Saving received data...");

        try {
            importSyncData(
                receivedData,
                selectedReceivedScans,
                selectedReceivedExportProfiles,
                selectedReceivedTableProfiles,
                selectedReceivedDashboard
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
            setSelectedLocalDashboard(!!newDashboardConfig);
            
            setReceivedData(null);
            setStatus("Data saved successfully!");
            service.send({ type: 'SYNC_ACK', payload: { success: true } });
            
            setTimeout(() => {
                setIsSyncing(false);
                setStatus("Connected. Ready to sync.");
                if (selectedReceivedSettings.size > 0 || selectedReceivedDashboard) {
                    window.location.reload();
                }
            }, 2000);

        } catch (error) {
            console.error("Error saving synced data", error);
            setStatus("Error saving data.");
            setIsSyncing(false);
        }
    };

    const handleDiscardReceivedData = () => {
        setReceivedData(null);
        setStatus("Received data discarded.");
        setTimeout(() => setStatus("Connected. Ready to sync."), 2000);
    };

    const toggleSet = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
        const newSet = new Set(set);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setter(newSet);
    };

    const totalLocalSelected = selectedLocalScans.size + selectedLocalExportProfiles.size + selectedLocalTableProfiles.size + selectedLocalSettings.size + (selectedLocalDashboard ? 1 : 0);
    const totalReceivedSelected = selectedReceivedScans.size + selectedReceivedExportProfiles.size + selectedReceivedTableProfiles.size + selectedReceivedSettings.size + (selectedReceivedDashboard ? 1 : 0);

    return (
        <div className="p-4 max-w-4xl mx-auto animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Database className="w-6 h-6 text-blue-600" />
                            Data Synchronization
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">{status}</p>
                    </div>
                    <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
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
                                            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={handleSendData}
                            disabled={isSyncing || totalLocalSelected === 0}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                        >
                            {isSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                            Send Selected ({totalLocalSelected})
                        </button>
                    </div>

                    {/* Remote Data Section */}
                    <div className="space-y-6">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b pb-2">Received Data</h3>
                        
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
                                    {receivedData.dashboardConfig && (
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                                            <div 
                                                className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                                onClick={() => setSelectedReceivedDashboard(!selectedReceivedDashboard)}
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
                                                        checked={selectedReceivedDashboard}
                                                        onChange={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedReceivedDashboard(e.target.checked);
                                                        }}
                                                        className="w-5 h-5 rounded border-slate-300 text-green-600 focus:ring-green-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3">
                                    <button 
                                        onClick={handleDiscardReceivedData}
                                        disabled={isSyncing}
                                        className="flex-1 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
                                    >
                                        Discard
                                    </button>
                                    <button 
                                        onClick={handleSaveReceivedData}
                                        disabled={isSyncing || totalReceivedSelected === 0}
                                        className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                                    >
                                        {isSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
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
        </div>
    );
}
