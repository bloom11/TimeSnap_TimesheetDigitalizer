import { AppSettings } from "../types";
import CryptoJS from "crypto-js";

const SETTINGS_KEY = 'timesnap_settings';
const HISTORY_KEY = 'timesnap_history';

const DEFAULT_PROMPT = `You are an expert OCR Data Extraction AI. 
Analyze the image of the timesheet/attendance log.

INSTRUCTIONS:
1. Identify the table structure. It usually consists of a Date column followed by Time columns.
2. Detect the number of time entries per row.
   - If a row has 4 time values (e.g., 08:00, 12:00, 13:00, 17:00), map them STRICTLY to the 4 output fields in order.
   - If a row has 2 time values (e.g., 08:00, 16:00), map them to the first and last output fields, leaving the middle ones empty.
3. Extract the Date and format it as DD/MM/YYYY.
4. Extract Times and format as HH:MM (24-hour format).
5. Be robust against noise, handwritten text, or grid lines.
6. Return purely a JSON Array containing the extracted rows.

IMPORTANT:
- If a row has a date but NO time values (e.g., absence, holiday, or blank row), YOU MUST INCLUDE IT.
- If the document contains multiple tables, lists, or sections separated by a vertical gap or visual break (e.g., a "hole" in the middle), YOU MUST EXTRACT DATA FROM ALL SECTIONS. 
- Do not stop processing at the first gap. Continue reading until the end of the page.
- Combine all rows from all sections into a single continuous array.
- Ignore blank lines or separators between blocks.`;

const DEFAULT_SCHEMA = `{
  "date": "DD/MM/YYYY",
  "entrance": "HH:MM",
  "lunchStart": "HH:MM",
  "lunchEnd": "HH:MM",
  "exit": "HH:MM"
}`;

const DEFAULT_MAPPING_PROMPT = `You are an Excel Structure Analyzer.
I will provide a JSON object containing previews of the first 20 rows of every sheet in an Excel file.
Your task is to identify which sheet is the timesheet and how to map the data.

INPUT STRUCTURE:
{
  "SheetName1": [ ["Row1ColA", "Row1ColB", ...], ["Row2ColA", ...], ... ],
  "SheetName2": ...
}

INSTRUCTIONS:
1. **Detect Target Sheet**: Find the sheet that looks like a timesheet (headers like Date, Ingresso, Uscita, In, Out, etc.).
2. **Detect Header Row**: Find the row index (0-based or 1-based, output 1-based) containing the headers.
3. **Detect Columns**: Map the column letters (A, B, C...) to the keys provided.
4. **Detect Start Row**: The first row where data should be inserted (usually header row + 1).

RETURN JSON ONLY:
{
  "targetSheet": "BestSheetName",
  "headerRow": 4,
  "mapping": {
    "dateCol": "A",
    "entranceCol": "B", 
    "lunchStartCol": "C",
    "lunchEndCol": "D",
    "exitCol": "E"
  }
}`;

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  activeProvider: 'gemini',
  activeModel: 'auto',
  geminiApiKey: "",
  openaiApiKey: "",
  claudeApiKey: "",
  mistralApiKey: "",
  groqApiKey: "",
  qwenApiKey: "",
  openrouterApiKey: "",
  debugMode: false,
  defaultYear: new Date().getFullYear().toString(),
  aiSystemPrompt: DEFAULT_PROMPT,
  aiOutputSchema: DEFAULT_SCHEMA,
  aiMappingPrompt: DEFAULT_MAPPING_PROMPT
};

