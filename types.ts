
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
    conditionalRules?: ConditionalRule[];
    conditionChain?: ConditionChain[];
    conditionalValue?: string;
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
  googleDriveSyncEnabled: boolean;
  googleClientId: string;
  googleClientSecret: string;
  lastCloudSyncTimestamp: number;
  lastLocalChangeTimestamp: number;
  autoFillMonthBoundaries: boolean;
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
    general?: { defaultYear: string; autoFillMonthBoundaries: boolean };
    lastCloudSyncTimestamp?: number;
}

export interface SyncDataPayload {
  scans: SavedScan[];
  tableProfiles: TableProfile[];
  exportProfiles: ExportProfile[];
  settings?: SyncSettingsPayload;
  dashboardConfig?: DashboardConfig;
  widgets?: WidgetConfig[];
  lastCloudSyncTimestamp?: number;
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

export type ConflictResolutionChoice = 'skip' | 'overwrite' | 'rename';
export type ConflictResolutionMap = Record<string, ConflictResolutionChoice>;

export interface SyncState {
  isHost: boolean;
  peerId: string | null;
  connectedPeerId: string | null;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastMessage?: string;
}

// --- Dashboard & Widget Types ---

export type WidgetStyle = 'metric' | 'progress_linear' | 'progress_circle' | 'hourglass' | 'clock';
export type TimeFilter = 'all' | 'this_week' | 'last_week' | 'this_month' | 'custom';

export interface ConditionalRule {
  columnKey: string;
  operator: 'is_empty' | 'not_empty' | 'not_zero' | 'equals_zero' | 'greater_than_zero' | 'less_than_zero' | 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'greater_than_or_equal' | 'less_than_or_equal';
  value?: string;
}

export interface ConditionChain {
  rule: ConditionalRule;
  nextOperator?: 'AND' | 'OR' | 'XOR';
}

export interface WidgetConfig {
  id: string;
  title: string;
  style: WidgetStyle;
  
  // Data Source
  scanSourceId: string | 'latest'; 
  dateColumnKey: string; // e.g., "date"
  timeFilter: TimeFilter;
  conditionChain?: ConditionChain[]; // New: granular conditions
  
  // Math
  formula: string; // e.g., "SUM([total_hours])"
  targetFormula?: string; // e.g., "40:00" (used for progress/hourglass)
  
  // Aesthetics
  backgroundColor: string;
  textColor: string;
  accentColor: string; // Used for the "fill" of the hourglass/circle
  fontFamily: string;
  borderRadius: string;
  borderWidth: string;
  borderColor: string;
}

export interface DashboardConfig {
  widgets: WidgetConfig[];
  isDefaultHome: boolean; // Toggle between standard Home and Custom Dashboard
}

export interface DriveFileMetadata {
  id: string;
  name: string;
  size?: string;
  modifiedTime?: string;
  mimeType?: string;
}
