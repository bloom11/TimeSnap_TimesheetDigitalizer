// services/formulaEngine.ts
import { TimeEntry, ColumnConfig } from "../types";

export type FormulaResult = string;
type OutputFormat = "NUMBER" | "STRING" | "TIME";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Parse "H{sep}MM" or "H" => minutes. Handles negative like "-1:30" => -90 */
function parseTime(t: string, sep: string): number {
  if (!t) return NaN;
  const escapedSep = escapeRegExp(sep);
  const regex = new RegExp(`^\\s*(-?\\d+)(?:${escapedSep}(\\d{1,2}))?\\s*(am|pm|a\\.m\\.|p\\.m\\.)?\\s*$`, 'i');
  const match = String(t).match(regex);
  if (!match) return NaN;
  let h = parseInt(match[1], 10);
  const m = match[2] ? parseInt(match[2], 10) : 0;
  const modifier = match[3] ? match[3].toLowerCase().replace(/\./g, '') : null;
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;

  if (modifier) {
    const isNegative = h < 0 || Object.is(h, -0);
    let absH = Math.abs(h);
    if (modifier === 'pm' && absH < 12) absH += 12;
    if (modifier === 'am' && absH === 12) absH = 0;
    h = isNegative ? -absH : absH;
  }

  return h < 0 ? h * 60 - m : h * 60 + m;
}

/** Minutes => "H{sep}MM" (keeps sign) */
function formatTime(mins: number, sep: string, format?: '12h' | '24h'): string {
  if (!Number.isFinite(mins)) return "";
  let h = Math.floor(Math.abs(mins) / 60);
  const m = Math.floor(Math.abs(mins) % 60);
  const sign = mins < 0 ? "-" : "";

  if (format === '12h') {
    const period = h >= 12 ? 'PM' : 'AM';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return `${sign}${h12}${sep}${m.toString().padStart(2, "0")} ${period}`;
  }

  return `${sign}${h}${sep}${m.toString().padStart(2, "0")}`;
}

/**
 * Human rule:
 * - Numbers are ALWAYS numbers (8, 8.5, -3, 0.25)
 * - Time literal is ONLY something with a separator (8:00, 7.30 if sep is '.', etc.)
 * - If value comes from a column, it is converted in background to minutes if it looks like time.
 */
function looksLikeTimeToken(raw: string, timeSep: string): { isTime: boolean; sep: string } {
  const t = String(raw ?? "").trim();
  if (!t) return { isTime: false, sep: timeSep };

  // try the column separator first, then fallback ':'
  const sepsToTry = Array.from(new Set([timeSep, ":"])).filter(Boolean);

  for (const sep of sepsToTry) {
    const escaped = escapeRegExp(sep);
    const withMinutes = new RegExp(`^\\s*-?\\d+\\s*${escaped}\\s*\\d{1,2}\\s*(?:am|pm|a\\.m\\.|p\\.m\\.)?\\s*$`, 'i');
    if (withMinutes.test(t)) return { isTime: true, sep };
  }

  return { isTime: false, sep: timeSep };
}

/**
 * Parse either:
 * - time strings like "08:30" or "08.30" (custom sep) => minutes
 * - plain numbers like "7.5" => number
 * Empty/invalid => NaN
 */
function parseCellValue(raw: string, timeSep: string): number {
  const t = String(raw ?? "").trim();
  if (!t) return NaN;

  const timeDetect = looksLikeTimeToken(t, timeSep);
  if (timeDetect.isTime) {
    const mins = parseTime(t, timeDetect.sep);
    return Number.isFinite(mins) ? mins : NaN;
  }

  const num = Number(t);
  return Number.isFinite(num) ? num : NaN;
}

function getColumnSeparator(colKey: string, allConfigs: ColumnConfig[], fallback = ":"): string {
  const cfg = allConfigs.find((c) => c.key === colKey);
  return cfg?.timeSeparator || fallback;
}

/**
 * Allow TIME(8:00) / TIME(8.00) / HOURS(8:00) / MINS(8:00) without quotes.
 * We rewrite inside these wrappers only, so JS can evaluate.
 *
 * Examples:
 * - TIME(8:00)  -> TIME("8:00")
 * - HOURS(7:30) -> HOURS("7:30")
 */
