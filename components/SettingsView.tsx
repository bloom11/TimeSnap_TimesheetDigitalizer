
import React, { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Save, Bug, Brain, Calendar, RotateCcw, Code2, AlertTriangle, Key, Cpu, Sparkles, MessageSquare, Wind, CheckCircle2, XCircle, Loader2, Moon, Sun, Monitor, TableProperties, ChevronDown, Globe, Network, Zap, Info } from 'lucide-react';
import { AppSettings, AIProvider } from '../types';
import { getSettings, saveSettings, resetSettings } from '../services/settingsService';
import { verifyApiKey } from '../services/aiService';

export interface SettingsViewHandle {
    attemptClose: (callback: () => void) => void;
}

interface SettingsViewProps {
  onClose: () => void;
}

const PROVIDER_MODELS: Record<AIProvider, { id: string, name: string }[]> = {
    gemini: [
        { id: 'auto', name: 'Auto (Recommended)' },
        { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro' },
        { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
        { id: 'gemini-flash-latest', name: 'Gemini Flash (Stable)' },
        { id: 'gemini-flash-lite-latest', name: 'Gemini Flash Lite (Stable)' },
        { id: 'custom', name: 'Custom Model...' }
    ],
    openai: [
        { id: 'auto', name: 'Auto (Recommended)' },
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
        { id: 'custom', name: 'Custom Model...' }
    ],
    claude: [
        { id: 'auto', name: 'Auto (Recommended)' },
        { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet' },
        { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku' },
        { id: 'custom', name: 'Custom Model...' }
    ],
    mistral: [
        { id: 'auto', name: 'Auto (Recommended)' },
        { id: 'pixtral-12b-2409', name: 'Pixtral 12B' },
        { id: 'mistral-large-latest', name: 'Mistral Large' },
        { id: 'custom', name: 'Custom Model...' }
    ],
    groq: [
        { id: 'auto', name: 'Auto (Recommended)' },
        { id: 'llama-3.2-90b-vision-preview', name: 'Llama 3.2 90B Vision' },
        { id: 'llama-3.2-11b-vision-preview', name: 'Llama 3.2 11B Vision' },
        { id: 'custom', name: 'Custom Model...' }
    ],
    qwen: [
        { id: 'auto', name: 'Auto (Recommended)' },
        { id: 'qwen-vl-max', name: 'Qwen VL Max' },
        { id: 'qwen-vl-plus', name: 'Qwen VL Plus' },
        { id: 'custom', name: 'Custom Model...' }
    ],
    openrouter: [
        { id: 'auto', name: 'Auto (Recommended)' },
        { id: 'meta-llama/llama-3.2-90b-vision-instruct', name: 'Llama 3.2 90B Vision' },
        { id: 'qwen/qwen-2-vl-72b-instruct', name: 'Qwen 2 VL 72B' },
        { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5' },
        { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
        { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3 (Text Only)' },
        { id: 'custom', name: 'Custom Model...' }
    ]
};

const SettingsView = forwardRef<SettingsViewHandle, SettingsViewProps>(({ onClose }, ref) => {
  const [settings, setSettings] = useState<AppSettings>(() => getSettings());
  const [initialSettings, setInitialSettings] = useState<AppSettings>(settings);
  const [isSaved, setIsSaved] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [appVersion, setAppVersion] = useState<string>('Loading...');
  const [officialUrl, setOfficialUrl] = useState<string>('');
  
  const hasChanges = JSON.stringify(settings) !== JSON.stringify(initialSettings);

  useImperativeHandle(ref, () => ({
      attemptClose: (callback: () => void) => {
          if (hasChanges) {
              setPendingAction(() => callback);
              setShowUnsavedModal(true);
          } else {
              callback();
          }
      }
  }), [hasChanges]);

  // When provider changes, ensure the model is valid for that provider
  useEffect(() => {
      const validModels = PROVIDER_MODELS[settings.activeProvider].map(m => m.id);
      if (!validModels.includes(settings.activeModel)) {
          setSettings(prev => ({ ...prev, activeModel: validModels[0] }));
      }
  }, [settings.activeProvider]);

  // Fetch dynamic app version and official URL from config.json
  useEffect(() => {
      fetch(import.meta.env.BASE_URL + 'config.json?t=' + new Date().getTime())
          .then(res => res.json())
          .then(data => {
              if (data.version) setAppVersion('v' + data.version);
              if (data.officialUrl) setOfficialUrl(data.officialUrl);
          })
          .catch(err => {
              console.error('Failed to load config.json', err);
              setAppVersion('Unknown');
          });
  }, []);

  const [verifying, setVerifying] = useState<Record<string, boolean>>({});
  const [verifyResult, setVerifyResult] = useState<Record<string, 'success' | 'error' | null>>({});
  const [confirmReset, setConfirmReset] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  const toggleKey = (key: string) => {
      setVisibleKeys(prev => ({...prev, [key]: !prev[key]}));
  };

  const handleVerify = async (provider: AIProvider) => {
      const keyField = `${provider}ApiKey` as keyof AppSettings;
      const key = settings[keyField] as string;
      if (!key) return;

      setVerifying(prev => ({...prev, [provider]: true}));
      setVerifyResult(prev => ({...prev, [provider]: null}));

      const isValid = await verifyApiKey(provider, key, settings.activeModel, settings.debugMode);

      
      setVerifying(prev => ({...prev, [provider]: false}));
      setVerifyResult(prev => ({...prev, [provider]: isValid ? 'success' : 'error'}));
  };

  const handleSave = () => {
    try {
        JSON.parse(settings.aiOutputSchema);
        setJsonError(null);
    } catch (e) {
        setJsonError("Invalid JSON in Output Format.");
        setShowUnsavedModal(false); 
        return;
    }

    saveSettings(settings);
    setInitialSettings(settings);
    setIsSaved(true);
    setTimeout(() => {
        setIsSaved(false);
        if (pendingAction) pendingAction();
        else onClose();
    }, 800);
  };

  const handleDiscard = () => {
      if (pendingAction) pendingAction();
      else onClose();
  };

  const handleCloseAttempt = () => {
      if (hasChanges) {
          setPendingAction(() => onClose);
          setShowUnsavedModal(true);
      } else {
          onClose();
      }
  };

  const handleCancelModal = () => {
      setShowUnsavedModal(false);
      setPendingAction(null);
  };

  const handleReset = () => {
      if (!confirmReset) {
          setConfirmReset(true);
          setTimeout(() => setConfirmReset(false), 3000);
          return;
      }
      const defaults = resetSettings();
      setSettings(defaults);
      setInitialSettings(defaults);
      setVerifyResult({});
      setVerifying({});
      setTimeout(() => window.location.reload(), 500);
  };

  const PROVIDERS: {id: AIProvider, name: string, icon: any, color: string, link: string}[] = [
      { id: 'gemini', name: 'Google Gemini', icon: Sparkles, color: 'text-blue-600', link: 'https://aistudio.google.com/app/apikey' },
      { id: 'openai', name: 'OpenAI GPT-4o', icon: Cpu, color: 'text-green-600', link: 'https://platform.openai.com/api-keys' },
      { id: 'claude', name: 'Anthropic Claude', icon: MessageSquare, color: 'text-orange-600', link: 'https://console.anthropic.com/settings/keys' },
      { id: 'mistral', name: 'Mistral AI', icon: Wind, color: 'text-indigo-600', link: 'https://console.mistral.ai/api-keys/' },
      { id: 'groq', name: 'Groq (Fast Llama)', icon: Zap, color: 'text-red-600', link: 'https://console.groq.com/keys' },
      { id: 'qwen', name: 'Alibaba Qwen', icon: Globe, color: 'text-teal-600', link: 'https://dashscope.console.aliyun.com/apiKey' },
      { id: 'openrouter', name: 'OpenRouter', icon: Network, color: 'text-sky-600', link: 'https://openrouter.ai/keys' },
  ];

  return (
    <div className="w-full h-full flex flex-col animate-fade-in relative">
        <div className="flex-1 overflow-y-auto p-4 space-y-8 pb-8">
            {/* Appearance Settings */}
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                 <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg"><Sun className="w-5 h-5 text-slate-600 dark:text-slate-300" /></div>
                    <h3 className="font-bold text-slate-800 dark:text-white">Appearance</h3>
                </div>
                <div className="flex gap-4">
                     {[{ val: 'light', label: 'Light', icon: Sun }, { val: 'dark', label: 'Dark', icon: Moon }, { val: 'system', label: 'System', icon: Monitor }].map((t) => (
                         <button
                            key={t.val}
                            onClick={() => setSettings({...settings, theme: t.val as any})}
                            className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${settings.theme === t.val ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                         >
                             <t.icon className="w-5 h-5 mb-2" />
                             <span className="text-sm font-semibold">{t.label}</span>
                         </button>
                     ))}
                </div>
            </section>
            
            {/* AI Provider Selection */}
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-900 p-6 shadow-sm ring-1 ring-blue-100 dark:ring-blue-900/50">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="bg-blue-600 p-2 rounded-lg"><Key className="w-5 h-5 text-white" /></div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">AI Provider & Keys</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Select which AI service to use for scanning.</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
                    {PROVIDERS.map(p => (
                        <button
                            key={p.id}
                            onClick={() => setSettings({...settings, activeProvider: p.id,activeModel: PROVIDER_MODELS[p.id][0].id,})}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${settings.activeProvider === p.id ? `border-${p.color.split('-')[1]}-500 bg-${p.color.split('-')[1]}-50 dark:bg-${p.color.split('-')[1]}-900/20 ring-2 ring-${p.color.split('-')[1]}-200 dark:ring-${p.color.split('-')[1]}-800` : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                        >
                            <p.icon className={`w-6 h-6 mb-2 ${settings.activeProvider === p.id ? p.color : 'text-slate-400 dark:text-slate-500'}`} />
                            <span className={`text-xs font-bold ${settings.activeProvider === p.id ? 'text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>{p.name}</span>
                        </button>
                    ))}
                </div>

                {/* Model Selector Dropdown */}
                <div className="mb-6 px-1">
                     <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Selected Model</label>
                     <div className="relative">
                         <select 
                            value={PROVIDER_MODELS[settings.activeProvider].some(m => m.id === settings.activeModel) ? settings.activeModel : 'custom'}
                            onChange={(e) => {
                                if (e.target.value === 'custom') {
                                    setSettings({...settings, activeModel: ''});
                                } else {
                                    setSettings({...settings, activeModel: e.target.value});
                                }
                            }}
                            className="w-full appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-3 pr-10 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-white"
                         >
                             {PROVIDER_MODELS[settings.activeProvider].map(m => (
                                 <option key={m.id} value={m.id}>{m.name}</option>
                             ))}
                         </select>
                         <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                     </div>
                     {(!PROVIDER_MODELS[settings.activeProvider].some(m => m.id === settings.activeModel) || settings.activeModel === '') && (
                         <div className="mt-3 animate-fade-in">
                             <input 
                                 type="text" 
                                 value={settings.activeModel}
                                 onChange={(e) => setSettings({...settings, activeModel: e.target.value})}
                                 placeholder="e.g., gemini-4-ultra-preview"
                                 className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono"
                             />
                             <p className="text-xs text-slate-500 mt-1">Type the exact model ID provided by the API.</p>
                         </div>
                     )}
                </div>
                
                {/* Dynamic Key Input based on selection */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 transition-all">
                    {PROVIDERS.map(p => {
                        if (settings.activeProvider !== p.id) return null;
                        
                        const keyField = `${p.id}ApiKey` as keyof AppSettings;
                        const keyVal = settings[keyField] as string;
                        const isVerifying = verifying[p.id];
                        const status = verifyResult[p.id];
                        
                        return (
                            <div key={p.id} className="animate-fade-in">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{p.name} API Key</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input 
                                            type={visibleKeys[p.id] ? "text" : "password"} 
                                            value={keyVal}
                                            onChange={(e) => {
                                                setSettings({...settings, [keyField]: e.target.value});
                                                setVerifyResult(prev => ({...prev, [p.id]: null})); 
                                            }}
                                            autoComplete="off"
                                            className={`w-full p-3 pr-16 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white dark:bg-slate-900 ${status === 'error' ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20' : status === 'success' ? 'border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/20' : 'border-slate-300 dark:border-slate-600'}`}
                                            placeholder={`Enter your ${p.name} Key...`}
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => toggleKey(p.id)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800"
                                        >
                                            {visibleKeys[p.id] ? "HIDE" : "SHOW"}
                                        </button>
                                    </div>
                                    <button 
                                        onClick={() => handleVerify(p.id)}
                                        disabled={!keyVal || isVerifying}
                                        className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 px-4 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 min-w-[100px] flex items-center justify-center"
                                    >
                                        {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                                         status === 'success' ? <span className="text-green-600 dark:text-green-400 font-bold flex items-center"><CheckCircle2 className="w-4 h-4 mr-1" /> Valid</span> :
                                         status === 'error' ? <span className="text-red-600 dark:text-red-400 font-bold flex items-center"><XCircle className="w-4 h-4 mr-1" /> Invalid</span> :
                                         "Verify"}
                                    </button>
                                </div>
                                <div className="mt-3 flex justify-between items-start text-xs">
                                    <div className="flex items-start gap-2 text-slate-500 dark:text-slate-400">
                                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
                                        <p>
                                            Need a key? Get one from <a href={p.link} target="_blank" rel="noopener noreferrer" className="underline font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800">{p.name} Dashboard</a>.
                                            <br/>Key is stored locally on your device.
                                        </p>
                                    </div>
                                    {status === 'error' && (
                                        <div className="text-red-600 dark:text-red-400 font-medium">
                                            Connection rejected. Check key or quota.
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>
            {/* General Settings */}
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg"><Calendar className="w-5 h-5 text-slate-600 dark:text-slate-300" /></div>
                    <h3 className="font-bold text-slate-800 dark:text-white">General</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Default Year Context</label>
                        <input type="number" value={settings.defaultYear} onChange={(e) => setSettings({...settings, defaultYear: e.target.value})} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white" placeholder={new Date().getFullYear().toString()} />
                    </div>
                </div>
            </section>
            {/* AI Prompt Configuration */}
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded-lg"><Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" /></div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">AI Logic & Prompts</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Customize how the AI interprets your timesheets.</p>
                    </div>
                </div>
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">OCR Extraction System Prompt</label>
                        <textarea value={settings.aiSystemPrompt} onChange={(e) => setSettings({...settings, aiSystemPrompt: e.target.value})} rows={8} className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm font-mono leading-relaxed bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                             <TableProperties className="w-4 h-4 text-slate-400" /> Excel Mapping Prompt
                        </label>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Instructions for Auto-Detecting Sheets and Columns.</p>
                        <textarea value={settings.aiMappingPrompt} onChange={(e) => setSettings({...settings, aiMappingPrompt: e.target.value})} rows={6} className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm font-mono leading-relaxed bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white" />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Output JSON Format (Keys)</label>
                            <Code2 className="w-4 h-4 text-slate-400" />
                        </div>
                        <textarea value={settings.aiOutputSchema} onChange={(e) => setSettings({...settings, aiOutputSchema: e.target.value})} rows={6} className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm font-mono bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white ${jsonError ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'}`} />
                        {jsonError && ( <div className="flex items-center mt-2 text-red-600 text-xs"><AlertTriangle className="w-3 h-3 mr-1" />{jsonError}</div> )}
                    </div>
                </div>
            </section>
            {/* Debugging */}
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded-lg"><Bug className="w-5 h-5 text-yellow-600 dark:text-yellow-400" /></div>
                    <h3 className="font-bold text-slate-800 dark:text-white">Debugging</h3>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div>
                        <h4 className="font-semibold text-slate-800 dark:text-white">Enable Debug Mode</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Show intermediate AI results before processing.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={settings.debugMode} onChange={(e) => setSettings({...settings, debugMode: e.target.checked})} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:bg-blue-600"></div>
                    </label>
                </div>
            </section>

            {/* About / App Info */}
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-lg"><Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /></div>
                    <h3 className="font-bold text-slate-800 dark:text-white">About TimeSnap</h3>
                </div>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div>
                            <h4 className="font-semibold text-slate-800 dark:text-white">App Version</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Current installed build</p>
                        </div>
                        <span className="px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-xs font-bold font-mono">
                            {appVersion}
                        </span>
                    </div>
                    {officialUrl && (
                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div>
                                <h4 className="font-semibold text-slate-800 dark:text-white">Official URL</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Latest updates home</p>
                            </div>
                            <a href={officialUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all max-w-[50%] text-right">
                                {officialUrl.replace(/^https?:\/\//, '')}
                            </a>
                        </div>
                    )}
                </div>
            </section>
        </div>

        <div className="shrink-0 p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between">
            <button onClick={handleReset} className={`flex items-center px-4 py-3 rounded-lg transition-colors text-sm font-medium ${confirmReset ? 'bg-red-600 text-white hover:bg-red-700 shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'}`}>
                {confirmReset ? (<><AlertTriangle className="w-4 h-4 mr-2" /> Are you sure? Click to Confirm</>) : (<><RotateCcw className="w-4 h-4 mr-2" /> Factory Reset</>)}
            </button>
            <button onClick={handleSave} disabled={!!jsonError} className={`flex items-center px-6 py-3 rounded-lg font-bold text-white transition-all shadow-lg ${isSaved ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50'}`}>
                {isSaved ? "Saved!" : <><Save className="w-5 h-5 mr-2" /> Save Changes</>}
            </button>
        </div>

        {/* Unsaved Changes Warning Modal */}
        {showUnsavedModal && (
            <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-800 p-6 transform scale-100 transition-all">
                    <div className="flex items-center gap-3 mb-4 text-amber-500">
                        <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-full"><AlertTriangle className="w-6 h-6" /></div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Unsaved Changes</h3>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 mb-6 text-sm leading-relaxed">You have modified your settings but haven't saved them yet. What would you like to do?</p>
                    <div className="flex flex-col gap-3">
                        <button onClick={handleSave} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20">Save & Exit</button>
                        <button onClick={handleDiscard} className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-800">Discard Changes</button>
                        <button onClick={handleCancelModal} className="w-full py-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold uppercase tracking-widest mt-1">Cancel</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
});

export default SettingsView;
