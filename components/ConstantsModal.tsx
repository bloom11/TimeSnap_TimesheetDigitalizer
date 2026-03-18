import React, { useState, useEffect } from "react";
import { X, Trash2, Plus } from "lucide-react";

interface ConstantsModalProps {
  open: boolean;
  onClose: () => void;
  constants: Record<string, string | number>;
  onUpdateConstants: (constants: Record<string, string | number>) => void;
}

type FieldType = 'number' | 'string' | 'time';

export default function ConstantsModal({
  open,
  onClose,
  constants,
  onUpdateConstants,
}: ConstantsModalProps) {
  const [uiTypes, setUiTypes] = useState<Record<string, FieldType>>({});
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<FieldType>("number");
  const [newValue, setNewValue] = useState("");

  // Infer and stabilize UI types for existing constants
  useEffect(() => {
    if (!open) return;
    const nextTypes = { ...uiTypes };
    let changed = false;
    
    for (const [k, v] of Object.entries(constants)) {
      if (!nextTypes[k]) {
        nextTypes[k] = typeof v === 'number' ? 'number' : (/^\d{1,2}:\d{2}$/.test(String(v)) ? 'time' : 'string');
        changed = true;
      }
    }
    
    // Clean up deleted keys
    for (const k of Object.keys(nextTypes)) {
      if (!(k in constants)) {
        delete nextTypes[k];
        changed = true;
      }
    }
    
    if (changed) setUiTypes(nextTypes);
  }, [constants, open]);

  if (!open) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
    if (!name) return;

    let finalVal: string | number = newValue;
    if (newType === 'number') {
      const num = parseFloat(newValue);
      finalVal = isNaN(num) ? 0 : num;
    } else if (newType === 'time' && !newValue) {
      finalVal = "00:00";
    }

    onUpdateConstants({ ...constants, [name]: finalVal });
    setUiTypes(prev => ({ ...prev, [name]: newType }));
    setNewName("");
    setNewValue("");
  };

  const handleTypeChange = (key: string, type: FieldType) => {
    setUiTypes(prev => ({ ...prev, [key]: type }));
    let nextVal: string | number = constants[key];
    
    if (type === 'number') {
      nextVal = parseFloat(String(nextVal)) || 0;
    } else if (type === 'time') {
      nextVal = /^\d+:\d{2}$/.test(String(nextVal)) ? String(nextVal) : "00:00";
    } else {
      nextVal = String(nextVal);
    }
    
    onUpdateConstants({ ...constants, [key]: nextVal });
  };

  const handleValueChange = (key: string, valStr: string) => {
    const type = uiTypes[key] || 'string';
    let nextVal: string | number = valStr;
    
    if (type === 'number') {
      const num = parseFloat(valStr);
      nextVal = valStr === "" ? 0 : (isNaN(num) ? valStr : num);
    } else if (type === 'time') {
      nextVal = valStr.replace(/[^\d:]/g, '');
    }
    
    onUpdateConstants({ ...constants, [key]: nextVal });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Formula Constants</h3>
            <p className="text-xs text-slate-500">Variables usable in Complex formulas.</p>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {Object.entries(constants).length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
              No constants defined yet.
            </div>
          ) : (
            Object.entries(constants).map(([key, value]) => {
              const type = uiTypes[key] || 'string';
              return (
                <div key={key} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 sm:p-0 bg-slate-50 dark:bg-slate-800/50 sm:bg-transparent rounded-lg border border-slate-200 dark:border-slate-700 sm:border-none">
                  <div className="flex gap-2 w-full sm:w-auto sm:flex-1">
                    <input
                      type="text"
                      value={key}
                      readOnly
                      className="flex-1 w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-800 text-sm font-mono text-slate-500"
                    />
                    <select
                      value={type}
                      onChange={(e) => handleTypeChange(key, e.target.value as FieldType)}
                      className="p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300"
                    >
                      <option value="number">Num</option>
                      <option value="string">Text</option>
                      <option value="time">Time</option>
                    </select>
                  </div>
                  <span className="hidden sm:inline text-slate-400">=</span>
                  <div className="flex items-center gap-2">
                    {type === 'time' ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="HH:MM"
                        value={value}
                        onChange={(e) => handleValueChange(key, e.target.value)}
                        className="flex-1 w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm font-mono"
                      />
                    ) : (
                      <input
                        type={type === 'number' ? 'number' : 'text'}
                        step={type === 'number' ? 'any' : undefined}
                        value={value}
                        onChange={(e) => handleValueChange(key, e.target.value)}
                        className="flex-1 w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm"
                      />
                    )}
                    <button
                      onClick={() => {
                        const next = { ...constants };
                        delete next[key];
                        onUpdateConstants(next);
                      }}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded shrink-0"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Add New Constant</p>
            <form onSubmit={handleAdd} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex gap-2 w-full sm:w-auto sm:flex-1">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
                  type="text"
                  placeholder="NAME"
                  className="flex-1 w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm font-mono uppercase"
                  required
                />
                <select
                  value={newType}
                  onChange={(e) => {
                    setNewType(e.target.value as FieldType);
                    setNewValue(""); // Reset value when type changes
                  }}
                  className="p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300"
                >
                  <option value="number">Num</option>
                  <option value="string">Text</option>
                  <option value="time">Time</option>
                </select>
              </div>
              <span className="hidden sm:inline text-slate-400">=</span>
              <div className="flex items-center gap-2">
                {newType === 'time' ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value.replace(/[^\d:]/g, ''))}
                    placeholder="HH:MM"
                    pattern="^\d+:[0-5]\d$"
                    title="Format: HH:MM (e.g., 8:30 or 25:00)"
                    className="flex-1 w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm font-mono"
                    required
                  />
                ) : (
                  <input
                    type={newType === 'number' ? 'number' : 'text'}
                    step={newType === 'number' ? 'any' : undefined}
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="Value"
                    className="flex-1 w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm"
                    required={newType !== 'string'}
                  />
                )}
                <button type="submit" className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 shrink-0 flex items-center justify-center gap-1" title="Add">
                  <Plus className="w-4 h-4" />
                  <span className="sm:hidden text-sm font-medium pr-1">Add</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
