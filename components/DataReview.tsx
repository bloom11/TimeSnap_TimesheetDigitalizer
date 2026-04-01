// components/DataReview.tsx
import React, { useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Menu, X, Grip } from "lucide-react";

import { TimeEntry, ColumnConfig, FormulaType } from "../types";
import FormulaGuideModal from "./formula-guide/FormulaGuideModal";
import ConstantsModal from "./ConstantsModal";
import TableProfileManager from "./TableProfileManager";
import ReorderColumnsModal from "./ReorderColumnsModal";
import ColumnConfigModal from "./ColumnConfigModal";
import DataReviewToolbar from "./DataReviewToolbar";
import DataReviewTable from "./DataReviewTable";
import { useDataReviewLogic } from "./useDataReviewLogic";
import { useMediaQuery } from "../hooks/useMediaQuery";
import DraggableMenu from "./DraggableMenu";
import { autoFillWeekends, removeEmptyWeekends } from "../utils/autoFillLogic";
import AutoOptionsModal from "./AutoOptionsModal";
import { getSettings, saveSettings } from "../services/settingsService";

interface DataReviewProps {
  data: TimeEntry[];
  configs: ColumnConfig[];
  constants: Record<string, string | number>;

  initialColumnOrder: string[];

  // Main update (data/configs/order)
  onUpdate: (
    data: TimeEntry[], 
    configs?: ColumnConfig[], 
    columnOrder?: string[],
    constants?: Record<string, string | number>
  ) => void;

  // Dedicated constants update
  onUpdateConstants: (constants: Record<string, string | number>) => void;

  onNext: () => void;
  onScanMore?: () => void;

  // reuse App confirm modal (optional)
  onRequestConfirm?: (
    cfg: { title: string; message: string; confirmText?: string; cancelText?: string },
    onConfirm: () => void
  ) => void;
}

const DEFAULT_LABELS: { [key: string]: string } = {
  date: "Date",
  entrance: "Entrance",
  lunchStart: "Lunch Start",
  lunchEnd: "Lunch End",
  exit: "Exit",
};

const DEFAULT_COLORS = ["#0f172a", "#dc2626", "#16a34a", "#2563eb", "#d97706", "#7c3aed"];

