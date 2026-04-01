
import { SavedScan, TimeEntry, ColumnConfig, ExportProfile, TableProfile, SyncDataPayload, DashboardConfig } from "../types";
import { syncEmitter } from "./syncEmitter";
import { getSettings, saveSettings } from "./settingsService";

const STORAGE_KEY = 'timesnap_history';
const PROFILES_KEY = 'timesnap_export_profiles';
const TABLE_PROFILES_KEY = 'table_profiles';
const DASHBOARD_KEY = 'timesnap_dashboard_config';

const updateLastLocalChange = () => {
  const settings = getSettings();
  saveSettings({
    ...settings,
    lastLocalChangeTimestamp: Date.now()
  });
};

export const getHistory = (): SavedScan[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load history", e);
    return [];
  }
};

export const saveScan = (entries: TimeEntry[], columnConfigs?: ColumnConfig[], columnOrder?: string[], constants?: Record<string, string | number>): SavedScan => {
  const history = getHistory();
  const newScan: SavedScan = {
    id: `scan-${Date.now()}`,
    timestamp: Date.now(),
    name: `Scan ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
    entries,
    columnConfigs,
    columnOrder,
    constants
  };
  
  const updatedHistory = [newScan, ...history].slice(0, 20);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
  updateLastLocalChange();
  syncEmitter.emit();
  return newScan;
};

export const updateScan = (id: string, entries: TimeEntry[], columnConfigs?: ColumnConfig[], columnOrder?: string[], constants?: Record<string, string | number>) => {
  const history = getHistory();
  const updated = history.map(h => h.id === id ? { 
    ...h, 
    entries, 
    columnConfigs: columnConfigs || h.columnConfigs,
    columnOrder: columnOrder || h.columnOrder,
    constants: constants || h.constants
  } : h);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  updateLastLocalChange();
  syncEmitter.emit();
};

export const deleteScan = (id: string) => {
  const history = getHistory();
  const updated = history.filter(h => h.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  updateLastLocalChange();
  syncEmitter.emit();
};

export const updateScanName = (id: string, name: string) => {
  const history = getHistory();
  const updated = history.map(h => h.id === id ? { ...h, name } : h);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  updateLastLocalChange();
  syncEmitter.emit();
};

export const importSavedScan = (jsonString: string): boolean => {
    try {
        const parsed = JSON.parse(jsonString);
        if (!parsed || !Array.isArray(parsed.entries)) return false;

        const history = getHistory();
        const newScan: SavedScan = {
            id: `imported-${Date.now()}`,
            timestamp: parsed.timestamp || Date.now(),
            name: parsed.name ? `${parsed.name} (Imported)` : `Imported Scan ${new Date().toLocaleTimeString()}`,
            entries: parsed.entries,
            columnConfigs: parsed.columnConfigs,
            columnOrder: parsed.columnOrder,
            constants: parsed.constants
        };

        const updatedHistory = [newScan, ...history].slice(0, 25);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
        updateLastLocalChange();
        syncEmitter.emit();
        return true;
    } catch (e) {
        return false;
    }
};

// --- Export Profiles ---

export const getExportProfiles = (): ExportProfile[] => {
    try {
        const raw = localStorage.getItem(PROFILES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
};

export const saveExportProfile = (profile: ExportProfile | Omit<ExportProfile, 'id'>): ExportProfile => {
    const profiles = getExportProfiles();
    
    if ('id' in profile && profile.id) {
        const existingIndex = profiles.findIndex(p => p.id === profile.id);
        if (existingIndex >= 0) {
            profiles[existingIndex] = profile as ExportProfile;
            localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
            updateLastLocalChange();
            return profile as ExportProfile;
        }
    }
    
    const newProfile: ExportProfile = {
        ...profile,
        id: ('id' in profile && profile.id) ? profile.id : `profile-${Date.now()}`
    };
    localStorage.setItem(PROFILES_KEY, JSON.stringify([...profiles, newProfile]));
    updateLastLocalChange();
    syncEmitter.emit();
    return newProfile;
};

export const deleteExportProfile = (id: string) => {
    const profiles = getExportProfiles();
    const updated = profiles.filter(p => p.id !== id);
    localStorage.setItem(PROFILES_KEY, JSON.stringify(updated));
    updateLastLocalChange();
    syncEmitter.emit();
};

// --- Table Profiles ---

export const getTableProfiles = (): TableProfile[] => {
    try {
        const raw = localStorage.getItem(TABLE_PROFILES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
};

export const saveTableProfile = (profile: TableProfile) => {
    const profiles = getTableProfiles();
    const existingIndex = profiles.findIndex(p => p.id === profile.id);
    
    if (existingIndex >= 0) {
        profiles[existingIndex] = profile;
    } else {
        profiles.push(profile);
    }
    
    localStorage.setItem(TABLE_PROFILES_KEY, JSON.stringify(profiles));
    updateLastLocalChange();
    syncEmitter.emit();
    return profile;
};

export const deleteTableProfile = (id: string) => {
    const profiles = getTableProfiles();
    const updated = profiles.filter(p => p.id !== id);
    localStorage.setItem(TABLE_PROFILES_KEY, JSON.stringify(updated));
    updateLastLocalChange();
    syncEmitter.emit();
};

export const importSyncData = (
    data: SyncDataPayload,
    selectedScans: Set<string>,
    selectedExportProfiles: Set<string>,
    selectedTableProfiles: Set<string>,
    selectedWidgets: Set<string> = new Set(),
    conflictResolution: 'skip' | 'overwrite' | 'rename' = 'skip',
    itemResolutions: Record<string, 'skip' | 'overwrite' | 'rename'> = {}
) => {
    console.log('[Sync Debug] importSyncData called with globalResolution:', conflictResolution, 'itemResolutions:', itemResolutions);
    
    // Save Scans
    let currentHistory = getHistory();
    const existingScanIds = new Set(currentHistory.map(s => s.id));
    let newScansAdded = false;

    data.scans.filter(s => selectedScans.has(s.id)).forEach(scan => {
        if (existingScanIds.has(scan.id)) {
            const res = itemResolutions[scan.id] || conflictResolution;
            console.log(`[Sync Debug] Scan conflict for ${scan.id} (${scan.name}). Applying resolution: ${res}`);
            if (res === 'skip') return;
            if (res === 'overwrite') {
                const index = currentHistory.findIndex(s => s.id === scan.id);
                if (index >= 0) currentHistory[index] = scan;
                newScansAdded = true;
            } else if (res === 'rename') {
                const newScan = { ...scan, id: crypto.randomUUID(), name: `${scan.name} (Copy)` };
                currentHistory = [newScan, ...currentHistory];
                newScansAdded = true;
            }
        } else {
            console.log(`[Sync Debug] Adding new scan from cloud: ${scan.id} (${scan.name})`);
            currentHistory = [scan, ...currentHistory];
            newScansAdded = true;
        }
    });

    if (newScansAdded) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentHistory.slice(0, 25)));
        syncEmitter.emit();
    }

    // Save Export Profiles
    const currentExportProfiles = getExportProfiles();
    const existingExportIds = new Set(currentExportProfiles.map(p => p.id));
    data.exportProfiles.filter(p => selectedExportProfiles.has(p.id)).forEach(profile => {
        if (existingExportIds.has(profile.id)) {
            const res = itemResolutions[profile.id] || conflictResolution;
            console.log(`[Sync Debug] Export Profile conflict for ${profile.id} (${profile.name}). Applying resolution: ${res}`);
            if (res === 'skip') return;
            if (res === 'overwrite') {
                saveExportProfile(profile);
            } else if (res === 'rename') {
                saveExportProfile({ ...profile, id: crypto.randomUUID(), name: `${profile.name} (Copy)` });
            }
        } else {
            console.log(`[Sync Debug] Adding new export profile from cloud: ${profile.id} (${profile.name})`);
            saveExportProfile(profile);
        }
    });

    // Save Table Profiles
    const currentTableProfiles = getTableProfiles();
    const existingTableIds = new Set(currentTableProfiles.map(p => p.id));
    data.tableProfiles.filter(p => selectedTableProfiles.has(p.id)).forEach(profile => {
        if (existingTableIds.has(profile.id)) {
            const res = itemResolutions[profile.id] || conflictResolution;
            console.log(`[Sync Debug] Table Profile conflict for ${profile.id} (${profile.name}). Applying resolution: ${res}`);
            if (res === 'skip') return;
            if (res === 'overwrite') {
                saveTableProfile(profile);
            } else if (res === 'rename') {
                saveTableProfile({ ...profile, id: crypto.randomUUID(), name: `${profile.name} (Copy)` });
            }
        } else {
            console.log(`[Sync Debug] Adding new table profile from cloud: ${profile.id} (${profile.name})`);
            saveTableProfile(profile);
        }
    });

    // Save Widgets
    const remoteWidgets = data.widgets || data.dashboardConfig?.widgets || [];
    if (remoteWidgets.length > 0 && selectedWidgets.size > 0) {
        const currentDashboard = getDashboardConfig();
        const existingWidgetIds = new Set(currentDashboard.widgets.map(w => w.id));
        let newWidgets = [...currentDashboard.widgets];
        let widgetsChanged = false;

        remoteWidgets.filter(w => selectedWidgets.has(w.id)).forEach(widget => {
            if (existingWidgetIds.has(widget.id)) {
                const res = itemResolutions[widget.id] || conflictResolution;
                console.log(`[Sync Debug] Widget conflict for ${widget.id} (${widget.title}). Applying resolution: ${res}`);
                if (res === 'skip') return;
                if (res === 'overwrite') {
                    const index = newWidgets.findIndex(w => w.id === widget.id);
                    if (index >= 0) newWidgets[index] = widget;
                    widgetsChanged = true;
                } else if (res === 'rename') {
                    newWidgets.push({ ...widget, id: crypto.randomUUID(), title: `${widget.title} (Copy)` });
                    widgetsChanged = true;
                }
            } else {
                newWidgets.push(widget);
                widgetsChanged = true;
            }
        });

        if (widgetsChanged) {
            saveDashboardConfig({ ...currentDashboard, widgets: newWidgets });
        }
    }
    window.dispatchEvent(new CustomEvent('timesnap-data-changed'));
};

// --- Dashboard Config ---

export const getDashboardConfig = (): DashboardConfig => {
    try {
        const raw = localStorage.getItem(DASHBOARD_KEY);
        if (raw) {
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error("Failed to load dashboard config", e);
    }
    return {
        widgets: [],
        isDefaultHome: false
    };
};

export const saveDashboardConfig = (config: DashboardConfig) => {
    localStorage.setItem(DASHBOARD_KEY, JSON.stringify(config));
    updateLastLocalChange();
    syncEmitter.emit();
};
