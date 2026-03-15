
import { SavedScan, TimeEntry, ColumnConfig, ExportProfile } from "../types";

const STORAGE_KEY = 'timesnap_history';
const PROFILES_KEY = 'timesnap_export_profiles';

export const getHistory = (): SavedScan[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load history", e);
    return [];
  }
};

export const saveScan = (entries: TimeEntry[], columnConfigs?: ColumnConfig[], columnOrder?: string[]): SavedScan => {
  const history = getHistory();
  const newScan: SavedScan = {
    id: `scan-${Date.now()}`,
    timestamp: Date.now(),
    name: `Scan ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
    entries,
    columnConfigs,
    columnOrder
  };
  
  const updatedHistory = [newScan, ...history].slice(0, 20);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
  return newScan;
};

export const updateScan = (id: string, entries: TimeEntry[], columnConfigs?: ColumnConfig[], columnOrder?: string[]) => {
  const history = getHistory();
  const updated = history.map(h => h.id === id ? { 
    ...h, 
    entries, 
    columnConfigs: columnConfigs || h.columnConfigs,
    columnOrder: columnOrder || h.columnOrder
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
            columnConfigs: parsed.columnConfigs
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
