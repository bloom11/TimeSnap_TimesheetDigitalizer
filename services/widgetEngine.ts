import { SavedScan, TimeEntry, WidgetConfig, ColumnConfig, ConditionalRule } from "../types";
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
 * Helper to evaluate a single rule against an entry.
 */
function evaluateRule(entry: TimeEntry, rule: ConditionalRule, allConfigs: ColumnConfig[]): boolean {
  const { columnKey, operator: ruleOperator, value } = rule;
  const sep = getColumnSeparator(columnKey, allConfigs, ":");
  const valStr = String(entry[columnKey] || "").trim();
  const numVal = parseCellValue(valStr, sep);
  
  switch (ruleOperator) {
    case 'is_empty': return valStr === "";
    case 'not_empty': return valStr !== "";
    case 'not_zero': return !isNaN(numVal) && numVal !== 0;
    case 'equals_zero': return !isNaN(numVal) && numVal === 0;
    case 'greater_than_zero': return !isNaN(numVal) && numVal > 0;
    case 'less_than_zero': return !isNaN(numVal) && numVal < 0;
    case 'equals': return valStr === (value || "").trim();
    default: return true;
  }
}

/**
 * Parses a simple condition string like "[col] = 'val'" into a ConditionalRule.
 */
function parseConditionString(condition: string): ConditionalRule | null {
  // Robust parser for "[col] = 'val'" or "[col] is_empty"
  const match = condition.match(/\[([^\]]+)\]\s*(=|is_empty|not_empty|not_zero|equals_zero|greater_than_zero|less_than_zero|equals)(?:\s*['"]?([^'"]+)['"]?)?/i);
  if (!match) return null;
  
  let operator = match[2];
  if (operator === '=') operator = 'equals';
  
  return {
    columnKey: match[1],
    operator: operator as any,
    value: match[3]
  };
}

/**
 * Evaluates an aggregation token like SUM([total_hours] WHERE [status] = 'completed') over a set of entries.
 */
function evaluateAggregation(op: string, colKey: string, conditionString: string | undefined, entries: TimeEntry[], allConfigs: ColumnConfig[]): number {
  const operation = op.toUpperCase();
  const timeSep = getColumnSeparator(colKey, allConfigs, ":");

  let rule: ConditionalRule | null = null;
  if (conditionString) {
    rule = parseConditionString(conditionString);
  }

  let values: number[] = [];

  for (const entry of entries) {
    // Apply WHERE filter if it exists
    if (rule && !evaluateRule(entry, rule, allConfigs)) {
      continue;
    }

    const rawVal = entry[colKey];
    if (rawVal !== undefined && rawVal !== null && rawVal !== "") {
      // For numeric aggregations, we must be able to parse the value
      if (operation !== 'COUNT') {
        const num = parseCellValue(String(rawVal), timeSep);
        if (!isNaN(num)) {
          values.push(num);
        }
      } else {
        // For COUNT, we just need the value to exist
        values.push(1);
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
  const regex = /(SUM|AVG|MIN|MAX|COUNT)\s*\(\s*\[([^\]]+)\](?:\s+WHERE\s+([^)]+))?\s*\)/gi;
  expr = expr.replace(regex, (match, op, colKey, condition) => {
    const val = evaluateAggregation(op, colKey, condition, entries, allConfigs);
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

  // 1.5 Filter entries based on conditionChain
  if (config.conditionChain && config.conditionChain.length > 0) {
    filteredEntries = filteredEntries.filter(entry => {
      // Helper to evaluate a single rule
      const evaluateRule = (rule: ConditionalRule): boolean => {
        const { columnKey, operator: ruleOperator, value } = rule;
        const sep = getColumnSeparator(columnKey, allConfigs, ":");
        const valStr = String(entry[columnKey] || "").trim();
        const numVal = parseCellValue(valStr, sep);
        const compareValue = (value || "").trim();
        const numCompareValue = parseCellValue(compareValue, sep);
        
        switch (ruleOperator) {
          case 'is_empty': return valStr === "";
          case 'not_empty': return valStr !== "";
          case 'not_zero': return !isNaN(numVal) && numVal !== 0;
          case 'equals_zero': return !isNaN(numVal) && numVal === 0;
          case 'greater_than_zero': return !isNaN(numVal) && numVal > 0;
          case 'less_than_zero': return !isNaN(numVal) && numVal < 0;
          case 'equals': 
            if (!isNaN(numVal) && !isNaN(numCompareValue)) return numVal === numCompareValue;
            return valStr === compareValue;
          case 'not_equals':
            if (!isNaN(numVal) && !isNaN(numCompareValue)) return numVal !== numCompareValue;
            return valStr !== compareValue;
          case 'greater_than':
            if (!isNaN(numVal) && !isNaN(numCompareValue)) return numVal > numCompareValue;
            return valStr > compareValue;
          case 'less_than':
            if (!isNaN(numVal) && !isNaN(numCompareValue)) return numVal < numCompareValue;
            return valStr < compareValue;
          case 'greater_than_or_equal':
            if (!isNaN(numVal) && !isNaN(numCompareValue)) return numVal >= numCompareValue;
            return valStr >= compareValue;
          case 'less_than_or_equal':
            if (!isNaN(numVal) && !isNaN(numCompareValue)) return numVal <= numCompareValue;
            return valStr <= compareValue;
          default: return true;
        }
      };

      // Evaluate chain left-to-right
      let result = evaluateRule(config.conditionChain[0].rule);
      
      for (let i = 0; i < config.conditionChain.length - 1; i++) {
        const nextResult = evaluateRule(config.conditionChain[i + 1].rule);
        const op = config.conditionChain[i].nextOperator || 'AND';
        
        if (op === 'AND') result = result && nextResult;
        else if (op === 'OR') result = result || nextResult;
        else if (op === 'XOR') result = result !== nextResult;
      }
      
      return result;
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
