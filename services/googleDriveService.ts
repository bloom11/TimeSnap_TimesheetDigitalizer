
import { AppSettings, SyncDataPayload, DriveFileMetadata } from "../types";
import { getHistory, getExportProfiles, getTableProfiles, getDashboardConfig } from "./storageService";
import { getSettings } from "./settingsService";
import { SyncService } from "./syncService";

const DRIVE_FILE_NAME = 'timesnap_sync_v1.json';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';

let tokenClient: any = null;
let gapiInited = false;
let gisInited = false;
let tokenExpirationTime = 0;

const TOKEN_STORAGE_KEY = 'timesnap_gdrive_token';

interface StoredToken {
    access_token: string;
    expires_at: number;
}

const getStoredToken = (): StoredToken | null => {
    try {
        const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored) as StoredToken;
            if (Date.now() < parsed.expires_at) {
                return parsed;
            } else {
                localStorage.removeItem(TOKEN_STORAGE_KEY);
            }
        }
    } catch (e) {
        // ignore parse errors
    }
    return null;
};

const saveStoredToken = (access_token: string, expires_in: number): number => {
    const expires_at = Date.now() + (expires_in * 1000) - (5 * 60 * 1000); // 5 min buffer
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ access_token, expires_at }));
    return expires_at;
};

export const isGoogleDriveSupported = () => {
    return typeof window !== 'undefined';
};

export const loadGoogleScripts = (): Promise<void> => {
    return new Promise((resolve) => {
        if (gapiInited && gisInited) {
            resolve();
            return;
        }

        // Load GAPI
        const gapiScript = document.createElement('script');
        gapiScript.src = 'https://apis.google.com/js/api.js';
        gapiScript.async = true;
        gapiScript.defer = true;
        gapiScript.onload = () => {
            (window as any).gapi.load('client', async () => {
                await (window as any).gapi.client.init({
                    discoveryDocs: [DISCOVERY_DOC],
                });
                gapiInited = true;
                if (gisInited) resolve();
            });
        };
        document.head.appendChild(gapiScript);

        // Load GIS
        const gisScript = document.createElement('script');
        gisScript.src = 'https://accounts.google.com/gsi/client';
        gisScript.async = true;
        gisScript.defer = true;
        gisScript.onload = () => {
            gisInited = true;
            if (gapiInited) resolve();
        };
        document.head.appendChild(gisScript);
    });
};

let currentClientId: string | null = null;

export const initializeTokenClient = (clientId: string) => {
    if (!clientId) return;
    tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: '', // defined at request time
        error_callback: (err: any) => {
            SyncService.log('error', `OAuth error callback: ${JSON.stringify(err)}`);
            console.error('OAuth error callback:', err);
        }
    });
    currentClientId = clientId;
};