function normalizeWrapperTimeLiterals(expr: string, timeSep: string): string {
  const sepsToTry = Array.from(new Set([timeSep, ":"])).filter(Boolean);
  const sepClass = sepsToTry.map((s) => escapeRegExp(s)).join("|"); // ":" or "\."
  // matches:  -12:05  |  8:00  |  8 : 00  |  8.00 (if '.' is sep)
  const timeToken = `(-?\\d+\\s*(?:${sepClass})\\s*\\d{1,2}\\s*(?:am|pm|a\\.m\\.|p\\.m\\.)?)`;

  // Only inside wrappers TIME()/HOURS()/MINS()
  const wrap = (name: "TIME" | "HOURS" | "MINS") => {
    const r = new RegExp(`${name}\\s*\\(\\s*${timeToken}\\s*\\)`, "gi");
    expr = expr.replace(r, (_m, tok) => `${name}("${String(tok).replace(/\s+/g, "")}")`);
  };

  wrap("TIME");
  wrap("HOURS");
  wrap("MINS");

  return expr;
}

/**
 * Complex formula rules (human/simple):
 * - Default output is NUMBER.
 * - TIME(x) forces TIME formatting (minutes -> "H{sep}MM").
 * - NUM(x) forces NUMBER output.
 * - STRING(x) forces STRING output.
 * - keepEmptyIfNegative applies ONLY to NUMBER and TIME.
 * - Time written in formula is allowed as TIME(8:00) (no quotes) and HOURS(8:00)/MINS(8:00).
 */
