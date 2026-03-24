import { SavedScan, TimeEntry, WidgetConfig, ColumnConfig } from "../types";
import { parseCellValue, formatTime } from "./formulaEngine";

export interface WidgetEvaluationResult {
  value: number;
  formattedValue: string;
  targetValue?: number;
  formattedTarget?: string;
  percentage?: number;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Parses a date string into a JS Date object.
 * Handles common formats like YYYY-MM-DD or MM/DD/YYYY.
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Checks if a date falls within the specified time filter.
 */
function isDateInFilter(date: Date, filter: string): boolean {
  if (filter === 'all') return true;
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Get Monday of current week
  const dayOfWeek = today.getDay(); // 0 is Sunday
  const diffToMonday = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const thisMonday = new Date(today.setDate(diffToMonday));
  
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  if (filter === 'this_week') {
    return date >= thisMonday;
  }
  if (filter === 'last_week') {
    return date >= lastMonday && date < thisMonday;
  }
  if (filter === 'this_month') {
    return date >= thisMonthStart;
  }
  
  return true; // Fallback for 'custom' or unknown
}

function getColumnSeparator(colKey: string, allConfigs: ColumnConfig[], fallback = ":"): string {
  const cfg = allConfigs.find((c) => c.key === colKey);
  return cfg?.timeSeparator || fallback;
}

/**
 * Evaluates an aggregation token like SUM([total_hours]) over a set of entries.
 */
function evaluateAggregation(op: string, colKey: string, entries: TimeEntry[], allConfigs: ColumnConfig[]): number {
  const operation = op.toUpperCase();
  const timeSep = getColumnSeparator(colKey, allConfigs, ":");

  let values: number[] = [];

  for (const entry of entries) {
    const rawVal = entry[colKey];
    if (rawVal !== undefined && rawVal !== null && rawVal !== "") {
      const num = parseCellValue(String(rawVal), timeSep);
      if (!isNaN(num)) {
        values.push(num);
      }
    }
  }

  if (values.length === 0) return 0;

  switch (operation) {
    case 'SUM':
      return values.reduce((a, b) => a + b, 0);
    case 'AVG':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'MIN':
      return Math.min(...values);
    case 'MAX':
      return Math.max(...values);
    case 'COUNT':
      return values.length;
    default:
      return 0;
  }
}

/**
 * Replaces aggregation tokens in a formula string with their evaluated numbers.
 */
function processFormula(formula: string, entries: TimeEntry[], constants: Record<string, string | number>, allConfigs: ColumnConfig[]): string {
  if (!formula) return "";
  
  let expr = formula;

  // 1) Replace all tokens like SUM([col]), AVG([col]), etc.
  const regex = /(SUM|AVG|MIN|MAX|COUNT)\s*\(\s*\[([^\]]+)\]\]?\s*\)/gi;
  expr = expr.replace(regex, (match, op, colKey) => {
    const val = evaluateAggregation(op, colKey, entries, allConfigs);
    return isNaN(val) ? "0" : val.toString();
  });

  // 2) Replace constants (word-boundary)
  for (const [k, v] of Object.entries(constants)) {
    const replacement = typeof v === "number" ? String(v) : `"${String(v).replace(/"/g, '\\"')}"`;
    expr = expr.replace(new RegExp(`\\b${escapeRegExp(k)}\\b`, "g"), replacement);
  }

  return expr;
}

/**
 * Safely evaluates a math expression using the robust sandbox.
 */
