import React, { useMemo, useState } from 'react';
import { BookOpen, Search, X, ChevronRight } from 'lucide-react';
import { formulaGuideDocument, searchFormulaGuide } from './formulaGuide.search';
import { SectionBlock } from './formulaGuide.render';

export * from './formulaGuide.types';
export { searchFormulaGuide } from './formulaGuide.search';

export default function FormulaGuideModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => searchFormulaGuide(query), [query]);
  const topSections = useMemo(
    () => [...formulaGuideDocument.sections].sort((a, b) => (a.order || 0) - (b.order || 0)),
    []
  );

  if (!open) return null;

  const isSearching = query.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl flex flex-col">
        <div className="border-b border-slate-100 dark:border-slate-800 p-5 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xl">
              <BookOpen className="w-6 h-6 text-blue-500" />
              {formulaGuideDocument.title}
            </div>
            {formulaGuideDocument.description && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {formulaGuideDocument.description}
              </p>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        <div className="border-b border-slate-100 dark:border-slate-800 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search syntax, function, example, operator..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-10 pr-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {isSearching ? (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {results.length} result{results.length > 1 ? 's' : ''}
              </div>

              {results.length === 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-500 dark:text-slate-400">
                  No result for <span className="font-mono">{query}</span>
                </div>
              )}

              {results.map((result) => (
                <div
                  key={result.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/30"
                >
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2 flex-wrap">
                    <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-1">{result.kind}</span>
                    {result.parentTitle && (
                      <>
                        <ChevronRight className="w-3 h-3" />
                        <span>{result.parentTitle}</span>
                      </>
                    )}
                    {result.groupTitle && (
                      <>
                        <ChevronRight className="w-3 h-3" />
                        <span>{result.groupTitle}</span>
                      </>
                    )}
                  </div>

                  <div className="text-base font-bold text-slate-900 dark:text-white">{result.title}</div>
                  {result.summary && <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{result.summary}</div>}

                  {result.example && (
                    <div className="mt-3">
                      <code className="block overflow-x-auto rounded bg-white dark:bg-slate-900 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                        {result.example.formula}
                      </code>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              {topSections.map((section) => (
                <div key={section.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                  <div className="mb-4">
                    <div className="text-xl font-bold text-slate-900 dark:text-white">{section.title}</div>
                    {section.summary && <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{section.summary}</div>}
                  </div>
                  <SectionBlock node={section} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}