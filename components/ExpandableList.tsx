import React from 'react';
import { Check, ChevronDown } from 'lucide-react';

interface ExpandableListProps {
    title: string;
    icon: React.ReactNode;
    items: any[];
    selectedIds: Set<string>;
    onToggle: (id: string) => void;
    onSelectAll: () => void;
    onDeselectAll: () => void;
    renderItem: (item: any) => React.ReactNode;
    getId: (item: any) => string;
    isExpanded: boolean;
    onToggleExpand: () => void;
}

export const ExpandableList = ({ 
    title, icon, items, selectedIds, onToggle, onSelectAll, onDeselectAll, renderItem, getId, isExpanded, onToggleExpand 
}: ExpandableListProps) => {
    return (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800">
            <div 
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                onClick={onToggleExpand}
            >
                <div className="flex items-center gap-3">
                    {icon}
                    <span className="font-medium text-slate-700 dark:text-slate-300">{title}</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full shadow-sm text-sm">
                        {selectedIds.size} / {items.length}
                    </span>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </div>
            
            {isExpanded && (
                <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3">
                    <div className="flex justify-between items-center mb-3 px-2">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Select items</span>
                        <div className="flex gap-2">
                            <button onClick={(e) => { e.stopPropagation(); onSelectAll(); }} className="text-xs text-blue-600 hover:underline font-medium">All</button>
                            <span className="text-slate-300">|</span>
                            <button onClick={(e) => { e.stopPropagation(); onDeselectAll(); }} className="text-xs text-slate-500 hover:underline font-medium">None</button>
                        </div>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                        {items.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-4">No items available</p>
                        ) : (
                            items.map(item => {
                                const id = getId(item);
                                const isSelected = selectedIds.has(id);
                                return (
                                    <div 
                                        key={id}
                                        onClick={(e) => { e.stopPropagation(); onToggle(id); }}
                                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors border ${isSelected ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700 hover:border-blue-300'}`}
                                    >
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                                            {isSelected && <Check className="w-3.5 h-3.5" />}
                                        </div>
                                        <div className="flex-1 min-w-0 text-sm text-slate-700 dark:text-slate-300 truncate">
                                            {renderItem(item)}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
