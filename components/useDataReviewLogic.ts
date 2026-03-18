import { useState, useEffect, useRef, useMemo } from "react";
import { TimeEntry, ColumnConfig, FormulaType } from "../types";

interface UseDataReviewLogicProps {
  data: TimeEntry[];
  configs: ColumnConfig[];
  initialColumnOrder: string[];
  onUpdate: (data: TimeEntry[], configs?: ColumnConfig[], columnOrder?: string[]) => void;
  onRequestConfirm?: (
    cfg: { title: string; message: string; confirmText?: string; cancelText?: string },
    onConfirm: () => void
  ) => void;
  setModalConfig: React.Dispatch<React.SetStateAction<ColumnConfig>>;
  setShowColModal: React.Dispatch<React.SetStateAction<boolean>>;
  modalConfig: ColumnConfig;
}

const DEFAULT_LABELS: { [key: string]: string } = {
  date: "Date",
  entrance: "Entrance",
  lunchStart: "Lunch Start",
  lunchEnd: "Lunch End",
  exit: "Exit",
};

export function useDataReviewLogic({
  data,
  configs,
  initialColumnOrder,
  onUpdate,
  onRequestConfirm,
  setModalConfig,
  setShowColModal,
  modalConfig,
}: UseDataReviewLogicProps) {
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | "none">("none");

  // Drag refs
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const rowDragItem = useRef<number | null>(null);
  const rowDragOverItem = useRef<number | null>(null);

  // confirm helper
  const confirmAction = (
    cfg: { title: string; message: string; confirmText?: string; cancelText?: string },
    action: () => void
  ) => {
    if (onRequestConfirm) {
      onRequestConfirm(cfg, action);
      return;
    }
    if (window.confirm(cfg.message)) action();
  };

  // keep columnOrder in sync with data keys (and initialColumnOrder)
  useEffect(() => {
    if (data.length === 0) {
      setColumnOrder([]);
      return;
    }

    const allKeys = Array.from(
      new Set(data.flatMap((item) => Object.keys(item).filter((k) => k !== "id")))
    ) as string[];

    const standardOrder = ["date", "entrance", "lunchStart", "lunchEnd", "exit"];

    setColumnOrder((prev) => {
      const baseOrder = (initialColumnOrder && initialColumnOrder.length > 0) ? initialColumnOrder : prev;

      if (baseOrder.length === 0) {
        return [
          ...standardOrder.filter((k) => allKeys.includes(k)),
          ...allKeys.filter((k) => !standardOrder.includes(k)),
        ];
      }

      const kept = baseOrder.filter((k) => allKeys.includes(k));
      const missing = allKeys.filter((k) => !kept.includes(k));
      const missingStandard = standardOrder.filter((k) => missing.includes(k));
      const missingOther = missing.filter((k) => !standardOrder.includes(k));
      
      const newOrder = [...kept, ...missingStandard, ...missingOther];
      
      if (newOrder.length === prev.length && newOrder.every((val, index) => val === prev[index])) {
        return prev;
      }
      return newOrder;
    });
  }, [data, initialColumnOrder]);

  const generateKey = (name: string) => {
    let base = name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!base) base = "col";
    let finalKey = base;
    let counter = 1;
    while (columnOrder.includes(finalKey)) {
      finalKey = `${base}${counter}`;
      counter++;
    }
    return finalKey;
  };

  // column reorder via arrows (reorder modal)
  const moveColumn = (index: number, direction: -1 | 1) => {
    const newOrder = [...columnOrder];
    if (index + direction < 0 || index + direction >= newOrder.length) return;
    const tmp = newOrder[index];
    newOrder[index] = newOrder[index + direction];
    newOrder[index + direction] = tmp;
    setColumnOrder(newOrder);
    onUpdate(data, configs, newOrder);
  };

  // drag columns in table header
  const handleColDragStart = (e: React.DragEvent<HTMLTableCellElement>, position: number) => {
    dragItem.current = position;
    e.currentTarget.classList.add("opacity-50", "bg-blue-50");
  };

  const handleColDragEnter = (e: React.DragEvent<HTMLTableCellElement>, position: number) => {
    e.preventDefault();
    dragOverItem.current = position;
  };

  const handleColDragEnd = (e: React.DragEvent<HTMLTableCellElement>) => {
    e.currentTarget.classList.remove("opacity-50", "bg-blue-50");
    if (
      dragItem.current !== null &&
      dragOverItem.current !== null &&
      dragItem.current !== dragOverItem.current
    ) {
      const _order = [...columnOrder];
      const dragged = _order[dragItem.current];
      _order.splice(dragItem.current, 1);
      _order.splice(dragOverItem.current, 0, dragged);
      setColumnOrder(_order);
      onUpdate(data, configs, _order);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // row dragging (group)
  const handleRowDragStart = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    rowDragItem.current = index;
    e.dataTransfer.effectAllowed = "move";
    if (!selectedIds.has(data[index].id)) setSelectedIds(new Set([data[index].id]));
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
        const targetEntry = data[fromIndex];

        if (selectedIds.has(targetEntry.id)) {
          const nonSelected = data.filter((d) => !selectedIds.has(d.id));
          const selected = data.filter((d) => selectedIds.has(d.id));

          const dropTargetId = data[toIndex].id;
          let insertIdx = nonSelected.findIndex((x) => x.id === dropTargetId);

          if (insertIdx === -1) {
            insertIdx = toIndex;
            if (insertIdx > nonSelected.length) insertIdx = nonSelected.length;
          } else {
            if (fromIndex < toIndex) insertIdx++;
          }

          nonSelected.splice(insertIdx, 0, ...selected);
          onUpdate(nonSelected);
        } else {
          const newData = [...data];
          const [removed] = newData.splice(fromIndex, 1);
          newData.splice(toIndex, 0, removed);
          onUpdate(newData);
        }
      }
    }
    rowDragItem.current = null;
    rowDragOverItem.current = null;
  };

  // selection
  const toggleSelection = (id: string) => {
    const s = new Set(selectedIds);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelectedIds(s);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === data.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(data.map((d) => d.id)));
  };

  // sorting (date)
  const parseDateStr = (d: string) => {
    if (!d) return 0;
    const parts = d.replace(/[\.-]/g, "/").split("/");
    if (parts.length !== 3) return 0;
    return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10)).getTime();
  };

  const handleSort = () => {
    const nextOrder = sortOrder === "none" ? "asc" : sortOrder === "asc" ? "desc" : "none";
    setSortOrder(nextOrder);

    if (nextOrder === "none") {
      const sorted = [...data].sort((a, b) => a.id.localeCompare(b.id));
      onUpdate(sorted);
    } else {
      const sorted = [...data].sort((a, b) => {
        const tA = parseDateStr(a.date);
        const tB = parseDateStr(b.date);
        return nextOrder === "asc" ? tA - tB : tB - tA;
      });
      onUpdate(sorted);
    }
  };

  // group move (toolbar)
  const moveSelected = (direction: -1 | 1) => {
    if (selectedIds.size === 0) return;

    const indices = data
      .map((item, idx) => ({ item, idx }))
      .filter((p) => selectedIds.has(p.item.id))
      .map((p) => p.idx)
      .sort((a, b) => (direction === -1 ? a - b : b - a));

    let newData = [...data];
    let canMove = true;

    for (const idx of indices) {
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= newData.length) {
        canMove = false;
        break;
      }
      const tmp = newData[newIdx];
      newData[newIdx] = newData[idx];
      newData[idx] = tmp;
    }

    if (canMove) onUpdate(newData);
  };

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
        const newData = data.filter((d) => !selectedIds.has(d.id));
        onUpdate(newData);
        setSelectedIds(new Set());
      }
    );
  };

  // row edit
  const handleDeleteRow = (id: string) => {
    const newData = data.filter((item) => item.id !== id);
    onUpdate(newData);

    if (selectedIds.has(id)) {
      const s = new Set(selectedIds);
      s.delete(id);
      setSelectedIds(s);
    }
  };

  const handleChange = (id: string, field: string, value: string) => {
    const updated = data.map((item) => (item.id === id ? { ...item, [field]: value } : item));
    onUpdate(updated);
  };

  const handleAddRow = () => {
    const newRow: TimeEntry = {
      id: `manual-${Date.now()}`,
      date: new Date().toLocaleDateString(),
      entrance: "",
      lunchStart: "",
      lunchEnd: "",
      exit: "",
    };
    columnOrder.forEach((col) => {
      if (!(col in newRow)) (newRow as any)[col] = "";
    });
    onUpdate([...data, newRow]);
  };

  const isCalculatedColumn = useMemo(() => {
    const map = new Map<string, ColumnConfig>();
    configs.forEach((c) => map.set(c.key, c));
    return (key: string) => {
      const c = map.get(key);
      return !!c && c.formula !== "none";
    };
  }, [configs]);

  const getLabel = (key: string) => {
    const cfg = configs.find((c) => c.key === key);
    if (cfg?.name) return cfg.name;
    if (DEFAULT_LABELS[key]) return DEFAULT_LABELS[key];
    return key.replace(/([A-Z])/g, " $1").replace(/(\d+)/g, "").trim();
  };

  // delete column by key
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
        const newOrder = columnOrder.filter((k) => k !== keyToDelete);
        setColumnOrder(newOrder);

        const updatedConfigs = configs.filter((c) => c.key !== keyToDelete);

        const updatedData = data.map((entry) => {
          const newEntry: any = { ...entry };
          delete newEntry[keyToDelete];
          return newEntry;
        });

        onUpdate(updatedData, updatedConfigs, newOrder);
        setShowColModal(false);
      }
    );
  };

  // open column modal
  const openAddColumn = () => {
    setModalConfig({
      key: "",
      name: "",
      formula: "none",
      paramA: "",
      paramB: "",
      staticValue: "",
      complexFormula: "",
      timeSeparator: ":",
      timeFormat: "24h",
      keepEmptyIfNegative: false,
      defaultTextColor: undefined,
    });
    setShowColModal(true);
  };

  const openEditColumn = (key: string) => {
    const existing = configs.find((c) => c.key === key);
    setModalConfig({
      key,
      name: existing?.name || getLabel(key),
      formula: (existing?.formula || "none") as FormulaType,
      paramA: existing?.paramA || "",
      paramB: existing?.paramB || "",
      staticValue: existing?.staticValue || "",
      complexFormula: existing?.complexFormula || "",
      timeSeparator: existing?.timeSeparator || ":",
      timeFormat: existing?.timeFormat || "24h",
      keepEmptyIfNegative: existing?.keepEmptyIfNegative || false,
      defaultTextColor: existing?.defaultTextColor,
    });
    setShowColModal(true);
  };

  const handleSaveColumn = () => {
    if (!modalConfig.name) return;

    const isNew = !modalConfig.key;
    const targetKey = isNew ? generateKey(modalConfig.name) : modalConfig.key;

    const newConfig: ColumnConfig = {
      key: targetKey,
      name: modalConfig.name,
      formula: modalConfig.formula,
      paramA: modalConfig.paramA || "",
      paramB: modalConfig.paramB || "",
      staticValue: modalConfig.staticValue || "",
      complexFormula: modalConfig.complexFormula || "",
      timeSeparator: (modalConfig.timeSeparator || ":").slice(0, 1),
      timeFormat: modalConfig.timeFormat || "24h",
      keepEmptyIfNegative: !!modalConfig.keepEmptyIfNegative,
      defaultTextColor: modalConfig.defaultTextColor,
    };

    const updatedConfigs = isNew
      ? [...configs, newConfig]
      : configs.some((c) => c.key === modalConfig.key)
      ? configs.map((c) => (c.key === modalConfig.key ? newConfig : c))
      : [...configs, newConfig];

    const updatedData = isNew ? data.map((d) => ({ ...d, [targetKey]: "" })) : [...data];

    if (isNew) {
      const newOrder = [...columnOrder, targetKey];
      setColumnOrder(newOrder);
      onUpdate(updatedData, updatedConfigs, newOrder);
    } else {
      onUpdate(updatedData, updatedConfigs, columnOrder);
    }

    setShowColModal(false);
  };

  // formula insert helpers
  const appendToComplex = (text: string) => {
    setModalConfig((prev) => ({ ...prev, complexFormula: (prev.complexFormula || "") + text }));
  };

  return {
    columnOrder,
    setColumnOrder,
    selectedIds,
    setSelectedIds,
    sortOrder,
    generateKey,
    moveColumn,
    handleColDragStart,
    handleColDragEnter,
    handleColDragEnd,
    handleRowDragStart,
    handleRowDragEnter,
    handleRowDragEnd,
    toggleSelection,
    toggleSelectAll,
    handleSort,
    moveSelected,
    deleteSelected,
    handleDeleteRow,
    handleChange,
    handleAddRow,
    isCalculatedColumn,
    confirmAction,
    handleDeleteColumnByKey,
    openAddColumn,
    openEditColumn,
    handleSaveColumn,
    getLabel,
    appendToComplex,
  };
}
