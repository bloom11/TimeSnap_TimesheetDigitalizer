
import { SavedScan, TimeEntry, ColumnConfig, ExportProfile, TableProfile, SyncDataPayload, DashboardConfig } from "../types";

const STORAGE_KEY = 'timesnap_history';
const PROFILES_KEY = 'timesnap_export_profiles';
const TABLE_PROFILES_KEY = 'table_profiles';
const DASHBOARD_KEY = 'timesnap_dashboard_config';

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
};

export const deleteScan = (id: string) => {
  const history = getHistory();
  const updated = history.filter(h => h.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};

export const updateScanName = (id: string, name: string) => {
  const history = getHistory();
  const updated = history.map(h => h.id === id ? { ...h, name } : h);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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

export const saveExportProfile = (profile: Omit<ExportProfile, 'id'>): ExportProfile => {
    const profiles = getExportProfiles();
    const newProfile: ExportProfile = {
        ...profile,
        id: `profile-${Date.now()}`
    };
    localStorage.setItem(PROFILES_KEY, JSON.stringify([...profiles, newProfile]));
    return newProfile;
};

export const deleteExportProfile = (id: string) => {
    const profiles = getExportProfiles();
    const updated = profiles.filter(p => p.id !== id);
    localStorage.setItem(PROFILES_KEY, JSON.stringify(updated));
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
    return profile;
};

export const importSyncData = (
    data: SyncDataPayload,
    selectedScans: Set<string>,
    selectedExportProfiles: Set<string>,
    selectedTableProfiles: Set<string>,
    importDashboard: boolean = false
) => {
    // Save Scans
    let currentHistory = getHistory();
    const existingScanIds = new Set(currentHistory.map(s => s.id));
    let newScansAdded = false;

    data.scans.filter(s => selectedScans.has(s.id)).forEach(scan => {
        if (!existingScanIds.has(scan.id)) {
            currentHistory = [scan, ...currentHistory];
            newScansAdded = true;
        }
    });

    if (newScansAdded) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentHistory.slice(0, 25)));
    }

    // Save Export Profiles
    const currentExportProfiles = getExportProfiles();
    const existingExportIds = new Set(currentExportProfiles.map(p => p.id));
    data.exportProfiles.filter(p => selectedExportProfiles.has(p.id)).forEach(profile => {
        if (!existingExportIds.has(profile.id)) {
            saveExportProfile(profile);
        }
    });

    // Save Table Profiles
    const currentTableProfiles = getTableProfiles();
    const existingTableIds = new Set(currentTableProfiles.map(p => p.id));
    data.tableProfiles.filter(p => selectedTableProfiles.has(p.id)).forEach(profile => {
        if (!existingTableIds.has(profile.id)) {
            saveTableProfile(profile);
        }
    });

    // Save Dashboard Config
    if (importDashboard && data.dashboardConfig) {
        saveDashboardConfig(data.dashboardConfig);
    }
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
};
