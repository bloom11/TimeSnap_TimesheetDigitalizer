import React from 'react';
import type {
  FormulaGuideContentValue,
  FormulaGuideExample,
  FormulaGuideNode,
} from './formulaGuide.types';
import { normalizeLabel } from './formulaGuide.search';

export function ContentValueBlock({ value }: { value: FormulaGuideContentValue }) {
  if (value == null) return null;

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{String(value)}</div>;
  }

  if (Array.isArray(value)) {
    const allPrimitive = value.every(
      (item) =>
        item == null ||
        typeof item === 'string' ||
        typeof item === 'number' ||
        typeof item === 'boolean'
    );

    if (allPrimitive) {
      return (
        <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
          {value.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {String(item)}
            </li>
          ))}
        </ul>
      );
    }

    return (
      <div className="space-y-3">
        {value.map((item, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 p-3"
          >
            <ContentValueBlock value={item} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {Object.entries(value).map(([k, v]) => (
        <div key={k} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 p-3">
          <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            {normalizeLabel(k)}
          </div>
          <ContentValueBlock value={v} />
        </div>
      ))}
    </div>
  );
}

export function ExampleList({ title, examples }: { title?: string; examples: FormulaGuideExample[] }) {
  if (!examples.length) return null;

  return (
    <div className="space-y-3">
      {title && <div className="text-base font-bold text-slate-900 dark:text-white">{title}</div>}
      {examples.map((example) => (
        <div
          key={example.id}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3"
        >
          <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{example.label}</div>
          <code className="block overflow-x-auto rounded bg-white dark:bg-slate-900 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
            {example.formula}
          </code>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            {example.resultType && (
              <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-1 text-slate-700 dark:text-slate-200">
                {example.resultType}
              </span>
            )}
            {(example.requires || []).map((req) => (
              <span
                key={req}
                className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-1 text-amber-700 dark:text-amber-300"
              >
                {req}
              </span>
            ))}
          </div>
          {example.note && <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{example.note}</div>}
        </div>
      ))}
    </div>
  );
}

export function SectionBlock({ node }: { node: FormulaGuideNode }) {
  return (
    <div className="space-y-4">
      {node.summary && <p className="text-sm text-slate-600 dark:text-slate-300">{node.summary}</p>}

      {node.signature && (
        <div className="font-mono text-xs text-blue-600 dark:text-blue-300">{node.signature}</div>
      )}

      {node.returns?.length ? (
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Returns: {node.returns.join(', ')}
        </div>
      ) : null}

      {node.content && (
        <div className="space-y-3">
          {Object.entries(node.content).map(([key, value]) => (
            <div
              key={key}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3"
            >
              <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {normalizeLabel(key)}
              </div>
              <ContentValueBlock value={value} />
            </div>
          ))}
        </div>
      )}

      {node.syntax && (
        <div className="grid gap-3 md:grid-cols-2">
          {(node.syntax.allowed?.length || 0) > 0 && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-3">
              <div className="mb-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">Allowed</div>
              <div className="flex flex-wrap gap-2">
                {node.syntax.allowed!.map((item) => (
                  <code
                    key={item}
                    className="rounded bg-white/80 dark:bg-slate-900 px-2 py-1 text-xs text-slate-800 dark:text-slate-100"
                  >
                    {item}
                  </code>
                ))}
              </div>
            </div>
          )}

          {(node.syntax.notAllowed?.length || 0) > 0 && (
            <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3">
              <div className="mb-2 text-sm font-semibold text-red-700 dark:text-red-300">Not allowed</div>
              <div className="flex flex-wrap gap-2">
                {node.syntax.notAllowed!.map((item) => (
                  <code
                    key={item}
                    className="rounded bg-white/80 dark:bg-slate-900 px-2 py-1 text-xs text-slate-800 dark:text-slate-100"
                  >
                    {item}
                  </code>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {(node.notes || []).length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notes</div>
          <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
            {node.notes!.map((note, idx) => (
              <li key={idx}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {(node.examples || []).length > 0 && <ExampleList title="Examples" examples={node.examples!} />}

      {(node.items || []).length > 0 && (
        <div className="space-y-4">
          <div className="text-base font-bold text-slate-900 dark:text-white">Functions</div>
          {node.items!.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
              <div>
                <div className="text-base font-bold text-slate-900 dark:text-white">{item.name || item.title}</div>
                {item.signature && (
                  <div className="mt-1 font-mono text-xs text-blue-600 dark:text-blue-300">{item.signature}</div>
                )}
                {item.summary && <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.summary}</div>}
              </div>

              {item.returns?.length ? (
                <div className="text-xs text-slate-500 dark:text-slate-400">Returns: {item.returns.join(', ')}</div>
              ) : null}

              <SectionBlock node={item} />
            </div>
          ))}
        </div>
      )}

      {(node.groups || []).length > 0 && (
        <div className="space-y-4">
          <div className="text-base font-bold text-slate-900 dark:text-white">Examples by topic</div>
          {node.groups!.map((group) => (
            <div key={group.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{group.title}</div>
              <ExampleList examples={group.examples || []} />
            </div>
          ))}
        </div>
      )}

      {(node.subsections || []).length > 0 && (
        <div className="space-y-6">
          {[...(node.subsections || [])]
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map((child) => (
              <div key={child.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="mb-3 text-base font-bold text-slate-900 dark:text-white">{child.title}</div>
                <SectionBlock node={child} />
              </div>
            ))}
        </div>
      )}
    </div>
  );
}