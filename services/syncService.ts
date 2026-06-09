import { PeerLog } from '../types';
import Peer from 'peerjs';
import QRCode from 'qrcode';

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
    private peer: Peer | null = null;
    private connection: any = null; // DataConnection

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
        try {
            return await QRCode.toDataURL(id, { 
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            });
        } catch (err) {
            console.error("Failed to generate QR Code locally", err);
            return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(id)}`;
        }
    }

    async initializeHost(): Promise<string> {
        return new Promise((resolve, reject) => {
            if (this.peer) {
                this.peer.destroy();
            }

            this.onStatusChange("Initializing host via PeerJS...", false);
            this.peer = new Peer();

            this.peer.on('open', (id) => {
                SyncService.log('info', `Host initialized with ID: ${id}`);
                this.onStatusChange("Ready to pair. Scan the QR code.", false);
                resolve(id);
            });

            this.peer.on('connection', (conn) => {
                SyncService.log('success', `Client connected: ${conn.peer}`);
                this.connection = conn;
                this.setupConnectionHandlers();
            });

            this.peer.on('error', (err) => {
                SyncService.log('error', `PeerJS Error: ${err.type}`);
                reject(err);
            });
        });
    }

    async initializeClient(hostId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.peer) {
                this.peer.destroy();
            }

            this.onStatusChange("Connecting to host...", false);
            this.peer = new Peer();

            this.peer.on('open', (id) => {
                SyncService.log('info', `Client initialized with ID: ${id}. Connecting to ${hostId}...`);
                const conn = this.peer!.connect(hostId, {
                    reliable: true
                });

                conn.on('open', () => {
                    this.connection = conn;
                    SyncService.log('success', `Connected to host successfully!`);
                    this.setupConnectionHandlers();
                    resolve();
                });

                conn.on('error', (err) => {
                    SyncService.log('error', `Connection error: ${err.message}`);
                    reject(err);
                });
            });

            this.peer.on('error', (err) => {
                SyncService.log('error', `PeerJS Error: ${err.type}`);
                reject(err);
            });
        });
    }

    private setupConnectionHandlers() {
        if (!this.connection) return;

        this.onStatusChange("Connected!", true);

        this.connection.on('data', (data: any) => {
            if (this.debugMode) {
                SyncService.log('info', `Received data: ${typeof data === 'object' ? data.type : 'Unknown'}`);
            }
            this.onDataReceived(data);
        });

        this.connection.on('close', () => {
            SyncService.log('warn', `Connection closed.`);
            this.onStatusChange("Disconnected.", false);
            this.connection = null;
        });
        
        this.connection.on('error', (err: any) => {
            SyncService.log('error', `Connection error: ${err.message}`);
            this.onStatusChange("Connection error.", false);
        });
    }

    destroy() {
        if (this.connection) {
            this.connection.close();
            this.connection = null;
        }
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        this.onStatusChange("Disconnected", false);
    }

    send(data: any) {
        if (this.connection && this.connection.open) {
            if (this.debugMode) {
                SyncService.log('info', `Sending data: ${data.type}`);
            }
            this.connection.send(data);
        } else {
            console.error("Cannot send data: connection is not open.", this.connection);
            SyncService.log('error', `Cannot send data: connection is not open.`);
        }
    }
}

// --- Client-Side Encrypted Storage ---
export const encryptAndSaveCredentials = (clientId: string, clientSecret: string) => {
    // Basic placeholder for now, replace with actual secure storage if needed
    const credentials = JSON.stringify({ clientId, clientSecret });
    localStorage.setItem('drive_creds', btoa(credentials)); 
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
