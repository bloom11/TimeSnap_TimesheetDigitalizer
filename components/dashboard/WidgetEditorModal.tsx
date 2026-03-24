import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Save, Trash2, BookOpen } from 'lucide-react';
import { WidgetConfig, WidgetStyle, TimeFilter, SavedScan } from '../../types';
import InfoTooltip from './InfoTooltip';
import FormulaInput from '../formula/FormulaInput';
import FormulaBuilder from '../formula/FormulaBuilder';
import FormulaGuideModal from '../formula-guide/FormulaGuideModal';

interface WidgetEditorModalProps {
  open: boolean;
  onClose: () => void;
  config: WidgetConfig | null;
  onSave: (config: WidgetConfig) => void;
  onDelete?: (id: string) => void;
  scans: SavedScan[];
  constants: Record<string, string | number>;
}

const DEFAULT_CONFIG: WidgetConfig = {
  id: '',
  title: 'New Widget',
  style: 'metric',
  scanSourceId: 'latest',
  dateColumnKey: 'date',
  timeFilter: 'all',
  formula: 'SUM([total_hours])',
  targetFormula: '',
  backgroundColor: '#ffffff',
  textColor: '#1e293b',
  accentColor: '#3b82f6',
  fontFamily: 'Inter',
  borderRadius: '16',
  borderWidth: '1',
  borderColor: '#e2e8f0',
};

