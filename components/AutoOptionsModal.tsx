import React from "react";
import { Wand2, X, Trash2 } from "lucide-react";

interface AutoOptionsModalProps {
  open: boolean;
  onClose: () => void;
  onAutoFillWeekends: (includeBoundaries: boolean) => void;
  onRemoveEmptyWeekends: () => void;
  includeBoundaries: boolean;
  onIncludeBoundariesChange: (val: boolean) => void;
}

export default function AutoOptionsModal({ 
  open, 
  onClose, 
  onAutoFillWeekends, 
  onRemoveEmptyWeekends,
  includeBoundaries,
  onIncludeBoundariesChange
}: AutoOptionsModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center">
            <Wand2 className="w-5 h-5 mr-2 text-amber-500" />
            Intelligent Actions
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto space-y-6">
          <div className="space-y-4">
            <button
              onClick={() => {
                onAutoFillWeekends(includeBoundaries);
                onClose();
              }}
              className="w-full text-left p-4 border border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all group"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">Auto-Fill Missing Weekends</div>
                <Wand2 className="w-4 h-4 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Detects gaps in your scanned dates and automatically inserts empty rows for Saturdays and Sundays.
              </div>
            </button>

            <div className="flex items-start space-x-3 px-1">
              <div className="flex items-center h-5">
                <input
                  id="includeBoundaries"
                  type="checkbox"
                  checked={includeBoundaries}
                  onChange={(e) => onIncludeBoundariesChange(e.target.checked)}
                  className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500 dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
              <div className="text-sm">
                <label htmlFor="includeBoundaries" className="font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  Include Month Boundaries
                </label>
                <p className="text-slate-500 dark:text-slate-400">
                  Also adds weekends at the very beginning and end of the month (e.g., if the 1st is a Sunday).
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <button
              onClick={() => {
                onRemoveEmptyWeekends();
                onClose();
              }}
              className="w-full text-left p-4 border border-slate-200 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all group"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">Clean Empty Weekends</div>
                <Trash2 className="w-4 h-4 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Removes Saturday and Sunday rows that have no data. Manual entries or notes on weekends are preserved.
              </div>
            </button>
          </div>
        </div>
        
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
