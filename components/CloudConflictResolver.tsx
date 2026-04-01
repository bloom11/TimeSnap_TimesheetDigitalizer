import React, { useState, useEffect } from 'react';
import { SyncDataPayload, ConflictResolutionMap, ConflictResolutionChoice } from '../types';
import { getHistory, getExportProfiles, getTableProfiles, getDashboardConfig } from '../services/storageService';
import { AlertTriangle, Cloud, HardDrive, Copy } from 'lucide-react';

interface CloudConflictResolverProps {
  isOpen: boolean;
  remoteData: SyncDataPayload | null;
  onResolve: (resolutions: ConflictResolutionMap, settingsResolution: 'skip' | 'overwrite') => void;
  onCancel: () => void;
}

export const CloudConflictResolver: React.FC<CloudConflictResolverProps> = ({
  isOpen,
  remoteData,
  onResolve,
  onCancel
}) => {
  const [resolutions, setResolutions] = useState<ConflictResolutionMap>({});
  const [settingsResolution, setSettingsResolution] = useState<'skip' | 'overwrite'>('skip');

  const [conflicts, setConflicts] = useState<{
    scans: any[];
    exportProfiles: any[];
    tableProfiles: any[];
    widgets: any[];
    hasSettingsConflict: boolean;
  }>({ scans: [], exportProfiles: [], tableProfiles: [], widgets: [], hasSettingsConflict: false });

  useEffect(() => {
    if (isOpen && remoteData) {
      const localScans = getHistory();
      const localExportProfiles = getExportProfiles();
      const localTableProfiles = getTableProfiles();
      const localWidgets = getDashboardConfig().widgets;

      const conflictingScans = remoteData.scans.filter(rs => localScans.some(ls => ls.id === rs.id));
      const conflictingExportProfiles = remoteData.exportProfiles.filter(rp => localExportProfiles.some(lp => lp.id === rp.id));
      const conflictingTableProfiles = remoteData.tableProfiles.filter(rp => localTableProfiles.some(lp => lp.id === rp.id));
      const remoteWidgets = remoteData.widgets || remoteData.dashboardConfig?.widgets || [];
      const conflictingWidgets = remoteWidgets.filter(rw => localWidgets.some(lw => lw.id === rw.id));

      setConflicts({
        scans: conflictingScans,
        exportProfiles: conflictingExportProfiles,
        tableProfiles: conflictingTableProfiles,
        widgets: conflictingWidgets,
        hasSettingsConflict: !!remoteData.settings
      });

      // Default to 'rename' (Keep Both) for items, and 'skip' (Keep Local) for settings
      const initialResolutions: ConflictResolutionMap = {};
      conflictingScans.forEach(s => initialResolutions[s.id] = 'rename');
      conflictingExportProfiles.forEach(p => initialResolutions[p.id] = 'rename');
      conflictingTableProfiles.forEach(p => initialResolutions[p.id] = 'rename');
      conflictingWidgets.forEach(w => initialResolutions[w.id] = 'rename');
      setResolutions(initialResolutions);
      setSettingsResolution('skip');
    }
  }, [isOpen, remoteData]);

  if (!isOpen || !remoteData) return null;

  const handleResolutionChange = (id: string, choice: ConflictResolutionChoice) => {
    setResolutions(prev => ({ ...prev, [id]: choice }));
  };

  const renderConflictItem = (id: string, name: string, type: string) => {
    const currentChoice = resolutions[id] || 'rename';
    return (
      <div key={id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg mb-2 gap-2 border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col">
          <span className="font-medium text-sm text-slate-900 dark:text-white">{name}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{type}</span>
        </div>
        <div className="flex gap-1">
          <button 
            onClick={() => handleResolutionChange(id, 'rename')}
            className={`flex items-center px-2 py-1 text-xs rounded-md font-medium transition-colors ${currentChoice === 'rename' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
            title="Keep Both (Renames local copy)"
          >
            <Copy className="w-3 h-3 mr-1" /> Both
          </button>
          <button 
            onClick={() => handleResolutionChange(id, 'overwrite')}
            className={`flex items-center px-2 py-1 text-xs rounded-md font-medium transition-colors ${currentChoice === 'overwrite' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
            title="Keep Online (Overwrites local)"
          >
            <Cloud className="w-3 h-3 mr-1" /> Online
          </button>
          <button 
            onClick={() => handleResolutionChange(id, 'skip')}
            className={`flex items-center px-2 py-1 text-xs rounded-md font-medium transition-colors ${currentChoice === 'skip' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
            title="Keep Local (Ignores online)"
          >
            <HardDrive className="w-3 h-3 mr-1" /> Local
          </button>
        </div>
      </div>
    );
  };

  const handleResolve = () => {
    console.log('[Sync Debug] User clicked Resolve & Sync. Final resolutions:', resolutions, 'settingsResolution:', settingsResolution);
    onResolve(resolutions, settingsResolution);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3 mb-2 text-amber-500">
            <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-full"><AlertTriangle className="w-5 h-5" /></div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Sync Conflicts Detected</h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Both your local device and Google Drive have changes. Choose how to handle the conflicting items below.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {conflicts.scans.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold mb-3 text-sm text-slate-800 dark:text-slate-200">Scans</h4>
              {conflicts.scans.map(s => renderConflictItem(s.id, s.name, 'Scan'))}
            </div>
          )}

          {conflicts.widgets.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold mb-3 text-sm text-slate-800 dark:text-slate-200">Widgets</h4>
              {conflicts.widgets.map(w => renderConflictItem(w.id, w.title, 'Widget'))}
            </div>
          )}

          {conflicts.exportProfiles.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold mb-3 text-sm text-slate-800 dark:text-slate-200">Export Profiles</h4>
              {conflicts.exportProfiles.map(p => renderConflictItem(p.id, p.name, 'Export Profile'))}
            </div>
          )}

          {conflicts.tableProfiles.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold mb-3 text-sm text-slate-800 dark:text-slate-200">Table Profiles</h4>
              {conflicts.tableProfiles.map(p => renderConflictItem(p.id, p.name, 'Table Profile'))}
            </div>
          )}

          {conflicts.hasSettingsConflict && (
            <div className="mb-6">
              <h4 className="font-semibold mb-3 text-sm text-slate-800 dark:text-slate-200">App Settings</h4>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg gap-2 border border-slate-200 dark:border-slate-700">
                <span className="font-medium text-sm text-slate-900 dark:text-white">Global Settings & AI Prompts</span>
                <div className="flex gap-1">
                  <button 
                    onClick={() => setSettingsResolution('overwrite')}
                    className={`flex items-center px-2 py-1 text-xs rounded-md font-medium transition-colors ${settingsResolution === 'overwrite' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                  >
                    <Cloud className="w-3 h-3 mr-1" /> Keep Online
                  </button>
                  <button 
                    onClick={() => setSettingsResolution('skip')}
                    className={`flex items-center px-2 py-1 text-xs rounded-md font-medium transition-colors ${settingsResolution === 'skip' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                  >
                    <HardDrive className="w-3 h-3 mr-1" /> Keep Local
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-800 shrink-0 flex justify-end gap-3 bg-slate-50 dark:bg-slate-950 rounded-b-2xl">
          <button 
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel Sync
          </button>
          <button 
            onClick={handleResolve}
            className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            Resolve & Sync
          </button>
        </div>
      </div>
    </div>
  );
};