export const getAccessToken = (customClientId?: string, forcePrompt: boolean = false, isBackground: boolean = false): Promise<string> => {
    return new Promise((resolve, reject) => {
        const targetClientId = customClientId || getSettings().googleClientId;
        
        if (!targetClientId) {
            reject(new Error("Google Client ID not configured"));
            return;
        }

        let timeoutId: any;

        const cleanup = () => {
            if (timeoutId) clearTimeout(timeoutId);
        };

        const isFirstInit = currentClientId === null;
        const isClientChanged = !isFirstInit && currentClientId !== targetClientId;

        if (!tokenClient || isClientChanged || isFirstInit) {
            initializeTokenClient(targetClientId);
            if (isClientChanged && (window as any).gapi && (window as any).gapi.client) {
                (window as any).gapi.client.setToken(null);
            }
        }

        // Set a 3-minute timeout to prevent infinite hangs if the popup is blocked or ignored
        timeoutId = setTimeout(() => {
            SyncService.log('error', 'Token request timed out. The popup might have been blocked or ignored.');
            reject(new Error("Token request timed out. Please check if your browser is blocking popups."));
        }, 3 * 60 * 1000);

        tokenClient.callback = async (resp: any) => {
            cleanup();
            SyncService.log('info', `OAuth callback triggered. Error present: ${resp.error !== undefined}`);
            if (resp.error !== undefined) {
                SyncService.log('error', `Token request failed: ${resp.error} - ${resp.error_description || ''}`);
                reject(resp);
                return;
            }
            
            const expiresIn = resp.expires_in ? parseInt(resp.expires_in, 10) : 3600;
            tokenExpirationTime = saveStoredToken(resp.access_token, expiresIn);
            
            SyncService.log('success', 'Access token received and saved successfully.');
            resolve(resp.access_token);
        };

        // We also need to hook into error_callback to clear the timeout if an error occurs early
        const originalErrorCallback = tokenClient.error_callback;
        tokenClient.error_callback = (err: any) => {
            cleanup();
            SyncService.log('error', `OAuth error callback: ${JSON.stringify(err)}`);
            console.error('OAuth error callback:', err);
            reject(new Error(`OAuth Error: ${err.type || JSON.stringify(err)}`));
            
            // Restore original if it existed (though we set it in initializeTokenClient)
            if (originalErrorCallback) originalErrorCallback(err);
        };

        const currentToken = (window as any).gapi.client.getToken();
        let isTokenValid = currentToken && Date.now() < tokenExpirationTime;

        // If memory token is missing/invalid, check localStorage
        // We allow restoration if it's the first init OR if the client hasn't changed
        if (!isTokenValid && !forcePrompt && !isClientChanged) {
            const stored = getStoredToken();
            if (stored) {
                (window as any).gapi.client.setToken({ access_token: stored.access_token });
                tokenExpirationTime = stored.expires_at;
                isTokenValid = true;
                SyncService.log('info', 'Restored valid token from local storage.');
            }
        }

        if (isTokenValid && !forcePrompt && !isClientChanged) {
            cleanup();
            SyncService.log('info', 'Using existing valid cached token.');
            resolve((window as any).gapi.client.getToken().access_token);
            return;
        }

        if (isBackground && !forcePrompt) {
            cleanup();
            SyncService.log('warn', 'Background sync paused: User interaction required for token.');
            reject({ error: 'popup_blocked_by_browser', message: 'Background sync requires user interaction first' });
            return;
        }

        SyncService.log('info', `Requesting new access token (prompt: ${forcePrompt ? 'consent' : 'none'})...`);
        try {
            tokenClient.requestAccessToken({ prompt: forcePrompt ? 'consent' : '' });
            SyncService.log('info', 'requestAccessToken called successfully. Waiting for popup...');
        } catch (err: any) {
            cleanup();
            SyncService.log('error', `Exception calling requestAccessToken: ${err.message || err}`);
            reject(err);
        }
    });
};

export const getSyncPayload = (): SyncDataPayload => {
    return {
        scans: getHistory(),
        exportProfiles: getExportProfiles(),
        tableProfiles: getTableProfiles(),
        dashboardConfig: getDashboardConfig(),
        settings: {
            appearance: { theme: getSettings().theme },
            aiConfig: { 
                activeProvider: getSettings().activeProvider, 
                activeModel: getSettings().activeModel, 
                debugMode: getSettings().debugMode 
            },
            prompts: {
                aiSystemPrompt: getSettings().aiSystemPrompt,
                aiMappingPrompt: getSettings().aiMappingPrompt,
                aiOutputSchema: getSettings().aiOutputSchema
            },
            general: { 
                defaultYear: getSettings().defaultYear,
                autoFillMonthBoundaries: getSettings().autoFillMonthBoundaries
            },
            lastCloudSyncTimestamp: getSettings().lastCloudSyncTimestamp
        }
    };
};

