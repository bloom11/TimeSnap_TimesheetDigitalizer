// components/DataReview.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Trash2, Plus, ArrowRight, Calculator, X, Settings2, ScanLine, GripHorizontal,
  LayoutGrid, Type, Hash, Clock, ArrowUp, ArrowDown, GripVertical, ListFilter,
  CheckSquare, Square, ArrowUpFromLine, ArrowDownFromLine
} from 'lucide-react';
import { TimeEntry, ColumnConfig, FormulaType } from '../types';

interface DataReviewProps {
  data: TimeEntry[];
  configs: ColumnConfig[];
  onUpdate: (data: TimeEntry[], configs?: ColumnConfig[]) => void;
  onNext: () => void;
  onScanMore?: () => void;

  // ✅ reuse App.tsx confirm modal (optional)
  onRequestConfirm?: (
    cfg: { title: string; message: string; confirmText?: string; cancelText?: string },
    onConfirm: () => void
  ) => void;
}

const DEFAULT_LABELS: { [key: string]: string } = {
  date: 'Date',
  entrance: 'Entrance',
  lunchStart: 'Lunch Start',
  lunchEnd: 'Lunch End',
  exit: 'Exit'
};

const DataReview: React.FC<DataReviewProps> = ({ data, configs, onUpdate, onNext, onScanMore, onRequestConfirm }) => {
  const [showColModal, setShowColModal] = useState(false);
  const [modalConfig, setModalConfig] = useState<ColumnConfig>({
    key: '',
    name: '',
    formula: 'none',
    paramA: '',
    paramB: '',
    staticValue: ''
  });

  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('none');

  // Drag References
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const rowDragItem = useRef<number | null>(null);
  const rowDragOverItem = useRef<number | null>(null);

  // ✅ Confirm helper: uses App modal if available, else fallback
  const confirmAction = (
    cfg: { title: string; message: string; confirmText?: string; cancelText?: string },
    action: () => void
  ) => {
    if (onRequestConfirm) {
      onRequestConfirm(cfg, action);
      return;
    }
    // fallback (dev / non-PWA)
    if (window.confirm(cfg.message)) action();
  };

  // ✅ Keep columnOrder always in sync with current data keys
  useEffect(() => {
    if (data.length === 0) {
      setColumnOrder([]);
      return;
    }

    const allKeys = Array.from(
      new Set(data.flatMap(item => Object.keys(item).filter(k => k !== 'id')))
    ) as string[];

    const standardOrder = ['date', 'entrance', 'lunchStart', 'lunchEnd', 'exit'];

    setColumnOrder(prev => {
      // initial
      if (prev.length === 0) {
        return [
          ...standardOrder.filter(k => allKeys.includes(k)),
          ...allKeys.filter(k => !standardOrder.includes(k))
        ];
      }

      // keep what still exists
      const kept = prev.filter(k => allKeys.includes(k));
      // add missing keys
      const missing = allKeys.filter(k => !kept.includes(k));

      // keep standard keys earlier if they appear
      const missingStandard = standardOrder.filter(k => missing.includes(k));
      const missingOther = missing.filter(k => !standardOrder.includes(k));

      return [...kept, ...missingStandard, ...missingOther];
    });
  }, [data]);

  const getLabel = (key: string) => {
    const config = configs.find(c => c.key === key);
    if (config && config.name) return config.name;
    if (DEFAULT_LABELS[key]) return DEFAULT_LABELS[key];
    return key.replace(/([A-Z])/g, ' $1').replace(/(\d+)/g, '').trim();
  };

  const generateKey = (name: string) => {
    // Just use a sanitized version of the name, no random numbers.
    // This ensures consistency across renders and exports.
    let base = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!base) base = 'col';
    
    // Ensure uniqueness against existing keys
    let finalKey = base;
    let counter = 1;
    while (columnOrder.includes(finalKey)) {
      finalKey = `${base}${counter}`;
      counter++;
    }
    return finalKey;
  };

  // --- Column Drag Logic ---
  const handleColDragStart = (e: React.DragEvent<HTMLTableCellElement>, position: number) => {
    dragItem.current = position;
    e.currentTarget.classList.add('opacity-50', 'bg-blue-50');
  };

  const handleColDragEnter = (e: React.DragEvent<HTMLTableCellElement>, position: number) => {
    e.preventDefault();
    dragOverItem.current = position;
  };

  const handleColDragEnd = (e: React.DragEvent<HTMLTableCellElement>) => {
    e.currentTarget.classList.remove('opacity-50', 'bg-blue-50');
    if (
      dragItem.current !== null &&
      dragOverItem.current !== null &&
      dragItem.current !== dragOverItem.current
    ) {
      const _columnOrder = [...columnOrder];
      const draggedItemContent = _columnOrder[dragItem.current];
      _columnOrder.splice(dragItem.current, 1);
      _columnOrder.splice(dragOverItem.current, 0, draggedItemContent);
      setColumnOrder(_columnOrder);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // --- Row Drag Logic (Group Support) ---
  const handleRowDragStart = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    rowDragItem.current = index;
    e.dataTransfer.effectAllowed = "move";
    if (!selectedIds.has(data[index].id)) {
      setSelectedIds(new Set([data[index].id]));
    }
  };

  const handleRowDragEnter = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    e.preventDefault();
    rowDragOverItem.current = index;
  };

  const handleRowDragEnd = () => {
    if (rowDragItem.current !== null && rowDragOverItem.current !== null) {
      const fromIndex = rowDragItem.current;
      const toIndex = rowDragOverItem.current;

      if (fromIndex !== toIndex) {
        const newData = [...data];
        const targetEntry = data[fromIndex];

        if (selectedIds.has(targetEntry.id)) {
          const nonSelected = data.filter(d => !selectedIds.has(d.id));
          const selected = data.filter(d => selectedIds.has(d.id));

          const dropTargetId = data[toIndex].id;
          let insertIdx = nonSelected.findIndex(x => x.id === dropTargetId);

          if (insertIdx === -1) {
            insertIdx = toIndex;
            if (insertIdx > nonSelected.length) insertIdx = nonSelected.length;
          } else {
            if (fromIndex < toIndex) insertIdx++;
          }

          nonSelected.splice(insertIdx, 0, ...selected);
          onUpdate(nonSelected);
        } else {
          const [removed] = newData.splice(fromIndex, 1);
          newData.splice(toIndex, 0, removed);
          onUpdate(newData);
        }
      }
    }
    rowDragItem.current = null;
    rowDragOverItem.current = null;
  };

  // --- Selection Logic ---
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === data.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(data.map(d => d.id)));
  };

  // --- Sorting Logic ---
  const parseDateStr = (d: string) => {
    if (!d) return 0;
    const parts = d.replace(/[\.-]/g, '/').split('/');
    if (parts.length !== 3) return 0;
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
  };

  const handleSort = () => {
    const nextOrder = sortOrder === 'none' ? 'asc' : sortOrder === 'asc' ? 'desc' : 'none';
    setSortOrder(nextOrder);

    if (nextOrder === 'none') {
      const sorted = [...data].sort((a, b) => a.id.localeCompare(b.id));
      onUpdate(sorted);
    } else {
      const sorted = [...data].sort((a, b) => {
        const tA = parseDateStr(a.date);
        const tB = parseDateStr(b.date);
        return nextOrder === 'asc' ? tA - tB : tB - tA;
      });
      onUpdate(sorted);
    }
  };

  // --- Group Move (Touch Compatible) ---
  const moveSelected = (direction: -1 | 1) => {
    if (selectedIds.size === 0) return;

    const indices = data
      .map((item, idx) => ({ item, idx }))
      .filter(p => selectedIds.has(p.item.id))
      .map(p => p.idx)
      .sort((a, b) => direction === -1 ? a - b : b - a);

    let newData = [...data];
    let canMove = true;

    for (const idx of indices) {
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= newData.length) {
        canMove = false;
        break;
      }
      const temp = newData[newIdx];
      newData[newIdx] = newData[idx];
      newData[idx] = temp;
    }

    if (canMove) onUpdate(newData);
  };

  // ✅ FIX: no window.confirm (uses app confirm)
  const deleteSelected = () => {
    if (selectedIds.size === 0) return;

    confirmAction(
      {
        title: "Delete selected rows?",
        message: `Delete ${selectedIds.size} selected row(s)? This cannot be undone.`,
        confirmText: "Delete",
        cancelText: "Cancel",
      },
      () => {
        const newData = data.filter(d => !selectedIds.has(d.id));
        onUpdate(newData);
        setSelectedIds(new Set());
      }
    );
  };

  // --- Single Row Deletion (works already) ---
  const handleDeleteRow = (id: string) => {
    const newData = data.filter(item => item.id !== id);
    onUpdate(newData);

    if (selectedIds.has(id)) {
      const newSet = new Set(selectedIds);
      newSet.delete(id);
      setSelectedIds(newSet);
    }
  };

  const handleChange = (id: string, field: string, value: string) => {
    const updated = data.map(item => item.id === id ? { ...item, [field]: value } : item);
    onUpdate(updated);
  };

  const handleAddRow = () => {
    const newRow: TimeEntry = {
      id: `manual-${Date.now()}`,
      date: new Date().toLocaleDateString(),
      entrance: '',
      lunchStart: '',
      lunchEnd: '',
      exit: ''
    };
    columnOrder.forEach(col => { if (!(col in newRow)) (newRow as any)[col] = ''; });
    onUpdate([...data, newRow]);
  };

  // ✅ FIX: delete column by KEY (not index)
  const handleDeleteColumnByKey = (keyToDelete: string) => {
    if (!keyToDelete) return;

    const colLabel = getLabel(keyToDelete);

    confirmAction(
      {
        title: `Delete column "${colLabel}"?`,
        message: `This will remove the column and all its data from every row.`,
        confirmText: "Delete Column",
        cancelText: "Cancel",
      },
      () => {
        setColumnOrder(prev => prev.filter(k => k !== keyToDelete));

        const updatedConfigs = configs.filter(c => c.key !== keyToDelete);

        const updatedData = data.map(entry => {
          const newEntry: any = { ...entry };
          delete newEntry[keyToDelete];
          return newEntry;
        });

        onUpdate(updatedData, updatedConfigs);
        setShowColModal(false);
      }
    );
  };

  const openAddColumn = () => {
    setModalConfig({ key: '', name: '', formula: 'none', paramA: '', paramB: '', staticValue: '' });
    setShowColModal(true);
  };

  const openEditColumn = (key: string) => {
    const existing = configs.find(c => c.key === key);
    setModalConfig({
      key: key,
      name: existing?.name || getLabel(key),
      formula: existing?.formula || 'none',
      paramA: existing?.paramA || '',
      paramB: existing?.paramB || '',
      staticValue: existing?.staticValue || ''
    });
    setShowColModal(true);
  };

  const handleSaveColumn = () => {
    const { key, name, formula, paramA, paramB, staticValue } = modalConfig;
    if (!name) return;

    let targetKey = key;
    const isNew = !key;
    if (isNew) targetKey = generateKey(name);

    const newConfig: ColumnConfig = { key: targetKey, name, formula, paramA, paramB, staticValue };
    const updatedConfigs = isNew
      ? [...configs, newConfig]
      : configs.some(c => c.key === key)
        ? configs.map(c => c.key === key ? newConfig : c)
        : [...configs, newConfig];

    if (isNew) setColumnOrder(prev => [...prev, targetKey]);

    const updatedData = isNew
      ? data.map(d => ({ ...d, [targetKey]: '' }))
      : [...data];

    onUpdate(updatedData, updatedConfigs);
    setShowColModal(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950">
      <div className="shrink-0 p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-20">
        <div className="flex flex-wrap gap-3 justify-between items-center max-w-5xl mx-auto">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Review & Edit Data</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSort}
              className="flex items-center px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-sm font-medium border border-slate-200 dark:border-slate-700 transition-colors"
            >
              <ListFilter className="w-4 h-4 mr-2" />
              {sortOrder === 'none' ? 'Sort Date' : sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
              {sortOrder === 'asc' && <ArrowUp className="w-3 h-3 ml-1" />}
              {sortOrder === 'desc' && <ArrowDown className="w-3 h-3 ml-1" />}
            </button>

            {onScanMore && (
              <button
                onClick={onScanMore}
                className="flex items-center px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 text-sm font-medium border border-blue-200 dark:border-blue-800 transition-colors"
              >
                <ScanLine className="w-4 h-4 mr-1" /> Add Page
              </button>
            )}

            <button
              onClick={openAddColumn}
              className="flex items-center px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium border border-slate-200 dark:border-slate-700 transition-colors"
            >
              <LayoutGrid className="w-4 h-4 mr-1" /> Add Column
            </button>

            <button
              onClick={handleAddRow}
              className="flex items-center px-3 py-2 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 text-sm font-medium border border-green-200 dark:border-green-800 transition-colors"
            >
              <Plus className="w-4 h-4 mr-1" /> Add Row
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-slate-50 dark:bg-slate-950 p-4 pb-24 flex flex-col min-h-0">
        <div className="max-w-5xl mx-auto w-full bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col flex-1 min-h-[300px] overflow-hidden">
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
                          <GripHorizontal className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100" />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            {getLabel(key)}
                            {configs.some(c => c.key === key && c.formula !== 'none') && (
                              <Calculator className="w-3 h-3 ml-1 inline text-blue-500" />
                            )}
                          </span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditColumn(key); }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="p-1 rounded hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors text-slate-400 opacity-0 group-hover:opacity-100"
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
                      className={`group transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/50'}`}
                    >
                      <td className="p-2 text-center relative flex items-center justify-center gap-2">
                        <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <button onClick={() => toggleSelection(entry.id)} className="text-blue-600 dark:text-blue-400">
                          {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-slate-300" />}
                        </button>
                      </td>

                      {columnOrder.map(key => {
                        const isCalculated = configs.some(c => c.key === key && c.formula !== 'none');
                        return (
                          <td key={`${entry.id}-${key}`} className="p-2">
                            <input
                              type="text"
                              value={entry[key] || ''}
                              readOnly={isCalculated}
                              onChange={(e) => handleChange(entry.id, key, e.target.value)}
                              className={`w-full bg-transparent border-b border-transparent focus:border-blue-500 rounded-none px-2 py-1.5 text-sm outline-none transition-colors ${isCalculated ? 'text-blue-600 dark:text-blue-400 font-medium cursor-not-allowed' : 'text-slate-900 dark:text-slate-100 hover:border-slate-200 dark:hover:border-slate-700'}`}
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

      {/* Floating Selection Toolbar */}
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
            <button onClick={() => setSelectedIds(new Set())} className="ml-2 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Edit Column Modal */}
      {showColModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                  {modalConfig.key ? 'Edit Column' : 'Add New Column'}
                </h3>
              </div>
              <button onClick={() => setShowColModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-6">
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

              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Apply Data Formula</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'none', label: 'Manual Input', icon: Type },
                    { id: 'diff', label: 'Time Difference', icon: Clock },
                    { id: 'sum', label: 'Sum Total', icon: Plus },
                    { id: 'concat', label: 'Concatenate', icon: ArrowRight },
                    { id: 'static', label: 'Constant Value', icon: Hash },
                    { id: 'increment', label: 'Auto Increment', icon: ArrowDownFromLine },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setModalConfig({ ...modalConfig, formula: opt.id as FormulaType })}
                      className={`flex items-center p-3 rounded-lg border text-xs font-semibold transition-all ${
                        modalConfig.formula === opt.id
                          ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-300'
                      }`}
                      type="button"
                    >
                      <opt.icon className="w-4 h-4 mr-2 opacity-70" /> {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {modalConfig.formula !== 'none' && (
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 animate-fade-in space-y-3">
                  {modalConfig.formula === 'diff' && (
                    <div className="flex items-center gap-2">
                      <SelectColumn label="End Time" value={modalConfig.paramB} options={columnOrder} onChange={(v) => setModalConfig({ ...modalConfig, paramB: v })} />
                      <span className="text-slate-400 pt-5">-</span>
                      <SelectColumn label="Start Time" value={modalConfig.paramA} options={columnOrder} onChange={(v) => setModalConfig({ ...modalConfig, paramA: v })} />
                    </div>
                  )}
                  {modalConfig.formula === 'sum' && (
                    <div className="flex items-center gap-2">
                      <SelectColumn label="Value A" value={modalConfig.paramA} options={columnOrder} onChange={(v) => setModalConfig({ ...modalConfig, paramA: v })} />
                      <span className="text-slate-400 pt-5">+</span>
                      <SelectColumn label="Value B" value={modalConfig.paramB} options={columnOrder} onChange={(v) => setModalConfig({ ...modalConfig, paramB: v })} />
                    </div>
                  )}
                  {modalConfig.formula === 'concat' && (
                    <div className="flex items-center gap-2">
                      <SelectColumn label="Prefix" value={modalConfig.paramA} options={columnOrder} onChange={(v) => setModalConfig({ ...modalConfig, paramA: v })} />
                      <span className="text-slate-400 pt-5">&</span>
                      <SelectColumn label="Suffix" value={modalConfig.paramB} options={columnOrder} onChange={(v) => setModalConfig({ ...modalConfig, paramB: v })} />
                    </div>
                  )}
                  {modalConfig.formula === 'static' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Static Value</label>
                      <input
                        type="text"
                        value={modalConfig.staticValue}
                        onChange={(e) => setModalConfig({ ...modalConfig, staticValue: e.target.value })}
                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm"
                      />
                    </div>
                  )}
                  {modalConfig.formula === 'increment' && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-slate-500 mb-1">Type</label>
                          <select
                            value={modalConfig.paramB}
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
                            value={modalConfig.paramA}
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
                          value={modalConfig.staticValue}
                          onChange={(e) => setModalConfig({ ...modalConfig, staticValue: e.target.value })}
                          placeholder={modalConfig.paramB === 'date' ? "01/01/2024" : "0"}
                          className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm"
                        />
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
                onClick={() => setShowColModal(false)}
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
      )}

      <div className="shrink-0 p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="max-w-4xl mx-auto flex justify-end">
          <button
            onClick={onNext}
            disabled={data.length === 0}
            className="flex items-center justify-center bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all w-full md:w-auto shadow-lg shadow-blue-500/30"
          >
            Proceed to Export <ArrowRight className="w-5 h-5 ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
};

const SelectColumn = ({ label, value, options, onChange }: { label: string, value: string, options: string[], onChange: (v: string) => void }) => (
  <div className="flex-1">
    <label className="block text-xs font-bold text-slate-500 mb-1">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm"
    >
      <option value="">Select...</option>
      {options.map(k => <option key={k} value={k}>{DEFAULT_LABELS[k] || k}</option>)}
    </select>
  </div>
);

export default DataReview;
