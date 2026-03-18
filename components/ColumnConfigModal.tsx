import React from "react";
import { X, Trash2, Plus, ArrowRight, Calculator, Type, Hash, Clock, ArrowDownFromLine, BookOpen } from "lucide-react";
import { ColumnConfig, FormulaType } from "../types";

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
  if (!open) return null;

  const appendToComplex = (text: string) => {
    setModalConfig({
      ...modalConfig,
      complexFormula: (modalConfig.complexFormula || "") + text,
    });
  };

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
                <div className="space-y-3">
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
                    <textarea
                      value={modalConfig.complexFormula || ""}
                      onChange={(e) => setModalConfig({ ...modalConfig, complexFormula: e.target.value })}
                      placeholder='e.g. TIME( ([exit] - [entrance]) - LUNCH_MINS + [PREV_CELL] )'
                      className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm font-mono"
                      rows={3}
                    />
                  </div>

                  {/* Available Elements */}
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <p className="font-bold mb-2">Available Elements:</p>

                    <div className="flex flex-col gap-3 max-h-48 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950/50">
                      {/* Columns */}
                      <div className="formula-category">
                        <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1 sticky top-0 bg-slate-50 dark:bg-slate-950/90 py-1 z-10">
                          📊 Columns
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {columnOrder.map((col) => (
                            <button
                              key={col}
                              type="button"
                              onClick={() => appendToComplex(`[${col}]`)}
                              className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200"
                            >
                              [{col}]
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => appendToComplex(`[PREV_CELL]`)}
                            className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                            title="Value of this column in the previous row"
                          >
                            [PREV_CELL]
                          </button>
                        </div>
                      </div>

                      {/* Constants */}
                      {Object.keys(constants).length > 0 && (
                        <div className="formula-category">
                          <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1 sticky top-0 bg-slate-50 dark:bg-slate-950/90 py-1 z-10">
                            🧮 Constants
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {Object.keys(constants).map((k) => (
                              <button
                                key={k}
                                type="button"
                                onClick={() => appendToComplex(k)}
                                className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded hover:bg-emerald-200 dark:hover:bg-emerald-800"
                              >
                                {k}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Logic & Types */}
                      <div className="formula-category">
                        <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1 sticky top-0 bg-slate-50 dark:bg-slate-950/90 py-1 z-10">
                          ⚙️ Logic & Types
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {[
                            { t: "IF(", label: "IF(...)", cls: "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300", title: "IF(condition, trueVal, falseVal)" },
                            { t: "AND(", label: "AND(...)", cls: "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300", title: "AND(cond1, cond2, ...)" },
                            { t: "OR(", label: "OR(...)", cls: "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300", title: "OR(cond1, cond2, ...)" },
                            { t: "NOT(", label: "NOT(...)", cls: "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300", title: "NOT(cond)" },
                            { t: "NUM(", label: "NUM(...)", cls: "bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300", title: "Force number output" },
                            { t: 'STRING("', label: "STRING(...)", cls: "bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300", title: 'STRING("Text")' },
                            { t: "TIME(", label: "TIME(...)", cls: "bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300", title: "Force time formatting (minutes => H:MM) or parse HH:MM to minutes" },
                            { t: "HOURS(", label: "HOURS(...)", cls: "bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300", title: "Convert hours to minutes (e.g. HOURS(8) => 480)" },
                            { t: "MINS(", label: "MINS(...)", cls: "bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300", title: "Explicitly declare minutes (e.g. MINS(30) => 30)" },
                          ].map((b) => (
                            <button
                              key={b.label}
                              type="button"
                              onClick={() => appendToComplex(b.t)}
                              className={`px-2 py-1 rounded hover:opacity-90 font-bold ${b.cls}`}
                              title={b.title}
                            >
                              {b.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Math Functions */}
                      <div className="formula-category">
                        <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1 sticky top-0 bg-slate-50 dark:bg-slate-950/90 py-1 z-10">
                          📈 Math Functions
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {[
                            { t: "MAX(", label: "MAX(...)", title: "MAX(a,b,...)" },
                            { t: "MIN(", label: "MIN(...)", title: "MIN(a,b,...)" },
                            { t: "ROUND(", label: "ROUND(...)", title: "ROUND(x)" },
                            { t: "FLOOR(", label: "FLOOR(...)", title: "FLOOR(x)" },
                            { t: "CEIL(", label: "CEIL(...)", title: "CEIL(x)" },
                            { t: "ABS(", label: "ABS(...)", title: "ABS(x)" },
                          ].map((b) => (
                            <button
                              key={b.label}
                              type="button"
                              onClick={() => appendToComplex(b.t)}
                              className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-800 font-bold"
                              title={b.title}
                            >
                              {b.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Operators */}
                      <div className="formula-category">
                        <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1 sticky top-0 bg-slate-50 dark:bg-slate-950/90 py-1 z-10">
                          ➕ Operators
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {["+", "-", "*", "/", "(", ")", ">", "<", "=", "&", "|", ",", "?", ":"].map((op) => (
                            <button
                              key={op}
                              type="button"
                              onClick={() => appendToComplex(` ${op} `)}
                              className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-700 font-mono text-slate-800 dark:text-slate-200"
                            >
                              {op}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 text-[11px] text-slate-500">
                      Note: default output is NUMBER. Wrap final expression with <span className="font-mono">TIME(...)</span> if you want time formatting.
                    </div>
                  </div>
                </div>
              )}
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