export const VALID_MODELS: Record<string, string[]> = {
  gemini: [
    'auto',
    'gemini-3.1-pro-preview',
    'gemini-3-flash-preview',
    'gemini-flash-latest',
    'gemini-flash-lite-latest'
  ],
  openai: ['auto', 'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  claude: ['auto', 'claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
  mistral: ['auto', 'pixtral-12b-2409', 'mistral-large-latest'],
  groq: ['auto', 'llama-3.2-90b-vision-preview', 'llama-3.2-11b-vision-preview'],
  qwen: ['auto', 'qwen-vl-max', 'qwen-vl-plus'],
  openrouter: ['auto', 'meta-llama/llama-3.2-90b-vision-instruct', 'qwen/qwen-2-vl-72b-instruct', 'google/gemini-pro-1.5', 'anthropic/claude-3.5-sonnet', 'deepseek/deepseek-chat']
};

const sanitizeProviderAndModel = (providerRaw: any, modelRaw: any) => {
  const provider =
    typeof providerRaw === 'string' && VALID_MODELS[providerRaw] ? providerRaw : 'gemini';
  let model = typeof modelRaw === 'string' ? modelRaw : 'auto';
  
  // Allow custom models, but prevent keeping a model from a DIFFERENT provider when switching
  const isFromOtherProvider = Object.keys(VALID_MODELS).some(
    p => p !== provider && VALID_MODELS[p].includes(model)
  );

  if (isFromOtherProvider || !model) {
    model = 'auto';
  }
  
  return { provider, model };
};

// --- Security Helpers ---
const SECRET_PASSPHRASE = "TIMESNAP_CLIENT_SECURE_KEY_2025_v2";
const XOR_KEY_LEGACY = "TIMESNAP_SECURE_V1"; 

const decryptLegacyXor = (text: string): string => {
    try {
        const raw = atob(text.substring(4)); 
        return raw.split('').map((c, i) =>
            String.fromCharCode(c.charCodeAt(0) ^ XOR_KEY_LEGACY.charCodeAt(i % XOR_KEY_LEGACY.length))
        ).join('');
    } catch (e) { return ""; }
};

const encrypt = (text: string): string => {
    if (!text) return "";
    try {
        const encrypted = CryptoJS.AES.encrypt(text, SECRET_PASSPHRASE).toString();
        return 'aes_' + encrypted; 
    } catch (e) {
        console.error("Encryption failed", e);
        return text;
    }
};

const decrypt = (text: string): string => {
    if (!text) return "";
    if (text.startsWith('aes_')) {
        try {
            const raw = text.substring(4);
            const bytes = CryptoJS.AES.decrypt(raw, SECRET_PASSPHRASE);
            const decrypted = bytes.toString(CryptoJS.enc.Utf8);
            if (decrypted) return decrypted;
        } catch (e) { return ""; }
    }
    if (text.startsWith('enc_')) {
        return decryptLegacyXor(text);
    }
    return text;
};

export const getSettings = (): AppSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    
    const parsed = JSON.parse(raw);
    const legacyKey = (parsed as any).apiKey;
    
    const geminiKey = decrypt(parsed.geminiApiKey || legacyKey || "");
    const openaiKey = decrypt(parsed.openaiApiKey || "");
    const claudeKey = decrypt(parsed.claudeApiKey || "");
    const mistralKey = decrypt(parsed.mistralApiKey || "");
    const groqKey = decrypt(parsed.groqApiKey || "");
    const qwenKey = decrypt(parsed.qwenApiKey || "");
    const openrouterKey = decrypt(parsed.openrouterApiKey || "");

    // ✅ Added: sanitize provider+model so they always match
    const { provider, model } = sanitizeProviderAndModel(parsed.activeProvider, parsed.activeModel);

    return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        geminiApiKey: geminiKey,
        openaiApiKey: openaiKey,
        claudeApiKey: claudeKey,
        mistralApiKey: mistralKey,
        groqApiKey: groqKey,
        qwenApiKey: qwenKey,
        openrouterApiKey: openrouterKey,
        activeProvider: provider,
        activeModel: model,
        aiSystemPrompt: parsed.aiSystemPrompt || DEFAULT_PROMPT,
        aiOutputSchema: parsed.aiOutputSchema || DEFAULT_SCHEMA,
        aiMappingPrompt: parsed.aiMappingPrompt || DEFAULT_MAPPING_PROMPT,
        theme: parsed.theme || 'system'
    };
    
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
  
};

export const applyTheme = () => {
    try {
        const settings = getSettings();
        const root = window.document.documentElement;
        let systemDark = false;
        if (typeof window !== 'undefined' && window.matchMedia) {
             try {
                systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
             } catch (e) {}
        }
        const isDark = settings.theme === 'dark' || (settings.theme === 'system' && systemDark);
        if (isDark) root.classList.add('dark');
        else root.classList.remove('dark');
    } catch (e) {}
};

export const saveSettings = (settings: AppSettings) => {
  try {
      // ✅ Added: sanitize before saving (defensive, avoids saving mismatched combos)
      const { provider, model } = sanitizeProviderAndModel(settings.activeProvider, settings.activeModel);

      const toSave = {
          ...settings,
          activeProvider: provider,
          activeModel: model,
          geminiApiKey: encrypt(settings.geminiApiKey),
          openaiApiKey: encrypt(settings.openaiApiKey),
          claudeApiKey: encrypt(settings.claudeApiKey),
          mistralApiKey: encrypt(settings.mistralApiKey),
          groqApiKey: encrypt(settings.groqApiKey),
          qwenApiKey: encrypt(settings.qwenApiKey),
          openrouterApiKey: encrypt(settings.openrouterApiKey)
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(toSave));
      applyTheme();
  } catch (e) {
      alert("Could not save settings. Please check your browser privacy settings.");
  }
};

export const resetSettings = (): AppSettings => {
  try {
      localStorage.removeItem(SETTINGS_KEY);
      localStorage.removeItem(HISTORY_KEY);
      localStorage.clear();
  } catch(e) {}
  applyTheme();
  return DEFAULT_SETTINGS;
};