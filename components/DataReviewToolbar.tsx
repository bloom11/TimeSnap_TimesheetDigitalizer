import React from "react";
import {
  ListFilter,
  ArrowUp,
  ArrowDown,
  ScanLine,
  Calculator,
  LayoutGrid,
  ListOrdered,
  Plus,
  LayoutTemplate,
} from "lucide-react";

interface DataReviewToolbarProps {
  sortOrder: "asc" | "desc" | "none";
  onSort: () => void;
  onScanMore?: () => void;
  onOpenConstants: () => void;
  onOpenProfiles: () => void;
  onAddColumn: () => void;
  onReorderColumns: () => void;
  onAddRow: () => void;
}

export default function DataReviewToolbar({
  sortOrder,
  onSort,
  onScanMore,
  onOpenConstants,
  onOpenProfiles,
  onAddColumn,
  onReorderColumns,
  onAddRow,
}: DataReviewToolbarProps) {
  return (
    <div className="shrink-0 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-20">
      <div className="flex gap-2 overflow-x-auto hide-scroll-until-touch max-w-[1600px] mx-auto w-full items-center pb-1">
        <button
          onClick={onSort}
          className="shrink-0 flex items-center px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-sm font-medium border border-slate-200 dark:border-slate-700 transition-colors"
        >
          <ListFilter className="w-4 h-4 mr-2" />
          {sortOrder === "none" ? "Sort Date" : sortOrder === "asc" ? "Oldest First" : "Newest First"}
          {sortOrder === "asc" && <ArrowUp className="w-3 h-3 ml-1" />}
          {sortOrder === "desc" && <ArrowDown className="w-3 h-3 ml-1" />}
        </button>

        {onScanMore && (
          <button
            onClick={onScanMore}
            className="shrink-0 flex items-center px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 text-sm font-medium border border-blue-200 dark:border-blue-800 transition-colors"
          >
            <ScanLine className="w-4 h-4 mr-1" /> Add Page
          </button>
        )}

        <button
          onClick={onOpenProfiles}
          className="shrink-0 flex items-center px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-sm font-medium border border-indigo-200 dark:border-indigo-800 transition-colors"
        >
          <LayoutTemplate className="w-4 h-4 mr-1" /> Profiles
        </button>

        <button
          onClick={onOpenConstants}
          className="shrink-0 flex items-center px-3 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-sm font-medium border border-emerald-200 dark:border-emerald-800 transition-colors"
        >
          <Calculator className="w-4 h-4 mr-1" /> Constants
        </button>

        <button
          onClick={onAddColumn}
          className="shrink-0 flex items-center px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium border border-slate-200 dark:border-slate-700 transition-colors"
        >
          <LayoutGrid className="w-4 h-4 mr-1" /> Add Column
        </button>

        <button
          onClick={onReorderColumns}
          className="shrink-0 flex items-center px-3 py-2 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 text-sm font-medium border border-purple-200 dark:border-purple-800 transition-colors"
        >
          <ListOrdered className="w-4 h-4 mr-1" /> Reorder Columns
        </button>

        <button
          onClick={onAddRow}
          className="shrink-0 flex items-center px-3 py-2 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 text-sm font-medium border border-green-200 dark:border-green-800 transition-colors"
        >
          <Plus className="w-4 h-4 mr-1" /> Add Row
        </button>
      </div>
    </div>
  );
}
