import React from "react";
import {
  Trash2,
  ArrowRight,
  Calculator,
  Settings2,
  GripHorizontal,
  GripVertical,
  CheckSquare,
  Square,
  X,
  ArrowUpFromLine,
  ArrowDownFromLine,
} from "lucide-react";
import { TimeEntry, ColumnConfig } from "../types";

interface DataReviewTableProps {
  data: TimeEntry[];
  configs: ColumnConfig[];
  columnOrder: string[];
  selectedIds: Set<string>;
  getLabel: (key: string) => string;
  isCalculatedColumn: (key: string) => boolean;
  toggleSelectAll: () => void;
  toggleSelection: (id: string) => void;
  handleColDragStart: (e: React.DragEvent<HTMLTableCellElement>, position: number) => void;
  handleColDragEnter: (e: React.DragEvent<HTMLTableCellElement>, position: number) => void;
  handleColDragEnd: (e: React.DragEvent<HTMLTableCellElement>) => void;
  handleRowDragStart: (e: React.DragEvent<HTMLTableRowElement>, index: number) => void;
  handleRowDragEnter: (e: React.DragEvent<HTMLTableRowElement>, index: number) => void;
  handleRowDragEnd: () => void;
  openEditColumn: (key: string) => void;
  handleChange: (id: string, field: string, value: string) => void;
  handleDeleteRow: (id: string) => void;
  moveSelected: (direction: -1 | 1) => void;
  deleteSelected: () => void;
  setSelectedIds: (ids: Set<string>) => void;
}

export default function DataReviewTable({
  data,
  configs,
  columnOrder,
  selectedIds,
  getLabel,
  isCalculatedColumn,
  toggleSelectAll,
  toggleSelection,
  handleColDragStart,
  handleColDragEnter,
  handleColDragEnd,
  handleRowDragStart,
  handleRowDragEnter,
  handleRowDragEnd,
  openEditColumn,
  handleChange,
  handleDeleteRow,
  moveSelected,
  deleteSelected,
  setSelectedIds,
}: DataReviewTableProps) {
  return (
    <>
      <div className="flex-1 bg-slate-50 dark:bg-slate-950 p-4 pb-4 flex flex-col min-h-0">
        <div className="max-w-[1600px] mx-auto w-full bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col flex-1 min-h-[300px] overflow-hidden">
          <div className="overflow-auto flex-1">
            <table className="w-full min-w-max border-collapse relative">
              <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 shadow-sm">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="w-10 p-3 text-center">
                    <button onClick={toggleSelectAll} className="text-slate-500 hover:text-slate-800 dark:hover:text-white">
                      {selectedIds.size > 0 && selectedIds.size === data.length ? (
                        <CheckSquare className="w-5 h-5" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  </th>

                  {columnOrder.map((key, index) => (
                    <th
                      key={key}
                      draggable
                      onDragStart={(e) => handleColDragStart(e, index)}
                      onDragEnter={(e) => handleColDragEnter(e, index)}
                      onDragEnd={handleColDragEnd}
                      onDragOver={(e) => e.preventDefault()}
                      className="p-3 text-left min-w-[150px] relative group cursor-grab active:cursor-grabbing hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors select-none"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <GripHorizontal className="w-4 h-4 text-slate-400" />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            {getLabel(key)}
                            {isCalculatedColumn(key) && <Calculator className="w-3 h-3 ml-1 inline text-blue-500" />}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditColumn(key);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="p-1 rounded hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors text-slate-400"
                          title="Edit Column Settings"
                        >
                          <Settings2 className="w-4 h-4" />
                        </button>
                      </div>
                    </th>
                  ))}

                  <th className="w-12 p-3 bg-slate-100 dark:bg-slate-800"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.map((entry, index) => {
                  const isSelected = selectedIds.has(entry.id);
                  return (
                    <tr
                      key={entry.id}
                      draggable
                      onDragStart={(e) => handleRowDragStart(e, index)}
                      onDragEnter={(e) => handleRowDragEnter(e, index)}
                      onDragEnd={handleRowDragEnd}
                      onDragOver={(e) => e.preventDefault()}
                      className={`group transition-colors ${
                        isSelected ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <td className="p-2 text-center relative flex items-center justify-center gap-2">
                        <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <button onClick={() => toggleSelection(entry.id)} className="text-blue-600 dark:text-blue-400">
                          {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-slate-300" />}
                        </button>
                      </td>

                      {columnOrder.map((key) => {
                        const cfg = configs.find((c) => c.key === key);
                        const isCalculated = !!cfg && cfg.formula !== "none";
                        const color = cfg?.defaultTextColor;

                        return (
                          <td key={`${entry.id}-${key}`} className="p-2">
                            <input
                              type="text"
                              value={(entry as any)[key] || ""}
                              readOnly={isCalculated}
                              onChange={(e) => handleChange(entry.id, key, e.target.value)}
                              style={color ? { color } : undefined}
                              className={[
                                "w-full bg-transparent border-b border-transparent focus:border-blue-500 rounded-none px-2 py-1.5 text-sm outline-none transition-colors",
                                isCalculated
                                  ? "font-medium cursor-not-allowed"
                                  : "text-slate-900 dark:text-slate-100 hover:border-slate-200 dark:hover:border-slate-700",
                                !color && isCalculated ? "text-blue-600 dark:text-blue-400" : "",
                              ].join(" ")}
                            />
                          </td>
                        );
                      })}

                      <td className="p-2 text-right">
                        <button
                          onClick={() => handleDeleteRow(entry.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors md:opacity-0 md:group-hover:opacity-100 opacity-100"
                          title="Delete Row"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* selection toolbar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-20 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-auto md:min-w-[400px] bg-slate-900 text-white p-3 rounded-xl shadow-2xl flex items-center justify-between z-40 animate-slide-up border border-slate-700">
          <div className="flex items-center gap-3 px-2">
            <div className="bg-blue-600 text-xs font-bold px-2 py-1 rounded-md">{selectedIds.size} Selected</div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => moveSelected(-1)} className="p-2 hover:bg-slate-700 rounded-lg transition-colors" title="Move Up">
              <ArrowUpFromLine className="w-5 h-5" />
            </button>
            <button onClick={() => moveSelected(1)} className="p-2 hover:bg-slate-700 rounded-lg transition-colors" title="Move Down">
              <ArrowDownFromLine className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-slate-700 mx-1"></div>
            <button onClick={deleteSelected} className="p-2 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors" title="Delete Selected">
              <Trash2 className="w-5 h-5" />
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="ml-2 text-slate-400 hover:text-white" title="Clear selection">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
