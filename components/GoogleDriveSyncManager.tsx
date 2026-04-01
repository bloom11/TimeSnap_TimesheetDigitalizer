
import React, { useEffect, useRef, useState } from 'react';
import { getSettings, saveSettings } from '../services/settingsService';
import { uploadToDrive, downloadFromDrive } from '../services/googleDriveService';
import { importSyncData, getHistory, getExportProfiles, getTableProfiles, getDashboardConfig } from '../services/storageService';
import { syncEmitter } from '../services/syncEmitter';
import { SyncService } from '../services/syncService';
import { CloudConflictResolver } from './CloudConflictResolver';
import { SyncDataPayload, ConflictResolutionMap } from '../types';

export default function GoogleDriveSyncManager() {
    const [isSyncing, setIsSyncing] = useState(false);
    const [conflictData, setConflictData] = useState<SyncDataPayload | null>(null);
    const isSyncingRef = useRef(false);
    const lastSyncRef = useRef<number>(0);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    const performSync = async () => {
        const settings = getSettings();
        if (!settings.googleDriveSyncEnabled || !settings.googleClientId) return;
        
        if (isSyncingRef.current) {
            SyncService.log('info', 'Sync already in progress, skipping...');
            return;
        }

        try {
            setIsSyncing(true);
            isSyncingRef.current = true;
            
            // 1. Download latest from Drive to check for updates
            const remoteData = await downloadFromDrive(undefined, false, true);
            
            // The "Golden Rule" Logic:
            const remoteTimestamp = remoteData?.lastCloudSyncTimestamp || remoteData?.settings?.lastCloudSyncTimestamp || 0;
            const localLastSync = settings.lastCloudSyncTimestamp || 0;
            const localLastChange = settings.lastLocalChangeTimestamp || 0;

            console.log('[Sync Debug] Auto-sync check started...');
            console.log(`[Sync Debug] Timestamps - Remote: ${remoteTimestamp}, LocalLastSync: ${localLastSync}, LocalLastChange: ${localLastChange}`);

            SyncService.log('info', `Sync Check - Remote: ${new Date(remoteTimestamp).toLocaleString()}, Local Last Sync: ${new Date(localLastSync).toLocaleString()}, Local Last Change: ${new Date(localLastChange).toLocaleString()}`);

            const hasRemoteChanges = remoteData && remoteTimestamp > localLastSync;
            const hasLocalChanges = localLastChange > localLastSync || !remoteData;

            console.log(`[Sync Debug] Flags - hasRemoteChanges: ${hasRemoteChanges}, hasLocalChanges: ${hasLocalChanges}`);

            if (hasRemoteChanges && hasLocalChanges && remoteData) {
                console.log('[Sync Debug] Both remote and local have changes. Checking for micro-conflicts...');
                // Check for actual ID overlaps (Micro conflicts)
                const localScans = getHistory();
                const localExportProfiles = getExportProfiles();
                const localTableProfiles = getTableProfiles();
                const localWidgets = getDashboardConfig().widgets;

                const hasScanConflict = remoteData.scans.some(rs => localScans.some(ls => ls.id === rs.id));
                const hasExportConflict = remoteData.exportProfiles.some(rp => localExportProfiles.some(lp => lp.id === rp.id));
                const hasTableConflict = remoteData.tableProfiles.some(rp => localTableProfiles.some(lp => lp.id === rp.id));
                const remoteWidgets = remoteData.widgets || remoteData.dashboardConfig?.widgets || [];
                const hasWidgetConflict = remoteWidgets.some(rw => localWidgets.some(lw => lw.id === rw.id));
                const hasSettingsConflict = !!remoteData.settings;

                console.log('[Sync Debug] Conflict flags:', { hasScanConflict, hasExportConflict, hasTableConflict, hasWidgetConflict, hasSettingsConflict });

                if (hasScanConflict || hasExportConflict || hasTableConflict || hasWidgetConflict || hasSettingsConflict) {
                    // TRUE CONFLICT: Both changed independently and have overlapping IDs
                    console.log('[Sync Debug] True conflict detected. Triggering conflict resolution UI.');
                    SyncService.log('warn', `True conflict detected. Pausing auto-sync for user resolution.`);
                    setConflictData(remoteData);
                    return; // Stop auto-sync until resolved
                }

                // If no actual ID overlaps, safely auto-merge
                console.log('[Sync Debug] Independent changes detected with no overlaps. Auto-merging...');
                SyncService.log('info', `Independent changes detected with no overlaps. Auto-merging...`);
                importSyncData(
                    remoteData,
                    new Set(remoteData.scans.map(s => s.id)),
                    new Set(remoteData.exportProfiles.map(p => p.id)),
                    new Set(remoteData.tableProfiles.map(p => p.id)),
                    new Set(remoteWidgets.map(w => w.id)),
                    'skip'
                );
                const syncNow = Date.now();
                await uploadToDrive(undefined, false, true, syncNow);
                saveSettings({
                    ...getSettings(),
                    lastCloudSyncTimestamp: syncNow
                });
                lastSyncRef.current = syncNow;
                SyncService.log('success', 'Data merged and synced successfully.');
                setIsSyncing(false);
                isSyncingRef.current = false;
                return;
            }

            if (hasRemoteChanges) {
                // Remote is newer, import it
                SyncService.log('info', `Cloud backup is newer. Downloading...`);
                importSyncData(
                    remoteData,
                    new Set(remoteData.scans.map(s => s.id)),
                    new Set(remoteData.exportProfiles.map(p => p.id)),
                    new Set(remoteData.tableProfiles.map(p => p.id)),
                    new Set(remoteData.widgets?.map(w => w.id) || []),
                    'overwrite'
                );
                
                // Update local timestamp to match remote
                saveSettings({
                    ...getSettings(),
                    lastCloudSyncTimestamp: remoteTimestamp
                });
                SyncService.log('success', 'Cloud data imported successfully.');
            } else if (hasLocalChanges) {
                // Local changes detected since last sync, or no remote file exists
                SyncService.log('info', `Local changes detected since last sync. Uploading...`);
                const now = Date.now();
                await uploadToDrive(undefined, false, true, now);
                
                // Update local timestamp
                saveSettings({
                    ...getSettings(),
                    lastCloudSyncTimestamp: now
                });
                lastSyncRef.current = now;
                SyncService.log('success', 'Local data uploaded successfully.');
            } else {
                SyncService.log('info', 'Data is already in sync.');
            }
        } catch (error: any) {
            if (error?.error === 'popup_blocked_by_browser') {
                console.log("Auto-sync paused: Requires manual sync first to authorize.");
            } else {
                console.error("Auto-sync failed", error);
            }
        } finally {
            if (!conflictData) { // Don't clear syncing state if waiting for conflict resolution
                setIsSyncing(false);
                isSyncingRef.current = false;
            }
        }
    };

    const handleResolveConflict = async (resolutions: ConflictResolutionMap, settingsResolution: 'skip' | 'overwrite') => {
        if (!conflictData) return;
        
        try {
            // Apply resolutions locally
            importSyncData(
                conflictData,
                new Set(conflictData.scans.map(s => s.id)),
                new Set(conflictData.exportProfiles.map(p => p.id)),
                new Set(conflictData.tableProfiles.map(p => p.id)),
                new Set(conflictData.widgets?.map(w => w.id) || []),
                'skip', // Default skip for anything not explicitly resolved
                resolutions
            );

            if (settingsResolution === 'overwrite' && conflictData.settings) {
                // Apply remote settings
                saveSettings({
                    ...getSettings(),
                    ...conflictData.settings,
                    lastCloudSyncTimestamp: getSettings().lastCloudSyncTimestamp // Preserve local sync timestamp for now
                });
            }

            // Upload the merged state back to drive
            const syncNow = Date.now();
            await uploadToDrive(undefined, false, false, syncNow);
            
            // Update local timestamp
            saveSettings({
                ...getSettings(),
                lastCloudSyncTimestamp: syncNow
            });
            lastSyncRef.current = syncNow;
            SyncService.log('success', 'Conflict resolved and merged state uploaded.');
            
            setConflictData(null);
            setIsSyncing(false);
            isSyncingRef.current = false;
        } catch (error) {
            console.error("Failed to resolve conflict", error);
            alert("Failed to resolve conflict and upload. Please try again.");
            setConflictData(null);
            setIsSyncing(false);
            isSyncingRef.current = false;
        }
    };

    useEffect(() => {
        const settings = getSettings();
        if (settings.googleDriveSyncEnabled && settings.googleClientId) {
            // Initial sync on mount
            performSync();
        }

        // Listen for local changes
        const unsubscribe = syncEmitter.subscribe(() => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            
            debounceTimerRef.current = setTimeout(() => {
                performSync();
            }, 5000); // 5 second debounce
        });

        return () => {
            unsubscribe();
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        };
    }, []);

    return (
        <CloudConflictResolver 
            isOpen={!!conflictData}
            remoteData={conflictData}
            onResolve={handleResolveConflict}
            onCancel={() => {
                setConflictData(null);
                setIsSyncing(false);
                isSyncingRef.current = false;
            }}
        />
    );
};
