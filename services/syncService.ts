import { getHistory } from './storageService';
import { uploadToDrive } from './googleDriveService';
import { getSettings, saveSettings } from './settingsService';
import { PeerLog } from '../types';

// --- SyncService Class ---
export class SyncService {
    static logListeners: ((log: PeerLog) => void)[] = [];
    static log(level: 'info' | 'warn' | 'error' | 'success', message: string) {
        const log: PeerLog = { timestamp: Date.now(), level, message };
        this.logListeners.forEach(l => l(log));
        console.log(`[Sync ${level}] ${message}`);
    }

    public onStatusChange: (msg: string, connected: boolean) => void;
    public onDataReceived: (data: any) => void;
    private debugMode: boolean;

    constructor(
        onStatusChange: (msg: string, connected: boolean) => void,
        onDataReceived: (data: any) => void,
        debugMode: boolean
    ) {
        this.onStatusChange = onStatusChange;
        this.onDataReceived = onDataReceived;
        this.debugMode = debugMode;
    }

    static async generateQRCode(id: string): Promise<string> {
        // Placeholder for QR code generation logic
        return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${id}`;
    }

    async initializeHost(): Promise<string> {
        this.onStatusChange("Host initialized", true);
        return "host-id-123";
    }

    async initializeClient(data: string): Promise<void> {
        this.onStatusChange("Client connected", true);
    }

    destroy() {
        this.onStatusChange("Disconnected", false);
    }

    send(data: any) {
        console.log("Sending data", data);
    }
}

// --- Client-Side Encrypted Storage ---
export const encryptAndSaveCredentials = (clientId: string, clientSecret: string) => {
    // Placeholder for encryption logic using existing system
    const credentials = JSON.stringify({ clientId, clientSecret });
    localStorage.setItem('drive_creds', btoa(credentials)); // Simple base64 for now, replace with actual encryption
};

export const getDecryptedCredentials = () => {
    const raw = localStorage.getItem('drive_creds');
    if (!raw) return null;
    try {
        return JSON.parse(atob(raw));
    } catch {
        return null;
    }
};
