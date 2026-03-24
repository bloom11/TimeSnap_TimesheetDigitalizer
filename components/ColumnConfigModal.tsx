import React, { useRef, useMemo } from "react";
import { X, Trash2, Plus, ArrowRight, Calculator, Type, Hash, Clock, ArrowDownFromLine, BookOpen, AlertCircle, CheckCircle2, Filter } from "lucide-react";
import { ColumnConfig, FormulaType, ConditionalRule } from "../types";
import FormulaInput from "./formula/FormulaInput";
import FormulaBuilder from "./formula/FormulaBuilder";

const DEFAULT_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#64748b", // slate
];

interface SelectColumnProps {
  label: string;
  value: string;
  options: string[];
  onChange: (val: string) => void;
}

function SelectColumn({ label, value, options, onChange }: SelectColumnProps) {
  return (
    <div className="flex-1">
      <label className="block text-xs font-bold text-slate-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm"
      >
        <option value="">-- Select --</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

interface ColumnConfigModalProps {
  open: boolean;
  onClose: () => void;
  modalConfig: ColumnConfig;
  setModalConfig: (config: ColumnConfig) => void;
  columnOrder: string[];
  constants: Record<string, number>;
  setShowFormulaGuide: (show: boolean) => void;
  handleDeleteColumnByKey: (key: string) => void;
  handleSaveColumn: () => void;
}

function validateFormula(formula: string): { valid: boolean; error?: string } {
  if (!formula) return { valid: true };
  
  const stack: string[] = [];
  let inQuotes = false;
  
  for (let i = 0; i < formula.length; i++) {
    const char = formula[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    
    if (char === '(' || char === '[') {
      stack.push(char);
    } else if (char === ')') {
      const last = stack.pop();
      if (last !== '(') return { valid: false, error: `Unexpected ')' at position ${i+1}` };
    } else if (char === ']') {
      const last = stack.pop();
      if (last !== '[') return { valid: false, error: `Unexpected ']' at position ${i+1}` };
    }
  }
  
  if (inQuotes) return { valid: false, error: "Unclosed quotes detected" };
  if (stack.length > 0) {
    const last = stack.pop();
    return { valid: false, error: `Unclosed '${last}' detected` };
  }
  
  return { valid: true };
}

export default function ColumnConfigModal({
  open,
  onClose,
  modalConfig,
  setModalConfig,
  columnOrder,
  constants,
  setShowFormulaGuide,
  handleDeleteColumnByKey,
  handleSaveColumn,
}: ColumnConfigModalProps) {
  const formulaRef = useRef<HTMLTextAreaElement>(null);

  const formulaValidation = useMemo(() => 
    validateFormula(modalConfig.complexFormula || ""), 
    [modalConfig.complexFormula]
  );

  const handleInsert = (text: string) => {
    const currentVal = modalConfig.complexFormula || "";
    const ref = formulaRef.current;

    if (ref) {
      const start = ref.selectionStart;
      const end = ref.selectionEnd;
      const newVal = currentVal.substring(0, start) + text + currentVal.substring(end);
      setModalConfig({ ...modalConfig, complexFormula: newVal });

      let newCursorPos = start + text.length;
      
      // Smart cursor positioning for functions
      if (text.endsWith("([])")) newCursorPos -= 2;
      else if (text.endsWith("(, , )")) newCursorPos -= 6;
      else if (text.endsWith("(, )")) newCursorPos -= 3;
      else if (text.endsWith("(, \"\")")) newCursorPos -= 5;
      else if (text.endsWith("()")) newCursorPos -= 1;

      setTimeout(() => {
        if (formulaRef.current) {
          formulaRef.current.focus();
          formulaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    } else {
      setModalConfig({ ...modalConfig, complexFormula: currentVal + text });
    }
  };

  const addConditionalRule = () => {
    const newRules = [...(modalConfig.conditionalRules || []), { columnKey: columnOrder[0] || "", operator: "is_empty" as const }];
    setModalConfig({ ...modalConfig, conditionalRules: newRules });
  };

  const removeConditionalRule = (index: number) => {
    const newRules = (modalConfig.conditionalRules || []).filter((_, i) => i !== index);
    setModalConfig({ ...modalConfig, conditionalRules: newRules.length > 0 ? newRules : undefined });
  };

  const updateConditionalRule = (index: number, updates: Partial<ConditionalRule>) => {
    const newRules = (modalConfig.conditionalRules || []).map((r, i) => i === index ? { ...r, ...updates } : r);
    setModalConfig({ ...modalConfig, conditionalRules: newRules });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">
              {modalConfig.key ? "Edit Column" : "Add New Column"}
            </h3>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6">
          {/* Column Name */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Column Name</label>
            <input
              type="text"
              value={modalConfig.name}
              onChange={(e) => setModalConfig({ ...modalConfig, name: e.target.value })}
              className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-xl outline-none bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              autoFocus
            />
          </div>

          {/* ALWAYS-visible options (before formula section) */}
          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <label className={`text-xs font-bold ${modalConfig.formula === 'none' ? 'text-slate-400' : 'text-slate-500'}`}>
                Keep Empty if Negative {modalConfig.formula === 'none' && <span className="font-normal">(N/A)</span>}
              </label>
              <input
                type="checkbox"
                checked={modalConfig.keepEmptyIfNegative || false}
                onChange={(e) => setModalConfig({ ...modalConfig, keepEmptyIfNegative: e.target.checked })}
                disabled={modalConfig.formula === 'none'}
                className={`w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 ${modalConfig.formula === 'none' ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Default Text Color</label>
              <div className="flex gap-2 flex-wrap">
                {DEFAULT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setModalConfig({ ...modalConfig, defaultTextColor: color })}
                    className={`w-6 h-6 rounded-full border-2 ${
                      modalConfig.defaultTextColor === color ? "border-slate-900 dark:border-white" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setModalConfig({ ...modalConfig, defaultTextColor: undefined })}
                  className={`w-6 h-6 rounded-full border border-slate-300 flex items-center justify-center text-[10px] ${
                    !modalConfig.defaultTextColor ? "bg-slate-200 dark:bg-slate-700" : "bg-white dark:bg-slate-900"
                  }`}
                  title="Clear color"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">
                Time Separator {modalConfig.formula === 'none' && <span className="font-normal text-slate-400">(N/A for manual columns)</span>}
              </label>
              <select
                value={modalConfig.formula === 'none' ? "" : (modalConfig.timeSeparator || ":")}
                onChange={(e) => setModalConfig({ ...modalConfig, timeSeparator: e.target.value })}
                disabled={modalConfig.formula === 'none'}
                className={`w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm ${modalConfig.formula === 'none' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {modalConfig.formula === 'none' ? (
                  <option value="">N/A</option>
                ) : (
                  <>
                    <option value=":">Colon (:)</option>
                    <option value=".">Dot (.)</option>
                    <option value="-">Dash (-)</option>
                    <option value="/">Slash (/)</option>
                    {modalConfig.timeSeparator && ![':', '.', '-', '/'].includes(modalConfig.timeSeparator) && (
                      <option value={modalConfig.timeSeparator}>{modalConfig.timeSeparator}</option>
                    )}
                  </>
                )}
              </select>
            </div>

            <div>
              <label className={`block text-xs font-bold mb-1 ${modalConfig.formula === 'none' ? 'text-slate-400' : 'text-slate-500'}`}>
                Time Format {modalConfig.formula === 'none' && <span className="font-normal">(N/A)</span>}
              </label>
              <div className={`flex bg-slate-200 dark:bg-slate-900 p-1 rounded ${modalConfig.formula === 'none' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <button
                  type="button"
                  onClick={() => modalConfig.formula !== 'none' && setModalConfig({ ...modalConfig, timeFormat: '24h' })}
                  disabled={modalConfig.formula === 'none'}
                  className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${modalConfig.timeFormat !== '12h' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  24-hour
                </button>
                <button
                  type="button"
                  onClick={() => modalConfig.formula !== 'none' && setModalConfig({ ...modalConfig, timeFormat: '12h' })}
                  disabled={modalConfig.formula === 'none'}
                  className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${modalConfig.timeFormat === '12h' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  12-hour (AM/PM)
                </button>
              </div>
            </div>
          </div>

          {/* Apply Data Formula */}
          <div className="space-y-3">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Apply Data Formula</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "none", label: "Manual Input", icon: Type },
                { id: "diff", label: "Time Difference", icon: Clock },
                { id: "sum", label: "Sum Total", icon: Plus },
                { id: "concat", label: "Concatenate", icon: ArrowRight },
                { id: "static", label: "Constant Value", icon: Hash },
                { id: "increment", label: "Auto Increment", icon: ArrowDownFromLine },
                { id: "complex", label: "Complex Formula", icon: Calculator },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setModalConfig({ ...modalConfig, formula: opt.id as FormulaType })}
                  className={`flex items-center p-3 rounded-lg border text-xs font-semibold transition-all ${
                    modalConfig.formula === opt.id
                      ? "bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-300"
                  }`}
                  type="button"
                >
                  <opt.icon className="w-4 h-4 mr-2 opacity-70" /> {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Formula params (only when formula != none) */}
          {modalConfig.formula !== "none" && (
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 animate-fade-in space-y-3">
              {modalConfig.formula === "diff" && (
                <div className="flex items-center gap-2">
                  <SelectColumn
                    label="End Time"
                    value={modalConfig.paramB || ""}
                    options={columnOrder}
                    onChange={(v) => setModalConfig({ ...modalConfig, paramB: v })}
                  />
                  <span className="text-slate-400 pt-5">-</span>
                  <SelectColumn
                    label="Start Time"
                    value={modalConfig.paramA || ""}
                    options={columnOrder}
                    onChange={(v) => setModalConfig({ ...modalConfig, paramA: v })}
                  />
                </div>
              )}

              {modalConfig.formula === "sum" && (
                <div className="flex items-center gap-2">
                  <SelectColumn
                    label="Value A"
                    value={modalConfig.paramA || ""}
                    options={columnOrder}
                    onChange={(v) => setModalConfig({ ...modalConfig, paramA: v })}
                  />
                  <span className="text-slate-400 pt-5">+</span>
                  <SelectColumn
                    label="Value B"
                    value={modalConfig.paramB || ""}
                    options={columnOrder}
                    onChange={(v) => setModalConfig({ ...modalConfig, paramB: v })}
                  />
                </div>
              )}

              {modalConfig.formula === "concat" && (
                <div className="flex items-center gap-2">
                  <SelectColumn
                    label="Prefix"
                    value={modalConfig.paramA || ""}
                    options={columnOrder}
                    onChange={(v) => setModalConfig({ ...modalConfig, paramA: v })}
                  />
                  <span className="text-slate-400 pt-5">&</span>
                  <SelectColumn
                    label="Suffix"
                    value={modalConfig.paramB || ""}
                    options={columnOrder}
                    onChange={(v) => setModalConfig({ ...modalConfig, paramB: v })}
                  />
                </div>
              )}

              {modalConfig.formula === "static" && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Static Value</label>
                  <input
                    type="text"
                    value={modalConfig.staticValue || ""}
                    onChange={(e) => setModalConfig({ ...modalConfig, staticValue: e.target.value })}
                    className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm"
                  />
                </div>
              )}

              {modalConfig.formula === "increment" && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-slate-500 mb-1">Type</label>
                      <select
                        value={modalConfig.paramB || "number"}
                        onChange={(e) => setModalConfig({ ...modalConfig, paramB: e.target.value })}
                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm"
                      >
                        <option value="number">Number</option>
                        <option value="date">Date (DD/MM/YYYY)</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-slate-500 mb-1">Step</label>
                      <input
                        type="number"
                        value={modalConfig.paramA || ""}
                        onChange={(e) => setModalConfig({ ...modalConfig, paramA: e.target.value })}
                        placeholder="1"
                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Start Value</label>
                    <input
                      type="text"
                      value={modalConfig.staticValue || ""}
                      onChange={(e) => setModalConfig({ ...modalConfig, staticValue: e.target.value })}
                      placeholder={modalConfig.paramB === "date" ? "01/01/2024" : "0"}
                      className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm"
                    />
                  </div>
                </div>
              )}

              {modalConfig.formula === "complex" && (
                <div className="space-y-4">
                  {/* Textarea */}
                  <div>
                    <div className="flex justify-between items-end mb-1">
                      <label className="block text-xs font-bold text-slate-500">Formula Expression</label>
                      <button
                        type="button"
                        onClick={() => setShowFormulaGuide(true)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-bold"
                      >
                        <BookOpen className="w-3 h-3" /> Formula Guide
                      </button>
                    </div>
                    <FormulaInput
                      value={modalConfig.complexFormula || ""}
                      onChange={(val) => setModalConfig({ ...modalConfig, complexFormula: val })}
                      onFocus={() => {}}
                      columns={columnOrder}
                      inputRef={formulaRef}
                      placeholder='e.g. TIME( ([exit] - [entrance]) - LUNCH_MINS + [PREV_CELL] )'
                    />
                    
                    {/* Compiler / Debugger Feedback */}
                    {!formulaValidation.valid && (
                      <div className="mt-2 p-2 rounded-lg text-xs flex items-center gap-2 border bg-red-50 border-red-100 text-red-700 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{formulaValidation.error}</span>
                      </div>
                    )}
                  </div>

                  {/* Available Elements - Using FormulaBuilder */}
                  <div className="h-[250px]">
                    <FormulaBuilder 
                      columns={columnOrder} 
                      constants={constants} 
                      onInsert={handleInsert} 
                    />
                  </div>
                </div>
              )}

              {/* Conditional Value Rules - Moved outside complex block to be available for all */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <Filter className="w-3 h-3" /> Conditional Value Rules
                  </h4>
                  <button
                    type="button"
                    onClick={addConditionalRule}
                    className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-md hover:bg-blue-100 transition-colors font-bold"
                  >
                    + Add Condition
                  </button>
                </div>

                <div className="space-y-3">
                  {(modalConfig.conditionalRules || []).map((rule, idx) => (
                    <div key={idx} className="space-y-2">
                      {idx > 0 && (
                        <div className="flex justify-center -my-1 relative z-10">
                          <div className="bg-blue-500 text-white w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900 shadow-sm">
                            <Plus className="w-3 h-3" />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                        <select
                          value={rule.columnKey}
                          onChange={(e) => updateConditionalRule(idx, { columnKey: e.target.value })}
                          className="flex-1 p-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900"
                        >
                          {columnOrder.map(col => <option key={col} value={col}>{col}</option>)}
                        </select>
                        <select
                          value={rule.operator}
                          onChange={(e) => updateConditionalRule(idx, { operator: e.target.value as any })}
                          className="flex-1 p-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900"
                        >
                          <option value="is_empty">Is Empty</option>
                          <option value="not_empty">Is Not Empty</option>
                          <option value="equals">Equals</option>
                          <option value="not_zero">Is Not Zero</option>
                          <option value="equals_zero">Equals 0</option>
                          <option value="greater_than_zero">Greater Than 0</option>
                          <option value="less_than_zero">Less Than 0</option>
                        </select>
                        {rule.operator === 'equals' && (
                          <input
                            type="text"
                            value={rule.value || ""}
                            onChange={(e) => updateConditionalRule(idx, { value: e.target.value })}
                            placeholder="Value"
                            className="flex-1 p-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => removeConditionalRule(idx)}
                          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {(modalConfig.conditionalRules && modalConfig.conditionalRules.length > 0) && (
                    <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30 space-y-2">
                      <label className="block text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                        THEN set value to:
                      </label>
                      <input
                        type="text"
                        value={modalConfig.conditionalValue || ""}
                        onChange={(e) => setModalConfig({ ...modalConfig, conditionalValue: e.target.value })}
                        placeholder="e.g. 0:00 or Manual"
                        className="w-full p-2 text-sm border border-blue-200 dark:border-blue-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  )}

                  {(!modalConfig.conditionalRules || modalConfig.conditionalRules.length === 0) && (
                    <div className="text-[10px] text-slate-400 italic text-center py-2">
                      No conditional rules defined. Normal formula logic applies.
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-slate-500 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg">
                  <strong>How it works:</strong> If all conditions are met, the column will display the "THEN" value. Otherwise, it will use the normal formula or manual input.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex gap-3">
          {modalConfig.key && (
            <button
              type="button"
              onClick={() => handleDeleteColumnByKey(modalConfig.key)}
              className="px-4 py-3 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 font-bold rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
              title="Delete this column"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveColumn}
            disabled={!modalConfig.name}
            className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
