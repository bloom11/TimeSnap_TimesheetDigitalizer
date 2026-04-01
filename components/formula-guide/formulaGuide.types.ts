export type FormulaGuideExample = {
  id: string;
  label: string;
  formula: string;
  resultType?: string;
  note?: string;
  requires?: string[];
};

export interface FormulaGuideContentObject {
  [key: string]: FormulaGuideContentValue;
}
export interface FormulaGuideContentArray extends Array<FormulaGuideContentValue> {}

export type FormulaGuideContentValue =
  | string
  | number
  | boolean
  | null
  | FormulaGuideContentArray
  | FormulaGuideContentObject;

export type FormulaGuideNode = {
  id: string;
  title: string;
  summary?: string;
  tags?: string[];
  aliases?: string[];
  searchText?: string;
  syntax?: {
    allowed?: string[];
    notAllowed?: string[];
  };
  notes?: string[];
  content?: Record<string, FormulaGuideContentValue>;
  examples?: FormulaGuideExample[];
  subsections?: FormulaGuideNode[];
  items?: Array<
    FormulaGuideNode & {
      name?: string;
      signature?: string;
      returns?: string[];
    }
  >;
  groups?: Array<{ id: string; title: string; examples?: FormulaGuideExample[] }>;
  order?: number;
  name?: string;
  signature?: string;
  returns?: string[];
};

export type FormulaGuideDocument = {
  id: string;
  title: string;
  description?: string;
  language?: string;
  lastUpdated?: string;
  searchConfig?: {
    recommendedFields?: string[];
  };
  sections: FormulaGuideNode[];
};

export type FlatGuideEntry = {
  id: string;
  title: string;
  kind: 'section' | 'subsection' | 'function' | 'group' | 'example';
  summary: string;
  searchBlob: string;
  node?: FormulaGuideNode;
  example?: FormulaGuideExample;
  parentTitle?: string;
  groupTitle?: string;
};