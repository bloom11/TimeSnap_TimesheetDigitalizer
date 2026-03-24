import React, { useState, useEffect } from 'react';
import { Plus, Settings, LayoutDashboard } from 'lucide-react';
import { DashboardConfig, WidgetConfig, SavedScan, ColumnConfig } from '../types';
import { getDashboardConfig, saveDashboardConfig, getHistory } from '../services/storageService';
import WidgetCard from './dashboard/WidgetCard';
import WidgetEditorModal from './dashboard/WidgetEditorModal';

interface DashboardViewProps {
  onSwitchToScanner: () => void;
  constants: Record<string, string | number>;
  columnConfigs: ColumnConfig[];
}

export default function DashboardView({ onSwitchToScanner, constants, columnConfigs }: DashboardViewProps) {
  const [config, setConfig] = useState<DashboardConfig>({ widgets: [], isDefaultHome: true });
  const [scans, setScans] = useState<SavedScan[]>([]);
  const [editingWidget, setEditingWidget] = useState<WidgetConfig | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    setConfig(getDashboardConfig());
    setScans(getHistory());
  }, []);

  const handleSaveWidget = (widget: WidgetConfig) => {
    const newConfig = { ...config };
    const existingIndex = newConfig.widgets.findIndex(w => w.id === widget.id);
    if (existingIndex >= 0) {
      newConfig.widgets[existingIndex] = widget;
    } else {
      newConfig.widgets.push(widget);
    }
    setConfig(newConfig);
    saveDashboardConfig(newConfig);
  };

  const handleDeleteWidget = (id: string) => {
    const newConfig = { ...config, widgets: config.widgets.filter(w => w.id !== id) };
    setConfig(newConfig);
    saveDashboardConfig(newConfig);
  };

  const handleToggleDefault = () => {
    const newConfig = { ...config, isDefaultHome: !config.isDefaultHome };
    setConfig(newConfig);
    saveDashboardConfig(newConfig);
  };

  return (
    <div className="flex flex-col items-center pt-8 px-4 animate-fade-in w-full max-w-[1600px] mx-auto">
      <div className="flex justify-between items-center w-full mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
          <LayoutDashboard className="w-8 h-8 text-blue-600" /> Dashboard
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`p-2 rounded-lg transition-colors ${isEditMode ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            title="Edit Dashboard"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {isEditMode && (
        <div className="w-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-8 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-100">Dashboard Settings</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">Configure your widgets and default view.</p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.isDefaultHome}
                onChange={handleToggleDefault}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Set as Default Home</span>
            </label>
            <button
              onClick={() => { setEditingWidget(null); setIsModalOpen(true); }}
              className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Widget
            </button>
          </div>
        </div>
      )}

      {config.widgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
            <LayoutDashboard className="w-12 h-12 text-slate-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">Your Dashboard is Empty</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8">
            Add widgets to track your hours, visualize progress, and monitor your timesheets at a glance.
          </p>
          <button
            onClick={() => { setEditingWidget(null); setIsModalOpen(true); }}
            className="flex items-center bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all transform hover:-translate-y-1 shadow-lg shadow-blue-500/30"
          >
            <Plus className="w-5 h-5 mr-2" /> Create First Widget
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
          {config.widgets.map(widget => {
            let scan = null;
            if (widget.scanSourceId === 'latest' && scans.length > 0) {
              scan = scans[0];
            } else {
              scan = scans.find(s => s.id === widget.scanSourceId) || null;
            }

            return (
              <div key={widget.id} className="relative group h-48">
                <WidgetCard
                  config={widget}
                  scan={scan}
                  constants={constants}
                  columnConfigs={columnConfigs}
                  onClick={() => {
                    if (isEditMode) {
                      setEditingWidget(widget);
                      setIsModalOpen(true);
                    }
                  }}
                />
                {isEditMode && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingWidget(widget); setIsModalOpen(true); }}
                      className="p-1.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-md shadow-sm border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-blue-600 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <WidgetEditorModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        config={editingWidget}
        onSave={handleSaveWidget}
        onDelete={handleDeleteWidget}
        scans={scans}
        constants={constants}
      />
    </div>
  );
}
