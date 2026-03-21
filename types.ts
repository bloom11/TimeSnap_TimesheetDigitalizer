
export interface TimeEntry {
  id: string;
  date: string;
  entrance: string;
  lunchStart: string;
  lunchEnd: string;
  exit: string;
  [key: string]: any; 
}

export type FormulaType = 'none' | 'diff' | 'sum' | 'concat' | 'static' | 'increment' | 'complex';

export interface ColumnConfig {
    key: string;
    name: string;
    formula: FormulaType;
    paramA: string;
    paramB: string;
    staticValue: string;
    complexFormula?: string;
    timeSeparator?: string;
    timeFormat?: '12h' | '24h';
    keepEmptyIfNegative?: boolean;
    defaultTextColor?: string;
}

export interface SavedScan {
  id: string;
  timestamp: number;
  name: string;
  entries: TimeEntry[];
  columnConfigs?: ColumnConfig[]; // New: persists the logic for this scan
  columnOrder?: string[]; // New: persists the column order
  constants?: Record<string, string | number>; // New: persists constants for complex formulas
}

export interface TableProfile {
  id: string;
  name: string;
  columnConfigs: ColumnConfig[];
  columnOrder: string[];
  constants: Record<string, string | number>;
  updatedAt: number;
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
  SYNC_CLIENT = 'SYNC_CLIENT',
  DATA_SYNC_SELECTION = 'DATA_SYNC_SELECTION',
  DATA_SYNC_HOST = 'DATA_SYNC_HOST',
  DATA_SYNC_CLIENT = 'DATA_SYNC_CLIENT',
  MANUAL_DATA_TRANSFER = 'MANUAL_DATA_TRANSFER'
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

export type PeerMessageType = 'HANDSHAKE' | 'IMAGE_DATA' | 'STATUS_UPDATE' | 'DISCONNECT_SIGNAL' | 'SYNC_DATA_PAYLOAD' | 'SYNC_ACK';

export interface SyncSettingsPayload {
    appearance?: { theme: 'light' | 'dark' | 'system' };
    aiConfig?: { activeProvider: AIProvider; activeModel: string; debugMode: boolean };
    prompts?: { aiSystemPrompt: string; aiMappingPrompt: string; aiOutputSchema: string };
    general?: { defaultYear: string };
}

export interface SyncDataPayload {
  scans: SavedScan[];
  tableProfiles: TableProfile[];
  exportProfiles: ExportProfile[];
  settings?: SyncSettingsPayload;
}

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