export function calculateValue(
  row: TimeEntry,
  config: ColumnConfig,
  index: number,
  prevRow: TimeEntry | null,
  constants: Record<string, string | number>,
  allConfigs: ColumnConfig[]
): FormulaResult {
  const {
    formula,
    paramA = "",
    paramB = "",
    staticValue = "",
    complexFormula = "",
    timeSeparator = ":",
  } = config;

  if (formula === "none") return (row[config.key] as string) || "";
  if (formula === "static") return staticValue;

  if (formula === "increment") {
    const step = parseFloat(paramA) || 1;

    if (paramB === "date") {
      const parts = staticValue.replace(/[\.-]/g, "/").split("/");
      if (parts.length === 3) {
        let d = parseInt(parts[0], 10);
        let m = parseInt(parts[1], 10) - 1;
        let y = parseInt(parts[2], 10);
        if (y < 100) y += 2000;
        const dateObj = new Date(y, m, d);
        if (!isNaN(dateObj.getTime())) {
          dateObj.setDate(dateObj.getDate() + index * step);
          return dateObj.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });
        }
      }
      return staticValue;
    }

    const start = parseFloat(staticValue) || 0;
    return String(start + index * step);
  }

  // ---- COMPLEX FORMULA ----
  if (formula === "complex" && complexFormula) {
    let expr = complexFormula;

    // 0) Allow TIME(8:00)/HOURS(8:00)/MINS(8:00) without quotes
    expr = normalizeWrapperTimeLiterals(expr, timeSeparator);

    // 1) Replace [PREV_CELL] (use this column separator)
    const prevVal = prevRow ? (prevRow[config.key] as string) : "";
    const prevNum = parseCellValue(prevVal || "", timeSeparator);
    expr = expr.replace(/\[PREV_CELL\]/g, Number.isFinite(prevNum) ? String(prevNum) : "0");

    // 2) Replace [colKey] using each source column separator
    expr = expr.replace(/\[([^\]]+)\]/g, (_match, colKey: string) => {
      const val = (row[colKey] as string) || "";
      const sep = getColumnSeparator(colKey, allConfigs, ":");
      const num = parseCellValue(val, sep);
      return Number.isFinite(num) ? String(num) : "0";
    });

    // 3) Replace constants (word-boundary)
    for (const [k, v] of Object.entries(constants)) {
      const replacement = typeof v === "number" ? String(v) : `"${String(v).replace(/"/g, '\\"')}"`;
      expr = expr.replace(new RegExp(`\\b${escapeRegExp(k)}\\b`, "g"), replacement);
    }

    try {
      // 4) Sanitize
      // Keep: digits, letters, underscore, whitespace, quotes, dot, operators, commas,
      // ternary, comparisons, logical && ||, parentheses.
      // We allow ":" in general so quoted "8:00" is fine (and TIME(8:00) got normalized anyway).
      const sanitized = expr.replace(/[^0-9a-zA-Z_\s+\-*/().,?:><=!&|'"[\]:]/g, "");

      // 5) Whitelist identifiers
      const allowed = new Set([
        "IF",
        "ABS",
        "MAX",
        "MIN",
        "ROUND",
        "FLOOR",
        "CEIL",
        "AND",
        "OR",
        "NOT",
        "NUM",
        "STRING",
        "TIME",
        "HOURS",
        "MINS",
        "true",
        "false",
      ]);

      // Strip string literals before checking identifiers to allow string constants and literals
      const withoutStrings = sanitized.replace(/"[^"]*"|'[^']*'/g, "");
      const words = withoutStrings.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
      for (const w of words) {
        if (!allowed.has(w)) return "ERR";
      }

      // 6) Evaluate with explicit helpers
      let outputFormat: OutputFormat = "NUMBER";

      const fn = new Function(
        "IF",
        "ABS",
        "MAX",
        "MIN",
        "ROUND",
        "FLOOR",
        "CEIL",
        "AND",
        "OR",
        "NOT",
        "NUM",
        "STRING",
        "TIME",
        "HOURS",
        "MINS",
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
        (x: any) => {
          outputFormat = "NUMBER";
          return Number(x);
        }, // NUM
        (x: any) => {
          outputFormat = "STRING";
          return String(x);
        }, // STRING
        (x: any) => {
          outputFormat = "TIME";
          // TIME("8:00") or TIME("8.00")
          if (typeof x === "string") {
            const t = x.trim();
            const det = looksLikeTimeToken(t, timeSeparator);
            if (det.isTime) return parseTime(t, det.sep);
            const n = Number(t);
            return Number.isFinite(n) ? n : NaN; // assume minutes if numeric
          }
          return Number(x); // assume minutes
        }, // TIME
        (x: any) => {
          // HOURS(8) = 8 hours, HOURS("8:30") = 8.5 hours, HOURS(510) = 8.5 if minutes
          if (typeof x === "string") {
            const t = x.trim();
            const det = looksLikeTimeToken(t, timeSeparator);
            if (det.isTime) return parseTime(t, det.sep) / 60;
            const n = Number(t);
            return Number.isFinite(n) ? n : NaN; // already hours
          }
          const n = Number(x);
          return Number.isFinite(n) ? n : NaN; // hours
        }, // HOURS
        (x: any) => {
          // MINS(8) = 8 minutes, MINS("8:00") = 480, MINS(8.5) = 8.5 minutes (kept numeric)
          if (typeof x === "string") {
            const t = x.trim();
            const det = looksLikeTimeToken(t, timeSeparator);
            if (det.isTime) return parseTime(t, det.sep);
            const n = Number(t);
            return Number.isFinite(n) ? n : NaN;
          }
          const n = Number(x);
          return Number.isFinite(n) ? n : NaN;
        } // MINS
      );

      // 7) String / boolean outputs
      if (typeof result === "string") return result;
      if (typeof result === "boolean") return result ? "TRUE" : "FALSE";

      // 8) Numeric validation
      const n = typeof result === "number" ? result : Number(result);
      if (!Number.isFinite(n)) return "ERR";

      // 9) keepEmptyIfNegative applies to NUMBER and TIME only
      if (config.keepEmptyIfNegative && n < 0) return "";

      // 10) Format
      if (outputFormat === "TIME") return formatTime(n, timeSeparator, config.timeFormat);
      return String(Math.round(n * 100) / 100);
    } catch {
      return "ERR";
    }
  }

  // ---- SIMPLE FORMULAS ----
  const valA = (row[paramA] as string) || "";
  const valB = (row[paramB] as string) || "";

  if (formula === "concat") return `${valA} ${valB}`.trim();

  // diff/sum: operands are times; use each source column separator
  const sepA = paramA ? getColumnSeparator(paramA, allConfigs, timeSeparator) : timeSeparator;
  const sepB = paramB ? getColumnSeparator(paramB, allConfigs, timeSeparator) : timeSeparator;

  const minsA = parseTime(valA, sepA);
  const minsB = parseTime(valB, sepB);
  if (!Number.isFinite(minsA) || !Number.isFinite(minsB)) return "";

  let resultMins = 0;
  if (formula === "diff") resultMins = minsB - minsA;
  else if (formula === "sum") resultMins = minsA + minsB;

  if (config.keepEmptyIfNegative && resultMins < 0) return "";

  // output uses this column separator
  return formatTime(resultMins, timeSeparator, config.timeFormat);
}

export function applyFormulas(
  data: TimeEntry[],
  configs: ColumnConfig[],
  constants: Record<string, string | number>
): TimeEntry[] {
  if (!configs.length) return data;

  const out: TimeEntry[] = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const prevRow = i > 0 ? out[i - 1] : null;
    const newRow: TimeEntry = { ...row };

    // Use newRow while filling, so later formulas can read earlier computed columns in same row if needed
    for (const cfg of configs) {
      if (cfg.formula !== "none") {
        newRow[cfg.key] = calculateValue(newRow, cfg, i, prevRow, constants, configs);
      }
    }

    out.push(newRow);
  }
  return out;
}