import React, { useState } from 'react';
import { Search, ChevronDown, ChevronRight, X } from 'lucide-react';

interface FormulaBuilderProps {
  columns: string[];
  constants?: Record<string, string | number>;
  onInsert: (text: string) => void;
}

const AGGREGATIONS = [
  { label: 'SUM([column])', value: 'SUM([])', desc: 'Sum of all values' },
  { label: 'SUM([col] WHERE [cond])', value: 'SUM([ WHERE ])', desc: 'Sum with condition' },
  { label: 'AVG([column])', value: 'AVG([])', desc: 'Average of all values' },
  { label: 'AVG([col] WHERE [cond])', value: 'AVG([ WHERE ])', desc: 'Avg with condition' },
  { label: 'MIN([column])', value: 'MIN([])', desc: 'Minimum value' },
  { label: 'MIN([col] WHERE [cond])', value: 'MIN([ WHERE ])', desc: 'Min with condition' },
  { label: 'MAX([column])', value: 'MAX([])', desc: 'Maximum value' },
  { label: 'MAX([col] WHERE [cond])', value: 'MAX([ WHERE ])', desc: 'Max with condition' },
  { label: 'COUNT([column])', value: 'COUNT([])', desc: 'Count of entries' },
  { label: 'COUNT([col] WHERE [cond])', value: 'COUNT([ WHERE ])', desc: 'Count with condition' },
];

const LOGIC_FUNCTIONS = [
  { label: 'IF(cond, true, false)', value: 'IF(, , )', desc: 'Conditional logic' },
  { label: 'AND(a, b)', value: 'AND(, )', desc: 'Logical AND' },
  { label: 'OR(a, b)', value: 'OR(, )', desc: 'Logical OR' },
  { label: 'NOT(a)', value: 'NOT()', desc: 'Logical NOT' },
];

const MATH_FUNCTIONS = [
  { label: 'ABS(number)', value: 'ABS()', desc: 'Absolute value' },
  { label: 'MAX(a, b)', value: 'MAX(, )', desc: 'Maximum of two values' },
  { label: 'MIN(a, b)', value: 'MIN(, )', desc: 'Minimum of two values' },
  { label: 'ROUND(number)', value: 'ROUND()', desc: 'Round to nearest integer' },
  { label: 'FLOOR(number)', value: 'FLOOR()', desc: 'Round down' },
  { label: 'CEIL(number)', value: 'CEIL()', desc: 'Round up' },
];

const TYPE_FUNCTIONS = [
  { label: 'NUM(value)', value: 'NUM()', desc: 'Convert to number' },
  { label: 'STRING(value)', value: 'STRING()', desc: 'Convert to string' },
  { label: 'TIME(value, [format])', value: 'TIME(, "")', desc: 'Convert to time' },
  { label: 'HOURS(time)', value: 'HOURS()', desc: 'Get hours from time' },
  { label: 'MINS(time)', value: 'MINS()', desc: 'Get minutes from time' },
];

const OPERATIONS = [
  { label: '+ (Add)', value: ' + ' },
  { label: '- (Subtract)', value: ' - ' },
  { label: '* (Multiply)', value: ' * ' },
  { label: '/ (Divide)', value: ' / ' },
  { label: '( (Open Parenthesis)', value: '(' },
  { label: ') (Close Parenthesis)', value: ')' },
];

export default function FormulaBuilder({ columns, constants = {}, onInsert }: FormulaBuilderProps) {
  const [search, setSearch] = useState('');

  const filteredAggs = AGGREGATIONS.filter(a => a.label.toLowerCase().includes(search.toLowerCase()));
  const filteredLogic = LOGIC_FUNCTIONS.filter(f => f.label.toLowerCase().includes(search.toLowerCase()));
  const filteredMath = MATH_FUNCTIONS.filter(f => f.label.toLowerCase().includes(search.toLowerCase()));
  const filteredType = TYPE_FUNCTIONS.filter(f => f.label.toLowerCase().includes(search.toLowerCase()));
  const filteredCols = columns.filter(c => c.toLowerCase().includes(search.toLowerCase()));
  const filteredOps = OPERATIONS.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
  const filteredConstants = Object.keys(constants).filter(c => c.toLowerCase().includes(search.toLowerCase()));

  const renderCategory = (title: string, items: any[], renderItem: (item: any) => React.ReactNode) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-4">
        <div className="px-2 py-1 mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
          {title}
        </div>
        <div className="space-y-0.5">
          {items.map((item, idx) => renderItem(item))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
      <div className="p-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search formulas, columns..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X className="w-3 h-3 text-slate-400" />
            </button>
          )}
        </div>
      </div>
      <div className="p-2 overflow-y-auto flex-1 custom-scrollbar">
        {renderCategory('Columns', filteredCols, (col) => (
          <button key={col} type="button" onClick={() => onInsert(`[${col}]`)} className="w-full text-left px-2 py-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded text-sm font-mono text-emerald-600 dark:text-emerald-400 transition-colors">
            [{col}]
          </button>
        ))}
        {renderCategory('Constants', filteredConstants, (c) => (
          <button key={c} type="button" onClick={() => onInsert(c)} className="w-full text-left px-2 py-1.5 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded text-sm font-mono text-purple-600 dark:text-purple-400 transition-colors">
            {c}
          </button>
        ))}
        {renderCategory('Aggregations', filteredAggs, (agg) => (
          <button key={agg.label} type="button" onClick={() => onInsert(agg.value)} className="w-full text-left px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded text-sm group transition-colors">
            <div className="font-mono text-blue-600 dark:text-blue-400">{agg.label}</div>
            <div className="text-[10px] text-slate-500">{agg.desc}</div>
          </button>
        ))}
        {renderCategory('Logic Functions', filteredLogic, (f) => (
          <button key={f.label} type="button" onClick={() => onInsert(f.value)} className="w-full text-left px-2 py-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded text-sm group transition-colors">
            <div className="font-mono text-amber-600 dark:text-amber-400">{f.label}</div>
            <div className="text-[10px] text-slate-500">{f.desc}</div>
          </button>
        ))}
        {renderCategory('Math Functions', filteredMath, (f) => (
          <button key={f.label} type="button" onClick={() => onInsert(f.value)} className="w-full text-left px-2 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded text-sm group transition-colors">
            <div className="font-mono text-indigo-600 dark:text-indigo-400">{f.label}</div>
            <div className="text-[10px] text-slate-500">{f.desc}</div>
          </button>
        ))}
        {renderCategory('Type Functions', filteredType, (f) => (
          <button key={f.label} type="button" onClick={() => onInsert(f.value)} className="w-full text-left px-2 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded text-sm group transition-colors">
            <div className="font-mono text-rose-600 dark:text-rose-400">{f.label}</div>
            <div className="text-[10px] text-slate-500">{f.desc}</div>
          </button>
        ))}
        {renderCategory('Operations', filteredOps, (op) => (
          <button key={op.label} type="button" onClick={() => onInsert(op.value)} className="w-full text-left px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-sm font-mono text-slate-700 dark:text-slate-300 transition-colors">
            {op.label}
          </button>
        ))}
      </div>
    </div>
  );
}