export default function WidgetEditorModal({ open, onClose, config, onSave, onDelete, scans, constants }: WidgetEditorModalProps) {
  const [formData, setFormData] = useState<WidgetConfig>(DEFAULT_CONFIG);
  const [activeInput, setActiveInput] = useState<'formula' | 'targetFormula'>('formula');
  const [showFormulaGuide, setShowFormulaGuide] = useState(false);
  
  const formulaRef = useRef<HTMLTextAreaElement>(null);
  const targetFormulaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setFormData(config || { ...DEFAULT_CONFIG, id: `widget-${Date.now()}` });
    }
  }, [open, config]);

  const availableColumns = useMemo(() => {
    const selectedScan = formData.scanSourceId === 'latest' 
      ? scans[0] 
      : scans.find(s => s.id === formData.scanSourceId);
      
    if (!selectedScan || !selectedScan.entries || selectedScan.entries.length === 0) return [];
    
    const keys = new Set<string>();
    selectedScan.entries.slice(0, 10).forEach(entry => {
      Object.keys(entry).forEach(k => keys.add(k));
    });
    return Array.from(keys).filter(k => k !== 'id' && k !== '_id');
  }, [formData.scanSourceId, scans]);

  if (!open) return null;

  const handleChange = (field: keyof WidgetConfig, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleInsert = (text: string) => {
    const ref = activeInput === 'formula' ? formulaRef : targetFormulaRef;
    const currentVal = formData[activeInput] || '';
    
    if (ref.current) {
      const start = ref.current.selectionStart;
      const end = ref.current.selectionEnd;
      const newVal = currentVal.substring(0, start) + text + currentVal.substring(end);
      handleChange(activeInput, newVal);
      
      let newCursorPos = start + text.length;
      if (text.endsWith('([])')) newCursorPos -= 2;
      
      setTimeout(() => {
        if (ref.current) {
          ref.current.focus();
          ref.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    } else {
      handleChange(activeInput, currentVal + text);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">
            {config ? 'Edit Widget' : 'Add Widget'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Configure your widget's appearance and data source. Use the formula builder to create complex calculations.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-700 dark:text-slate-300 border-b pb-2 flex items-center">
                Basic Info
                <InfoTooltip text="Set the title and visual style of the widget." />
              </h3>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Style</label>
                <select
                  value={formData.style}
                  onChange={(e) => handleChange('style', e.target.value as WidgetStyle)}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="metric">Metric (Text)</option>
                  <option value="progress_linear">Linear Progress</option>
                  <option value="progress_circle">Circular Progress</option>
                  <option value="hourglass">Hourglass</option>
                  <option value="clock">Clock</option>
                </select>
              </div>
            </div>

            {/* Data Source */}
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-700 dark:text-slate-300 border-b pb-2 flex items-center">
                Data Source
                <InfoTooltip text="Select which scan data to use and filter it by date." />
              </h3>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Scan Source</label>
                <select
                  value={formData.scanSourceId}
                  onChange={(e) => handleChange('scanSourceId', e.target.value)}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="latest">Latest Scan</option>
                  {scans.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({new Date(s.timestamp).toLocaleDateString()})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Time Filter</label>
                  <select
                    value={formData.timeFilter}
                    onChange={(e) => handleChange('timeFilter', e.target.value as TimeFilter)}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="all">All Time</option>
                    <option value="this_week">This Week</option>
                    <option value="last_week">Last Week</option>
                    <option value="this_month">This Month</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date Column Key</label>
                  <input
                    type="text"
                    value={formData.dateColumnKey}
                    onChange={(e) => handleChange('dateColumnKey', e.target.value)}
                    placeholder="e.g., date"
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Include Rows Where</label>
                  <select
                    value={formData.rowFilter?.columnKey || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        const newFormData = { ...formData };
                        delete newFormData.rowFilter;
                        setFormData(newFormData);
                      } else {
                        handleChange('rowFilter', { columnKey: val, operator: formData.rowFilter?.operator || 'not_empty' });
                      }
                    }}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="">None (Include All Rows)</option>
                    {availableColumns.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                {formData.rowFilter && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Condition</label>
                    <select
                      value={formData.rowFilter.operator}
                      onChange={(e) => handleChange('rowFilter', { ...formData.rowFilter, operator: e.target.value })}
                      className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="is_empty">Is Empty</option>
                      <option value="not_empty">Is Not Empty</option>
                      <option value="equals">Equals</option>
                      <option value="not_zero">Is Not Zero</option>
                      <option value="equals_zero">Equals 0</option>
                      <option value="greater_than_zero">Greater Than 0</option>
                      <option value="less_than_zero">Less Than 0</option>
                    </select>
                  </div>
                  {formData.rowFilter.operator === 'equals' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Value</label>
                      <input
                        type="text"
                        value={formData.rowFilter.value || ""}
                        onChange={(e) => handleChange('rowFilter', { ...formData.rowFilter, value: e.target.value })}
                        placeholder="Value"
                        className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
            </div>
          </div>

          {/* Math */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-semibold text-slate-700 dark:text-slate-300 flex items-center">
                Formula & Target
                <InfoTooltip text="Define how your widget calculates its value. Use the Formula Builder below to insert columns and operations." />
              </h3>
              <button
                type="button"
                onClick={() => setShowFormulaGuide(true)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-bold"
              >
                <BookOpen className="w-3 h-3" /> Formula Guide
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Value Formula
                    <InfoTooltip text="The main calculation for this widget. E.g., SUM([total_hours])" />
                  </label>
                  <FormulaInput
                    value={formData.formula}
                    onChange={(val) => handleChange('formula', val)}
                    onFocus={() => setActiveInput('formula')}
                    columns={availableColumns}
                    inputRef={formulaRef}
                    placeholder="e.g., SUM([total_hours])"
                  />
                </div>
                <div>
                  <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Target Formula (Optional)
                    <InfoTooltip text="A target value to compare against. Can be a constant (e.g., 40) or a formula." />
                  </label>
                  <FormulaInput
                    value={formData.targetFormula}
                    onChange={(val) => handleChange('targetFormula', val)}
                    onFocus={() => setActiveInput('targetFormula')}
                    columns={availableColumns}
                    inputRef={targetFormulaRef}
                    placeholder="e.g., 40"
                  />
                </div>
              </div>
              <div className="lg:col-span-1 h-[300px] lg:h-auto">
                <FormulaBuilder columns={availableColumns} constants={constants} onInsert={handleInsert} />
              </div>
            </div>
          </div>

          {/* Aesthetics */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-700 dark:text-slate-300 border-b pb-2 flex items-center">
              Aesthetics
              <InfoTooltip text="Customize the colors, borders, and fonts of your widget." />
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Background</label>
                <input
                  type="color"
                  value={formData.backgroundColor}
                  onChange={(e) => handleChange('backgroundColor', e.target.value)}
                  className="w-full h-10 p-1 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Text Color</label>
                <input
                  type="color"
                  value={formData.textColor}
                  onChange={(e) => handleChange('textColor', e.target.value)}
                  className="w-full h-10 p-1 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Accent Color</label>
                <input
                  type="color"
                  value={formData.accentColor}
                  onChange={(e) => handleChange('accentColor', e.target.value)}
                  className="w-full h-10 p-1 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Border Color</label>
                <input
                  type="color"
                  value={formData.borderColor}
                  onChange={(e) => handleChange('borderColor', e.target.value)}
                  className="w-full h-10 p-1 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Border Width</label>
                <input
                  type="number"
                  value={formData.borderWidth}
                  onChange={(e) => handleChange('borderWidth', e.target.value)}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Border Radius</label>
                <input
                  type="number"
                  value={formData.borderRadius}
                  onChange={(e) => handleChange('borderRadius', e.target.value)}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Font Family</label>
                <select
                  value={formData.fontFamily}
                  onChange={(e) => handleChange('fontFamily', e.target.value)}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="Inter, sans-serif">Inter (Sans)</option>
                  <option value="'JetBrains Mono', monospace">JetBrains Mono (Code)</option>
                  <option value="'Playfair Display', serif">Playfair Display (Serif)</option>
                  <option value="system-ui, sans-serif">System UI</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between">
          {config && onDelete ? (
            <button
              onClick={() => { onDelete(config.id); onClose(); }}
              className="flex items-center px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { onSave(formData); onClose(); }}
              className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Save className="w-4 h-4 mr-2" /> Save
            </button>
          </div>
        </div>
      </div>

      <FormulaGuideModal
        open={showFormulaGuide}
        onClose={() => setShowFormulaGuide(false)}
      />
    </div>
  );
}