function evaluateMath(expr: string): { value: number, stringVal?: string } {
  if (!expr) return { value: 0 };

  try {
    // Sanitize
    const sanitized = expr.replace(/[^0-9a-zA-Z_\s+\-*/().,?:><=!&|'"[\]:]/g, "");

    // Whitelist identifiers
    const allowed = new Set([
      "IF", "ABS", "MAX", "MIN", "ROUND", "FLOOR", "CEIL",
      "AND", "OR", "NOT", "NUM", "STRING", "TIME", "HOURS", "MINS",
      "true", "false",
    ]);

    const withoutStrings = sanitized.replace(/"[^"]*"|'[^']*'/g, "");
    const words = withoutStrings.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
    for (const w of words) {
      if (!allowed.has(w)) return { value: 0 };
    }

    const context = { 
      outputFormat: "NUMBER" as "NUMBER" | "STRING" | "TIME",
      customFormat: undefined as string | undefined
    };

    const fn = new Function(
      "IF", "ABS", "MAX", "MIN", "ROUND", "FLOOR", "CEIL",
      "AND", "OR", "NOT", "NUM", "STRING", "TIME", "HOURS", "MINS", "FORMAT_TIME",
      `return (${sanitized});`
    );

    const result = fn(
      (c: any, t: any, f: any) => (c ? t : f), // IF
      Math.abs, // ABS
      Math.max, // MAX
      Math.min, // MIN
      Math.round, // ROUND
      Math.floor, // FLOOR
      Math.ceil, // CEIL
      (...args: any[]) => args.every(Boolean), // AND
      (...args: any[]) => args.some(Boolean), // OR
      (a: any) => !a, // NOT
      (x: any) => { context.outputFormat = "NUMBER"; return Number(x); }, // NUM
      (x: any) => { context.outputFormat = "STRING"; return String(x); }, // STRING
      (x: any, format?: string) => {
        const mins = Number(x);
        if (isNaN(mins)) return 0;
        if (format) {
          const fmt = format.toUpperCase();
          if (fmt === "HOURS") {
            context.outputFormat = "NUMBER";
            return mins / 60;
          }
          if (fmt === "MINUTES" || fmt === "MINS") {
            context.outputFormat = "NUMBER";
            return mins;
          }
          context.outputFormat = "TIME";
          context.customFormat = format;
          return mins;
        }
        context.outputFormat = "TIME";
        return mins;
      }, // TIME
      (x: any) => Number(x) / 60, // HOURS
      (x: any) => Number(x) * 60, // MINS
      formatTime
    );

    if (typeof result === "string" && context.outputFormat !== "TIME") {
      const num = parseFloat(result.replace(/[^0-9.-]/g, ''));
      return { value: isNaN(num) ? 0 : num, stringVal: result };
    }

    const num = Number(result);
    const finalNum = isNaN(num) ? 0 : num;
    
    if (context.outputFormat === "TIME") {
      return { value: finalNum, stringVal: formatTime(finalNum, ":", context.customFormat) };
    }
    
    return { value: finalNum };
  } catch (e) {
    console.error("Widget math evaluation error", e);
    return { value: 0 };
  }
}

/**
 * Main evaluation function for a widget.
 */
export function evaluateWidget(
  config: WidgetConfig, 
  scan: SavedScan | null, 
  constants: Record<string, string | number> = {}, 
  allConfigs: ColumnConfig[] = []
): WidgetEvaluationResult {
  if (!scan) {
    return { value: 0, formattedValue: "No Data" };
  }

  // 1. Filter entries based on timeFilter
  let filteredEntries = scan.entries;
  if (config.timeFilter !== 'all' && config.dateColumnKey) {
    filteredEntries = scan.entries.filter(entry => {
      const dateStr = entry[config.dateColumnKey];
      const d = parseDate(String(dateStr || ""));
      if (!d) return true;
      return isDateInFilter(d, config.timeFilter);
    });
  }

  // 1.5 Filter entries based on rowFilter
  if (config.rowFilter && config.rowFilter.columnKey) {
    const { columnKey, operator, value } = config.rowFilter;
    const sep = getColumnSeparator(columnKey, allConfigs, ":");
    filteredEntries = filteredEntries.filter(entry => {
      const valStr = String(entry[columnKey] || "").trim();
      const numVal = parseCellValue(valStr, sep);
      
      switch (operator) {
        case 'is_empty':
          return valStr === "";
        case 'not_empty':
          return valStr !== "";
        case 'not_zero':
          return !isNaN(numVal) && numVal !== 0;
        case 'equals_zero':
          return !isNaN(numVal) && numVal === 0;
        case 'greater_than_zero':
          return !isNaN(numVal) && numVal > 0;
        case 'less_than_zero':
          return !isNaN(numVal) && numVal < 0;
        case 'equals':
          return valStr === (value || "").trim();
        default:
          return true;
      }
    });
  }

  // 2. Process the main formula
  const processedFormula = processFormula(config.formula, filteredEntries, constants, allConfigs);
  const evaluated = evaluateMath(processedFormula);
  const value = evaluated.value;

  // 3. Process target formula (if any)
  let targetValue: number | undefined = undefined;
  let targetStringVal: string | undefined = undefined;
  if (config.targetFormula) {
    const processedTarget = processFormula(config.targetFormula, filteredEntries, constants, allConfigs);
    const evaluatedTarget = evaluateMath(processedTarget);
    targetValue = evaluatedTarget.value;
    targetStringVal = evaluatedTarget.stringVal;
  }

  // 4. Format outputs
  let formattedValue = evaluated.stringVal || value.toString();
  if (!evaluated.stringVal) {
    if (Math.abs(value) > 0 && value % 1 === 0) {
       formattedValue = formatTime(value, ":");
    } else if (value % 1 !== 0) {
       formattedValue = value.toFixed(2);
    }
  }

  let formattedTarget: string | undefined = undefined;
  if (targetValue !== undefined) {
    formattedTarget = targetStringVal || targetValue.toString();
    if (!targetStringVal) {
      if (Math.abs(targetValue) > 0 && targetValue % 1 === 0) {
        formattedTarget = formatTime(targetValue, ":");
      } else if (targetValue % 1 !== 0) {
        formattedTarget = targetValue.toFixed(2);
      }
    }
  }

  let percentage: number | undefined = undefined;
  if (targetValue !== undefined && targetValue !== 0) {
    percentage = Math.max(0, Math.min(100, (value / targetValue) * 100));
  }

  return {
    value,
    formattedValue,
    targetValue,
    formattedTarget,
    percentage
  };
}
