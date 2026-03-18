import React, { useState, useEffect, useRef } from "react";
import { X, Save, Download, Upload, Trash2, Check, LayoutTemplate, Edit2 } from "lucide-react";
import { ColumnConfig, TableProfile } from "../types";

interface TableProfileManagerProps {
  open: boolean;
  onClose: () => void;
  currentConfigs: ColumnConfig[];
  currentOrder: string[];
  currentConstants: Record<string, string | number>;
  onApplyProfile: (configs: ColumnConfig[], order: string[], constants: Record<string, string | number>) => void;
  onRequestConfirm?: (
    cfg: { title: string; message: string; confirmText?: string; cancelText?: string },
    onConfirm: () => void
  ) => void;
}

const STORAGE_KEY = "table_profiles";

export default function TableProfileManager({
  open,
  onClose,
  currentConfigs,
  currentOrder,
  currentConstants,
  onApplyProfile,
  onRequestConfirm,
}: TableProfileManagerProps) {
  const [profiles, setProfiles] = useState<TableProfile[]>([]);
  const [newProfileName, setNewProfileName] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfileName, setEditingProfileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      loadProfiles();
    }
  }, [open]);

  const loadProfiles = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setProfiles(JSON.parse(stored));
      }
    } catch (err) {
      console.error("Failed to load table profiles", err);
    }
  };

  const saveProfiles = (newProfiles: TableProfile[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newProfiles));
    setProfiles(newProfiles);
  };

  const handleSaveCurrent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;

    const newProfile: TableProfile = {
      id: `profile-${Date.now()}`,
      name: newProfileName.trim(),
      columnConfigs: currentConfigs,
      columnOrder: currentOrder,
      constants: currentConstants,
      updatedAt: Date.now(),
    };

    saveProfiles([...profiles, newProfile]);
    setNewProfileName("");
  };

  const handleDelete = (id: string) => {
    if (onRequestConfirm) {
      onRequestConfirm(
        { title: "Delete Profile", message: "Are you sure you want to delete this profile?", confirmText: "Delete", cancelText: "Cancel" },
        () => saveProfiles(profiles.filter((p) => p.id !== id))
      );
    } else {
      saveProfiles(profiles.filter((p) => p.id !== id));
    }
  };

  const startEditing = (profile: TableProfile) => {
    setEditingProfileId(profile.id);
    setEditingProfileName(profile.name);
  };

  const saveEditing = (id: string) => {
    if (!editingProfileName.trim()) return;
    saveProfiles(profiles.map(p => p.id === id ? { ...p, name: editingProfileName.trim(), updatedAt: Date.now() } : p));
    setEditingProfileId(null);
  };

  const cancelEditing = () => {
    setEditingProfileId(null);
    setEditingProfileName("");
  };

  const handleApply = (profile: TableProfile) => {
    if (onRequestConfirm) {
      onRequestConfirm(
        { title: "Apply Profile", message: `Apply profile "${profile.name}"? This will overwrite your current table structure and constants.`, confirmText: "Apply", cancelText: "Cancel" },
        () => {
          onApplyProfile(profile.columnConfigs, profile.columnOrder, profile.constants || {});
          onClose();
        }
      );
    } else {
      onApplyProfile(profile.columnConfigs, profile.columnOrder, profile.constants || {});
      onClose();
    }
  };

  const handleDownload = (profile: TableProfile) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(profile, null, 2));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `table-profile-${profile.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleUploadClick = () => {
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content) as Partial<TableProfile>;

        // Basic validation
        if (!parsed.name || !Array.isArray(parsed.columnConfigs) || !Array.isArray(parsed.columnOrder)) {
          setUploadError("Invalid profile file format.");
          return;
        }

        const newProfile: TableProfile = {
          id: `profile-${Date.now()}`,
          name: parsed.name + " (Imported)",
          columnConfigs: parsed.columnConfigs,
          columnOrder: parsed.columnOrder,
          constants: parsed.constants || {},
          updatedAt: Date.now(),
        };

        saveProfiles([...profiles, newProfile]);
      } catch (err) {
        console.error("Error parsing profile file", err);
        setUploadError("Failed to parse the profile file. Ensure it is a valid JSON.");
      }
      
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <LayoutTemplate className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Table Profiles</h3>
              <p className="text-xs text-slate-500">Save and reuse column structures, formulas, and constants.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
          <form onSubmit={handleSaveCurrent} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="Profile Name (e.g., Standard Timesheet)"
              className="flex-1 p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              required
            />
            <button
              type="submit"
              disabled={!newProfileName.trim()}
              className="flex items-center justify-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Current Table
            </button>
          </form>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Saved Profiles</h4>
            <button
              onClick={handleUploadClick}
              className="flex items-center text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
            >
              <Upload className="w-3.5 h-3.5 mr-1" />
              Import Profile
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              className="hidden"
            />
          </div>

          {uploadError && (
            <div className="p-3 mb-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-800">
              {uploadError}
            </div>
          )}

          {profiles.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              <LayoutTemplate className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">No profiles saved yet.</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Save your current table structure above.</p>
            </div>
          ) : (
            profiles.map((profile) => (
              <div key={profile.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl gap-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                <div className="flex-1 min-w-0">
                  {editingProfileId === profile.id ? (
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="text"
                        value={editingProfileName}
                        onChange={(e) => setEditingProfileName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditing(profile.id);
                          if (e.key === 'Escape') cancelEditing();
                        }}
                        className="flex-1 px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        autoFocus
                      />
                      <button onClick={() => saveEditing(profile.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded"><Check className="w-4 h-4" /></button>
                      <button onClick={cancelEditing} className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-1">
                      <h5 className="font-medium text-slate-800 dark:text-white truncate">{profile.name}</h5>
                      <button onClick={() => startEditing(profile)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors" title="Edit name">
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {profile.columnOrder?.length || profile.columnConfigs.length} Columns • {Object.keys(profile.constants || {}).length} Constants • Last updated {new Date(profile.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    onClick={() => handleApply(profile)}
                    className="flex items-center px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Check className="w-4 h-4 mr-1.5" />
                    Apply
                  </button>
                  <button
                    onClick={() => handleDownload(profile)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                    title="Download Profile"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(profile.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    title="Delete Profile"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-5 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
