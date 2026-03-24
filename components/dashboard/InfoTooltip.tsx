import React, { useState, useRef, useEffect } from 'react';
import { Lightbulb } from 'lucide-react';

export default function InfoTooltip({ text }: { text: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-flex items-center ml-2 align-middle" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); setIsOpen(!isOpen); }}
        className="text-amber-500 hover:text-amber-600 transition-colors focus:outline-none"
        aria-label="More information"
      >
        <Lightbulb className="w-4 h-4" />
      </button>
      {isOpen && (
        <div className="absolute z-50 w-64 p-3 mt-2 text-sm font-normal normal-case bg-slate-800 text-white rounded-lg shadow-xl top-full left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-800" />
          {text}
        </div>
      )}
    </div>
  );
}
