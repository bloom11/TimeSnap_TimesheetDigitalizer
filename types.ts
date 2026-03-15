
export interface TimeEntry {
  id: string;
  date: string;
  entrance: string;
  lunchStart: string;
  lunchEnd: string;
  exit: string;
  [key: string]: any; 
}

export type FormulaType = 'none' | 'diff' | 'sum' | 'concat' | 'static' | 'increment';

export interface ColumnConfig {
    key: string;
    name: string;
    formula: FormulaType;
    paramA: string;
    paramB: string;
    staticValue: string;
}

export interface SavedScan {
  id: string;
  timestamp: number;
  name: string;
  entries: TimeEntry[];
  columnConfigs?: ColumnConfig[]; // New: persists the logic for this scan
  columnOrder?: string[]; // New: persists the column order
}

export interface ExcelColumnMapping {
  [key: string]: string; 
}

export interface ExportProfile {
    id: string;
    name: string;
    mapping: ExcelColumnMapping;
    targetSheet: string;
    startRow: number;
}

export enum AppState {
  HOME = 'HOME',
  MODALITY_SELECTION = 'MODALITY_SELECTION',
  SCANNING = 'SCANNING',
  REVIEW = 'REVIEW',
  EXPORT = 'EXPORT',
  SYNC_HOST = 'SYNC_HOST', 
  SYNC_CLIENT = 'SYNC_CLIENT' 
}

export type ProcessingStatus = 'idle' | 'processing' | 'success' | 'error';
export type AIProvider = 'gemini' | 'openai' | 'claude' | 'mistral' | 'groq' | 'qwen' | 'openrouter';
export type OCRAlgorithm = 'neural' | 'sparse' | 'raw_matrix';

// New types for Advanced OCR
export type OCREngine = 'tesseract' | 'paddle';
export type OCRStrategy = 'page_scan' | 'grid_cell';

export interface RegionOfInterest {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  activeProvider: AIProvider;
  activeModel: string; // Specific model string (e.g., 'gemini-3-flash-preview', 'gpt-4o')
  geminiApiKey: string;
  openaiApiKey: string;
  claudeApiKey: string;
  mistralApiKey: string;
  groqApiKey: string;
  qwenApiKey: string;
  openrouterApiKey: string;
  debugMode: boolean;
  defaultYear: string;
  aiSystemPrompt: string; 
  aiOutputSchema: string; 
  aiMappingPrompt: string; 
}

export interface ScanResult {
  entries: TimeEntry[];
  rawResponse: string;
  debugMeta?: any;
}

export interface OCRWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  centerX: number;
  centerY: number;
  type: 'time' | 'date' | 'header' | 'unknown';
}

export interface OfflineScanData {
  words: OCRWord[];
  imageWidth: number;
  imageHeight: number;
  base64Image: string;
  suggestedColumns: number[];
  suggestedRows?: number[]; 
}

export interface Point {
  x: number;
  y: number;
}

export type PeerMessageType = 'HANDSHAKE' | 'IMAGE_DATA' | 'STATUS_UPDATE' | 'DISCONNECT_SIGNAL';

export interface PeerMessage {
  type: PeerMessageType;
  payload: any;
}

export interface PeerLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export interface SyncState {
  isHost: boolean;
  peerId: string | null;
  connectedPeerId: string | null;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastMessage?: string;
}