const DataReview: React.FC<DataReviewProps> = ({
  data,
  configs,
  constants,
  initialColumnOrder,
  onUpdate,
  onUpdateConstants,
  onNext,
  onScanMore,
  onRequestConfirm,
}) => {
  const [showColModal, setShowColModal] = useState(false);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [showConstantsModal, setShowConstantsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showFormulaGuide, setShowFormulaGuide] = useState(false);

  const [modalConfig, setModalConfig] = useState<ColumnConfig>({
    key: "",
    name: "",
    formula: "none",
    paramA: "",
    paramB: "",
    staticValue: "",
    complexFormula: "",
    timeSeparator: ":",
    keepEmptyIfNegative: false,
    defaultTextColor: undefined,
  });

  const {
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
  } = useDataReviewLogic({
    data,
    configs,
    initialColumnOrder,
    onUpdate,
    onRequestConfirm,
    setModalConfig,
    setShowColModal,
    modalConfig,
  });

  const isLandscape = useMediaQuery("(orientation: landscape) and (max-height: 600px)");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDraggableMode, setIsDraggableMode] = useState(false);
  const [showAutoOptionsModal, setShowAutoOptionsModal] = useState(false);
  const [includeBoundaries, setIncludeBoundaries] = useState(() => getSettings().autoFillMonthBoundaries);

  const handleIncludeBoundariesChange = (val: boolean) => {
    setIncludeBoundaries(val);
    const settings = getSettings();
    saveSettings({ ...settings, autoFillMonthBoundaries: val });
  };

  const handleAutoFillWeekends = (boundaries: boolean) => {
    const newData = autoFillWeekends(data, boundaries);
    onUpdate(newData, configs, columnOrder, constants);
  };

  const handleRemoveEmptyWeekends = () => {
    const newData = removeEmptyWeekends(data, configs);
    onUpdate(newData, configs, columnOrder, constants);
  };

  const headerPortalTarget = document.getElementById("header-actions-portal");

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950">
      {/* Formula Guide Modal */}
      <FormulaGuideModal open={showFormulaGuide} onClose={() => setShowFormulaGuide(false)} />

      {/* Table Profile Modal */}
      <TableProfileManager
        open={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        currentConfigs={configs}
        currentOrder={columnOrder}
        currentConstants={constants}
        onRequestConfirm={onRequestConfirm}
        onApplyProfile={(newConfigs, newOrder, newConstants) => {
          onUpdate(data, newConfigs, newOrder, newConstants);
        }}
      />

      {/* Constants Modal */}
      <ConstantsModal
        open={showConstantsModal}
        onClose={() => setShowConstantsModal(false)}
        constants={constants}
        onUpdateConstants={onUpdateConstants}
      />

      {/* Auto Options Modal */}
      <AutoOptionsModal
        open={showAutoOptionsModal}
        onClose={() => setShowAutoOptionsModal(false)}
        onAutoFillWeekends={handleAutoFillWeekends}
        onRemoveEmptyWeekends={handleRemoveEmptyWeekends}
        includeBoundaries={includeBoundaries}
        onIncludeBoundariesChange={handleIncludeBoundariesChange}
      />

      {/* Top bar */}
      {!isLandscape && (
        <DataReviewToolbar
          sortOrder={sortOrder}
          onSort={handleSort}
          onScanMore={onScanMore}
          onOpenProfiles={() => setShowProfileModal(true)}
          onOpenConstants={() => setShowConstantsModal(true)}
          onAddColumn={openAddColumn}
          onReorderColumns={() => setShowReorderModal(true)}
          onAddRow={handleAddRow}
          onOpenAutoOptions={() => setShowAutoOptionsModal(true)}
        />
      )}

      {/* Header Portal for Landscape */}
      {isLandscape && headerPortalTarget && createPortal(
        <div className="flex items-center gap-2">
          <button
            onClick={onNext}
            disabled={data.length === 0}
            className="flex items-center justify-center bg-blue-600 text-white px-3 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all text-sm shadow-sm"
          >
            Export <ArrowRight className="w-4 h-4 ml-1" />
          </button>
          {!isDraggableMode && (
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
        </div>,
        headerPortalTarget
      )}

      {/* Landscape Drawer */}
      {isLandscape && !isDraggableMode && (
        <>
          {/* Backdrop */}
          {isDrawerOpen && (
            <div 
              className="fixed inset-0 bg-black/50 z-[60]" 
              onClick={() => setIsDrawerOpen(false)} 
            />
          )}
          {/* Drawer */}
          <div className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-slate-900 z-[70] shadow-2xl transform transition-transform duration-300 ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <span className="font-semibold text-slate-800 dark:text-white">Actions</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setIsDraggableMode(true);
                    setIsDrawerOpen(false);
                  }}
                  className="p-2 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                  title="Enable Draggable Mode"
                >
                  <Grip className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-2 overflow-y-auto h-[calc(100%-60px)]">
              <DataReviewToolbar
                sortOrder={sortOrder}
                onSort={handleSort}
                onScanMore={onScanMore}
                onOpenProfiles={() => { setShowProfileModal(true); setIsDrawerOpen(false); }}
                onOpenConstants={() => { setShowConstantsModal(true); setIsDrawerOpen(false); }}
                onAddColumn={() => { openAddColumn(); setIsDrawerOpen(false); }}
                onReorderColumns={() => { setShowReorderModal(true); setIsDrawerOpen(false); }}
                onAddRow={() => { handleAddRow(); setIsDrawerOpen(false); }}
                onOpenAutoOptions={() => { setShowAutoOptionsModal(true); setIsDrawerOpen(false); }}
                isVertical
              />
            </div>
          </div>
        </>
      )}

      {/* Landscape Draggable Mode */}
      {isLandscape && isDraggableMode && (
        <DraggableMenu
          icon={<Menu className="w-6 h-6" />}
          onDisableDraggable={() => setIsDraggableMode(false)}
        >
          <DataReviewToolbar
            sortOrder={sortOrder}
            onSort={handleSort}
            onScanMore={onScanMore}
            onOpenProfiles={() => setShowProfileModal(true)}
            onOpenConstants={() => setShowConstantsModal(true)}
            onAddColumn={openAddColumn}
            onReorderColumns={() => setShowReorderModal(true)}
            onAddRow={handleAddRow}
            onOpenAutoOptions={() => setShowAutoOptionsModal(true)}
            isVertical
          />
        </DraggableMenu>
      )}

      {/* table */}
      <DataReviewTable
        data={data}
        configs={configs}
        columnOrder={columnOrder}
        selectedIds={selectedIds}
        getLabel={getLabel}
        isCalculatedColumn={isCalculatedColumn}
        toggleSelectAll={toggleSelectAll}
        toggleSelection={toggleSelection}
        handleColDragStart={handleColDragStart}
        handleColDragEnter={handleColDragEnter}
        handleColDragEnd={handleColDragEnd}
        handleRowDragStart={handleRowDragStart}
        handleRowDragEnter={handleRowDragEnter}
        handleRowDragEnd={handleRowDragEnd}
        openEditColumn={openEditColumn}
        handleChange={handleChange}
        handleDeleteRow={handleDeleteRow}
        moveSelected={moveSelected}
        deleteSelected={deleteSelected}
        setSelectedIds={setSelectedIds}
      />

      {/* Edit Column Modal */}
      <ColumnConfigModal
        open={showColModal}
        onClose={() => setShowColModal(false)}
        modalConfig={modalConfig}
        setModalConfig={setModalConfig}
        columnOrder={columnOrder}
        constants={constants}
        setShowFormulaGuide={setShowFormulaGuide}
        handleDeleteColumnByKey={handleDeleteColumnByKey}
        handleSaveColumn={handleSaveColumn}
      />

      {/* Reorder Columns Modal */}
      <ReorderColumnsModal
        open={showReorderModal}
        onClose={() => setShowReorderModal(false)}
        columnOrder={columnOrder}
        getLabel={getLabel}
        moveColumn={moveColumn}
      />

      {/* footer */}
      {!isLandscape && (
        <div className="shrink-0 p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          <div className="max-w-[1600px] mx-auto flex justify-end">
            <button
              onClick={onNext}
              disabled={data.length === 0}
              className="flex items-center justify-center bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all w-full md:w-auto shadow-lg shadow-blue-500/30"
            >
              Proceed to Export <ArrowRight className="w-5 h-5 ml-2" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataReview;