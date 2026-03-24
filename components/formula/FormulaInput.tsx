import React, { useState } from 'react';

interface FormulaInputProps {
  value: string;
  onChange: (val: string) => void;
  onFocus: () => void;
  columns: string[];
  placeholder?: string;
  inputRef: React.RefObject<HTMLTextAreaElement>;
}

const AGGREGATIONS = ['SUM', 'AVG', 'MIN', 'MAX', 'COUNT'];
const LOGIC_FUNCTIONS = ['IF', 'AND', 'OR', 'NOT'];
const MATH_FUNCTIONS = ['ABS', 'MAX', 'MIN', 'ROUND', 'FLOOR', 'CEIL'];
const TYPE_FUNCTIONS = ['NUM', 'STRING', 'TIME', 'HOURS', 'MINS'];

const ALL_FUNCTIONS = [...AGGREGATIONS, ...LOGIC_FUNCTIONS, ...MATH_FUNCTIONS, ...TYPE_FUNCTIONS];

const FUNCTION_SIGNATURES: Record<string, string> = {
  IF: 'IF(, , )',
  AND: 'AND(, )',
  OR: 'OR(, )',
  NOT: 'NOT()',
  ABS: 'ABS()',
  MAX: 'MAX(, )',
  MIN: 'MIN(, )',
  ROUND: 'ROUND()',
  FLOOR: 'FLOOR()',
  CEIL: 'CEIL()',
  NUM: 'NUM()',
  STRING: 'STRING()',
  TIME: 'TIME(, "")',
  HOURS: 'HOURS()',
  MINS: 'MINS()',
};

export default function FormulaInput({ value, onChange, onFocus, columns, placeholder, inputRef }: FormulaInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionPrefix, setSuggestionPrefix] = useState('');
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const updateSuggestions = () => {
    if (!inputRef.current) return;
    const cursor = inputRef.current.selectionStart;
    const textBeforeCursor = value.substring(0, cursor);
    
    // Match column start: `[` followed by anything except `]`
    const colMatch = textBeforeCursor.match(/\[([^\]]*)$/);
    if (colMatch) {
      const search = colMatch[1].toLowerCase();
      const matches = columns.filter(c => c.toLowerCase().includes(search));
      setSuggestions(matches.map(m => `[${m}]`));
      setSuggestionPrefix(`[${colMatch[1]}`);
      setShowSuggestions(matches.length > 0);
      setSuggestionIndex(0);
      return;
    }

    // Match function start: uppercase letters
    const funcMatch = textBeforeCursor.match(/([A-Z]+)$/i);
    if (funcMatch) {
      const search = funcMatch[1].toUpperCase();
      const matches = ALL_FUNCTIONS.filter(f => f.startsWith(search));
      setSuggestions(matches.map(m => {
        if (AGGREGATIONS.includes(m)) return `${m}([])`;
        return FUNCTION_SIGNATURES[m] || `${m}()`;
      }));
      setSuggestionPrefix(funcMatch[1]);
      setShowSuggestions(matches.length > 0);
      setSuggestionIndex(0);
      return;
    }

    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggestionIndex(i => (i + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggestionIndex(i => (i - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertSuggestion(suggestions[suggestionIndex]);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    }
  };

  const insertSuggestion = (suggestion: string) => {
    if (!inputRef.current) return;
    const cursor = inputRef.current.selectionStart;
    const textBeforeCursor = value.substring(0, cursor);
    const textAfterCursor = value.substring(cursor);
    
    // Remove the prefix that triggered the suggestion
    const newTextBefore = textBeforeCursor.substring(0, textBeforeCursor.length - suggestionPrefix.length);
    
    const newValue = newTextBefore + suggestion + textAfterCursor;
    onChange(newValue);
    setShowSuggestions(false);
    
    // Restore cursor
    let finalCursorPos = newTextBefore.length + suggestion.length;
    
    // Smart cursor positioning for functions
    if (suggestion.endsWith("([])")) finalCursorPos -= 2;
    else if (suggestion.endsWith("(, , )")) finalCursorPos -= 6;
    else if (suggestion.endsWith("(, )")) finalCursorPos -= 3;
    else if (suggestion.endsWith("(, \"\")")) finalCursorPos -= 5;
    else if (suggestion.endsWith("()")) finalCursorPos -= 1;
    
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(finalCursorPos, finalCursorPos);
      }
    }, 0);
  };

  return (
    <div className="relative">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          updateSuggestions();
        }}
        onFocus={onFocus}
        onKeyUp={updateSuggestions}
        onClick={updateSuggestions}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full p-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm resize-y min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
          {suggestions.map((sug, idx) => (
            <div
              key={sug}
              onClick={() => insertSuggestion(sug)}
              className={`px-3 py-2 cursor-pointer text-sm font-mono ${idx === suggestionIndex ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
            >
              {sug}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
