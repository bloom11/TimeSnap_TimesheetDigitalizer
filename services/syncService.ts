
import Peer, { DataConnection } from 'peerjs';
import QRCode from 'qrcode';
import { PeerMessage, PeerLog } from '../types';

const generateShortId = () => {
    return 'ts-' + Math.random().toString(36).substring(2, 8);
};

const getPeerConfig = (debugMode: boolean) => ({
    debug: debugMode ? 1 : 0,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
        ]
    }
});

export class SyncService {
    private peer: Peer | null = null;
    private conn: DataConnection | null = null;
    private onStatusChange: (status: string, connected: boolean) => void;
    private onDataReceived: (data: PeerMessage) => void;
    private debugMode: boolean;
    
    // Global static subscriber for debug logs
    public static logListeners: ((log: PeerLog) => void)[] = [];

    constructor(
        onStatusChange: (status: string, connected: boolean) => void,
        onDataReceived: (data: PeerMessage) => void,
        debugMode: boolean = false
    ) {
        this.onStatusChange = onStatusChange;
        this.onDataReceived = onDataReceived;
        this.debugMode = debugMode;
    }

    public static addLog(message: string, level: PeerLog['level'] = 'info') {
        const log: PeerLog = { timestamp: Date.now(), level, message };
        SyncService.logListeners.forEach(l => l(log));
        console.log(`[SyncService] ${message}`);
    }

    public async initializeHost(): Promise<string> {
        return new Promise((resolve, reject) => {
            const id = generateShortId();
            SyncService.addLog(`Initializing Host with ID: ${id}`);
            
            try {
                this.peer = new Peer(id, getPeerConfig(this.debugMode));

                this.peer.on('open', (id) => {
                    SyncService.addLog(`Peer Server Open. ID: ${id}`, 'success');
                    this.onStatusChange('Ready for connection', false);
                    resolve(id);
                });

                this.peer.on('connection', (conn) => {
                    SyncService.addLog(`Inbound connection request from ${conn.peer}`);
                    this.handleConnection(conn);
                });

                this.peer.on('error', (err) => {
                    SyncService.addLog(`Peer Error: ${err.type}`, 'error');
                    this.onStatusChange(`Network Error: ${err.type}`, false);
                    reject(err);
                });
            } catch (e) {
                SyncService.addLog(`Critical Init Error`, 'error');
                reject(e);
            }
        });
    }

    public async initializeClient(hostId: string): Promise<void> {
        return new Promise((resolve, reject) => {
             try {
                 this.peer = new Peer(getPeerConfig(this.debugMode));
                 SyncService.addLog(`Initializing Client...`);

                 this.peer.on('open', (myId) => {
                     SyncService.addLog(`Client Open. Local ID: ${myId}`);
                     
                     let cleanId = hostId;
                     if (hostId.includes('join=')) {
                        cleanId = hostId.split('join=')[1].split('&')[0];
                     }

                     SyncService.addLog(`Connecting to Host: ${cleanId}...`);
                     const conn = this.peer!.connect(cleanId);
                     
                     conn.on('open', () => {
                         SyncService.addLog(`Connection established with ${cleanId}`, 'success');
                         this.handleConnection(conn);
                         resolve();
                     });

                     conn.on('error', (err) => {
                         SyncService.addLog(`Link Error: ${err.type}`, 'error');
                         this.onStatusChange(`Link Error: ${err.type}`, false);
                         reject(err);
                     });
                 });

                 this.peer.on('error', (err) => {
                     SyncService.addLog(`Client Peer Error: ${err.type}`, 'error');
                     reject(err);
                 });
             } catch (e) {
                 reject(e);
             }
        });
    }

    private handleConnection(conn: DataConnection) {
        this.conn = conn;

        conn.on('open', () => {
            this.onStatusChange('Connected!', true);
            this.send({ type: 'HANDSHAKE', payload: { device: 'TimeSnap Peer' } });
        });

        conn.on('data', (data: any) => {
            const msg = data as PeerMessage;
            if (msg.type === 'IMAGE_DATA') {
                SyncService.addLog(`Received Image Data (${Math.round(JSON.stringify(msg.payload).length / 1024)} KB)`);
            } else {
                SyncService.addLog(`Received Message: ${msg.type}`);
            }
            this.onDataReceived(msg);
        });

        conn.on('close', () => {
            SyncService.addLog(`Connection closed by peer.`, 'warn');
            this.onStatusChange('Disconnected', false);
            this.conn = null;
        });

        conn.on('error', (err) => {
            SyncService.addLog(`Connection error: ${err}`, 'error');
            this.onStatusChange('Connection error', false);
        });
    }

    public send(msg: PeerMessage) {
        if (this.conn && this.conn.open) {
            this.conn.send(msg);
            if (msg.type !== 'IMAGE_DATA') SyncService.addLog(`Sent ${msg.type}`);
        } else {
            SyncService.addLog(`Failed to send ${msg.type}: Connection not open`, 'error');
        }
    }

    public destroy() {
        SyncService.addLog(`Destroying Sync Service...`, 'warn');
        if (this.conn) this.conn.close();
        if (this.peer) this.peer.destroy();
        this.peer = null;
        this.conn = null;
    }

    public static async generateQRCode(id: string): Promise<string> {
        try {
            const baseUrl = window.location.origin + window.location.pathname;
            const fullUrl = `${baseUrl}?join=${id}`;
            return await QRCode.toDataURL(fullUrl, { width: 300, margin: 2 });
        } catch (err) { return ''; }
    }
}
