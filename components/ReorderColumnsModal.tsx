import React from "react";
import { X, ArrowUp, ArrowDown } from "lucide-react";

interface ReorderColumnsModalProps {
  open: boolean;
  onClose: () => void;
  columnOrder: string[];
  getLabel: (key: string) => string;
  moveColumn: (index: number, direction: number) => void;
}

export default function ReorderColumnsModal({
  open,
  onClose,
  columnOrder,
  getLabel,
  moveColumn,
}: ReorderColumnsModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Reorder Columns</h3>
            <p className="text-xs text-slate-500 mt-1">Use arrows to move columns</p>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-3 overflow-y-auto flex-1">
          <div className="space-y-2">
            {columnOrder.map((key, index) => (
              <div
                key={key}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"
              >
                <span className="font-medium text-sm text-slate-700 dark:text-slate-300">{getLabel(key)}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveColumn(index, -1)}
                    disabled={index === 0}
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg disabled:opacity-30 transition-colors"
                    title="Up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveColumn(index, 1)}
                    disabled={index === columnOrder.length - 1}
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg disabled:opacity-30 transition-colors"
                    title="Down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
