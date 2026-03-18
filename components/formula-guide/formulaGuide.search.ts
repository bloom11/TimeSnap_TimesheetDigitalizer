import guideData from '../../data/formula-guide.json';
import type {
  FlatGuideEntry,
  FormulaGuideContentValue,
  FormulaGuideDocument,
  FormulaGuideExample,
  FormulaGuideNode,
} from './formulaGuide.types';

export const formulaGuideDocument = guideData as FormulaGuideDocument;

export function normalizeLabel(value: string): string {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

export function stringifyContent(content: unknown): string {
  if (content == null) return '';
  if (typeof content === 'string' || typeof content === 'number' || typeof content === 'boolean') {
    return String(content);
  }
  if (Array.isArray(content)) {
    return content.map(stringifyContent).join(' ');
  }
  if (typeof content === 'object') {
    return Object.entries(content as Record<string, unknown>)
      .map(([k, v]) => `${k} ${stringifyContent(v)}`)
      .join(' ');
  }
  return '';
}

export function buildNodeSearchBlob(node: FormulaGuideNode, parentTitle?: string): string {
  return [
    node.title,
    node.name,
    node.signature,
    node.summary,
    parentTitle,
    ...(node.tags || []),
    ...(node.aliases || []),
    ...(node.syntax?.allowed || []),
    ...(node.syntax?.notAllowed || []),
    ...(node.notes || []),
    ...(node.returns || []),
    ...(node.examples || []).flatMap((ex) => [
      ex.label,
      ex.formula,
      ex.resultType || '',
      ex.note || '',
      ...(ex.requires || []),
    ]),
    stringifyContent(node.content),
    node.searchText || '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function buildExampleSearchBlob(
  example: FormulaGuideExample,
  parentTitle?: string,
  groupTitle?: string
): string {
  return [
    example.label,
    example.formula,
    example.resultType || '',
    example.note || '',
    ...(example.requires || []),
    parentTitle || '',
    groupTitle || '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function flattenGuide(doc: FormulaGuideDocument): FlatGuideEntry[] {
  const out: FlatGuideEntry[] = [];

  const visitNode = (node: FormulaGuideNode, parentTitle?: string) => {
    out.push({
      id: node.id,
      title: node.title || node.name || node.id,
      kind: parentTitle ? 'subsection' : 'section',
      summary: node.summary || '',
      searchBlob: buildNodeSearchBlob(node, parentTitle),
      node,
      parentTitle,
    });

    (node.examples || []).forEach((example) => {
      out.push({
        id: example.id,
        title: example.label,
        kind: 'example',
        summary: example.formula,
        searchBlob: buildExampleSearchBlob(example, node.title),
        example,
        parentTitle: node.title,
      });
    });

    [...(node.subsections || [])]
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .forEach((child) => visitNode(child, node.title));

    [...(node.items || [])]
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .forEach((item) => {
        out.push({
          id: item.id,
          title: item.name ? `${item.name} — ${item.signature || item.title || ''}` : item.title,
          kind: 'function',
          summary: item.summary || '',
          searchBlob: buildNodeSearchBlob(item, node.title),
          node: item,
          parentTitle: node.title,
        });

        (item.examples || []).forEach((example) => {
          out.push({
            id: example.id,
            title: example.label,
            kind: 'example',
            summary: example.formula,
            searchBlob: buildExampleSearchBlob(example, item.name || item.title, node.title),
            example,
            parentTitle: item.name || item.title,
            groupTitle: node.title,
          });
        });
      });

    (node.groups || []).forEach((group) => {
      out.push({
        id: group.id,
        title: group.title,
        kind: 'group',
        summary: node.title,
        searchBlob: [
          group.title,
          node.title,
          ...(group.examples || []).flatMap((ex) => [
            ex.label,
            ex.formula,
            ex.resultType || '',
            ex.note || '',
          ]),
        ]
          .join(' ')
          .toLowerCase(),
        parentTitle: node.title,
        groupTitle: group.title,
      });

      (group.examples || []).forEach((example) => {
        out.push({
          id: example.id,
          title: example.label,
          kind: 'example',
          summary: example.formula,
          searchBlob: buildExampleSearchBlob(example, node.title, group.title),
          example,
          parentTitle: node.title,
          groupTitle: group.title,
        });
      });
    });
  };

  [...doc.sections]
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .forEach((section) => visitNode(section));

  return out;
}

export function searchFormulaGuide(
  query: string,
  doc: FormulaGuideDocument = formulaGuideDocument
): FlatGuideEntry[] {
  const q = query.trim().toLowerCase();
  const flat = flattenGuide(doc);
  if (!q) return flat;

  const terms = q.split(/\s+/).filter(Boolean);

  return flat
    .map((entry) => {
      let score = 0;

      for (const term of terms) {
        if (entry.title.toLowerCase().includes(term)) score += 10;
        if (entry.summary.toLowerCase().includes(term)) score += 5;
        if (entry.searchBlob.includes(term)) score += 2;
      }

      if (entry.kind === 'function' && terms.some((t) => entry.title.toLowerCase().startsWith(t))) {
        score += 6;
      }

      return { entry, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
    .map((x) => x.entry);
}