export const uploadToDrive = async (customClientId?: string, forcePrompt: boolean = false, isBackground: boolean = false, timestamp?: number): Promise<void> => {
    try {
        SyncService.log('info', 'Starting upload to Google Drive...');
        await loadGoogleScripts();
        await getAccessToken(customClientId, forcePrompt, isBackground);

        const syncTime = timestamp || Date.now();
        const payload = getSyncPayload();
        
        // Ensure the timestamp is updated in the settings object within the payload
        if (payload.settings) {
            payload.settings.lastCloudSyncTimestamp = syncTime;
        }

        const content = JSON.stringify({
            ...payload,
            lastCloudSyncTimestamp: syncTime
        });

        SyncService.log('info', 'Searching for existing backup file...');
        // Search for existing file
        const response = await (window as any).gapi.client.drive.files.list({
            q: `name = '${DRIVE_FILE_NAME}'`,
            fields: 'files(id, name)',
            spaces: 'appDataFolder'
        });

        const files = response.result.files;
        SyncService.log('info', `Found ${files ? files.length : 0} files matching ${DRIVE_FILE_NAME} in appDataFolder.`);
        let fileId = files && files.length > 0 ? files[0].id : null;

        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";

        const contentType = 'application/json';
        const metadata: any = {
            'name': DRIVE_FILE_NAME,
            'mimeType': contentType
        };

        // Only include parents on creation (POST). Google Drive API v3 forbids 'parents' in PATCH body.
        if (!fileId) {
            metadata.parents = ['appDataFolder'];
        }

        SyncService.log('info', `Payload size to send: ${content.length} bytes`);

        const multipartRequestBody =
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            'Content-Type: ' + contentType + '\r\n\r\n' +
            content +
            close_delim;

        if (fileId) {
            SyncService.log('info', `Updating existing file (ID: ${fileId})...`);
            // Update existing file
            await (window as any).gapi.client.request({
                'path': `/upload/drive/v3/files/${fileId}`,
                'method': 'PATCH',
                'params': { 'uploadType': 'multipart' },
                'headers': {
                    'Content-Type': 'multipart/related; boundary=' + boundary
                },
                'body': multipartRequestBody
            });
            SyncService.log('success', 'File updated successfully.');
        } else {
            SyncService.log('info', 'Creating new backup file...');
            // Create new file
            await (window as any).gapi.client.request({
                'path': '/upload/drive/v3/files',
                'method': 'POST',
                'params': { 'uploadType': 'multipart' },
                'headers': {
                    'Content-Type': 'multipart/related; boundary=' + boundary
                },
                'body': multipartRequestBody
            });
            SyncService.log('success', 'New file created successfully.');
        }
    } catch (error: any) {
        SyncService.log('error', `Upload failed: ${error.message || JSON.stringify(error)}`);
        console.error("Failed to upload to Google Drive", error);
        throw error;
    }
};

export const downloadFromDrive = async (customClientId?: string, forcePrompt: boolean = false, isBackground: boolean = false): Promise<SyncDataPayload | null> => {
    try {
        SyncService.log('info', 'Starting download from Google Drive...');
        await loadGoogleScripts();
        await getAccessToken(customClientId, forcePrompt, isBackground);

        SyncService.log('info', 'Searching for backup file...');
        const response = await (window as any).gapi.client.drive.files.list({
            q: `name = '${DRIVE_FILE_NAME}'`,
            fields: 'files(id, name)',
            spaces: 'appDataFolder'
        });

        const files = response.result.files;
        SyncService.log('info', `Found ${files ? files.length : 0} files matching ${DRIVE_FILE_NAME} in appDataFolder.`);
        
        if (!files || files.length === 0) {
            SyncService.log('warn', 'No backup file found on Google Drive.');
            return null;
        }

        const fileId = files[0].id;
        SyncService.log('info', `Downloading file (ID: ${fileId})...`);
        const fileContent = await (window as any).gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });

        const payloadSize = fileContent.body ? fileContent.body.length : JSON.stringify(fileContent.result).length;
        SyncService.log('info', `Received payload of size: ${payloadSize} bytes`);
        SyncService.log('success', 'Download complete.');
        return fileContent.result;
    } catch (error: any) {
        SyncService.log('error', `Download failed: ${error.message || JSON.stringify(error)}`);
        console.error("Failed to download from Google Drive", error);
        throw error;
    }
};

export const getFileMetadata = async (customClientId?: string, forcePrompt: boolean = false, isBackground: boolean = false): Promise<DriveFileMetadata | null> => {
    try {
        await loadGoogleScripts();
        await getAccessToken(customClientId, forcePrompt, isBackground);

        const response = await (window as any).gapi.client.drive.files.list({
            q: `name = '${DRIVE_FILE_NAME}'`,
            fields: 'files(id, name, size, modifiedTime, mimeType)',
            spaces: 'appDataFolder'
        });

        const files = response.result.files;
        if (!files || files.length === 0) return null;

        return files[0] as DriveFileMetadata;
    } catch (error: any) {
        console.error("Failed to get file metadata", error);
        throw error;
    }
};

export const deleteFileFromDrive = async (fileId: string, customClientId?: string): Promise<void> => {
    try {
        SyncService.log('info', `Attempting to delete file ${fileId} from Google Drive...`);
        await loadGoogleScripts();
        await getAccessToken(customClientId, false, false);

        await (window as any).gapi.client.drive.files.delete({
            fileId: fileId
        });

        SyncService.log('success', 'File deleted from Google Drive successfully.');
    } catch (error: any) {
        SyncService.log('error', `Delete failed: ${error.message || JSON.stringify(error)}`);
        console.error("Failed to delete file from Google Drive", error);
        throw error;
    }
};
