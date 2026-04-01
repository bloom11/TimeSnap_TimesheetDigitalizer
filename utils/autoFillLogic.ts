import { TimeEntry, ColumnConfig } from '../types';
import { getSettings } from '../services/settingsService';

export function autoFillWeekends(entries: TimeEntry[], includeBoundaries: boolean = true): TimeEntry[] {
  if (!entries || entries.length === 0) return entries;

  const settings = getSettings();
  const defaultYear = parseInt(String(settings.defaultYear), 10) || new Date().getFullYear();
  
  let currentMonth = new Date().getMonth() + 1; // 1-12
  let currentYear = defaultYear;
  
  // First pass: try to find the first explicit month/year to set our baseline
  for (const entry of entries) {
    const parsed = parseDateString(entry.date);
    if (parsed.year) currentYear = parsed.year;
    if (parsed.month) {
      currentMonth = parsed.month;
      break;
    }
  }

  const result: TimeEntry[] = [];
  let lastDateObj: Date | null = null;
  let lastFormat: string = 'DD/MM/YYYY';
  let lastSeparator: string = '/';

  // Boundary check: Start of month
  if (includeBoundaries) {
    const firstEntry = entries[0];
    const firstParsed = parseDateString(firstEntry.date);
    if (firstParsed.day) {
      const firstDay = firstParsed.day;
      const firstMonth = firstParsed.month || currentMonth;
      const firstYear = firstParsed.year || currentYear;
      
      // Look back from 1st of the month to firstDay
      for (let d = 1; d < firstDay; d++) {
        const checkDate = new Date(firstYear, firstMonth - 1, d);
        const dayOfWeek = checkDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          result.push(createEmptyWeekendEntry(checkDate, firstParsed.format || lastFormat, firstParsed.separator || lastSeparator));
        }
      }
    }
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const parsed = parseDateString(entry.date);
    
    if (!parsed.day) {
      // If we can't parse the day, just push the entry and continue
      result.push(entry);
      continue;
    }

    let entryDay = parsed.day;
    let entryMonth = parsed.month || currentMonth;
    let entryYear = parsed.year || currentYear;
    
    // Detect month rollover if day drops significantly and no explicit month was provided
    if (!parsed.month && lastDateObj) {
      if (lastDateObj.getDate() > 20 && entryDay < 10) {
        currentMonth++;
        if (currentMonth > 12) {
          currentMonth = 1;
          currentYear++;
        }
        entryMonth = currentMonth;
        entryYear = currentYear;
      } else if (lastDateObj.getDate() < 10 && entryDay > 20) {
        // Reverse rollover
        currentMonth--;
        if (currentMonth < 1) {
          currentMonth = 12;
          currentYear--;
        }
        entryMonth = currentMonth;
        entryYear = currentYear;
      }
    } else if (parsed.month) {
      currentMonth = parsed.month;
      if (parsed.year) {
        currentYear = parsed.year;
      }
    }

    const currentDateObj = new Date(entryYear, entryMonth - 1, entryDay);
    
    // Check for gaps
    if (lastDateObj) {
      // Calculate difference in days
      const diffTime = currentDateObj.getTime() - lastDateObj.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 1 && diffDays < 31) { // Reasonable gap
        // Fill in missing days if they are weekends
        for (let d = 1; d < diffDays; d++) {
          const missingDate = new Date(lastDateObj.getTime() + d * 24 * 60 * 60 * 1000);
          const dayOfWeek = missingDate.getDay();
          if (dayOfWeek === 0 || dayOfWeek === 6) { // 0 = Sunday, 6 = Saturday
            // It's a weekend! Add an empty row
            result.push(createEmptyWeekendEntry(missingDate, parsed.format || lastFormat, parsed.separator || lastSeparator));
          }
        }
      } else if (diffDays < -1 && diffDays > -31) {
        // If the list is in descending order, we can also fill gaps backwards
        for (let d = -1; d > diffDays; d--) {
          const missingDate = new Date(lastDateObj.getTime() + d * 24 * 60 * 60 * 1000);
          const dayOfWeek = missingDate.getDay();
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            result.push(createEmptyWeekendEntry(missingDate, parsed.format || lastFormat, parsed.separator || lastSeparator));
          }
        }
      }
    }
    
    result.push(entry);
    lastDateObj = currentDateObj;
    if (parsed.format) lastFormat = parsed.format;
    if (parsed.separator) lastSeparator = parsed.separator;
  }

  // Boundary check: End of month
  if (includeBoundaries && lastDateObj) {
    const lastMonth = lastDateObj.getMonth();
    const lastYear = lastDateObj.getFullYear();
    const lastDay = lastDateObj.getDate();
    
    // Get last day of the month
    const endOfMonth = new Date(lastYear, lastMonth + 1, 0).getDate();
    
    for (let d = lastDay + 1; d <= endOfMonth; d++) {
      const checkDate = new Date(lastYear, lastMonth, d);
      const dayOfWeek = checkDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        result.push(createEmptyWeekendEntry(checkDate, lastFormat, lastSeparator));
      }
    }
  }

  return result;
}

function parseDateString(dateStr: string): { day?: number, month?: number, year?: number, format?: string, separator?: string } {
  if (!dateStr) return {};
  
  const str = dateStr.trim();
  
  // Find separator
  let separator = '/';
  if (str.includes('-')) separator = '-';
  else if (str.includes('.')) separator = '.';
  
  const parts = str.split(separator).map(p => parseInt(p, 10)).filter(p => !isNaN(p));
  
  if (parts.length === 1) {
    return { day: parts[0], format: 'DD', separator };
  } else if (parts.length === 2) {
    return { day: parts[0], month: parts[1], format: 'DD/MM', separator };
  } else if (parts.length === 3) {
    let year = parts[2];
    if (year < 100) year += 2000; // Handle 2-digit years
    return { day: parts[0], month: parts[1], year: year, format: 'DD/MM/YYYY', separator };
  }
  
  return {};
}

function createEmptyWeekendEntry(date: Date, format: string, separator: string): TimeEntry {
  const dayStr = date.getDate().toString().padStart(2, '0');
  const monthStr = (date.getMonth() + 1).toString().padStart(2, '0');
  const yearStr = date.getFullYear().toString();
  
  let dateString = dayStr;
  if (format === 'DD/MM' || format === 'DD/MM/YYYY') {
    dateString = `${dayStr}${separator}${monthStr}`;
    if (format === 'DD/MM/YYYY') {
      dateString += `${separator}${yearStr}`;
    }
  }
  
  return {
    id: crypto.randomUUID(),
    date: dateString,
    entrance: '',
    lunchStart: '',
    lunchEnd: '',
    exit: ''
  };
}

export function removeEmptyWeekends(entries: TimeEntry[], configs: ColumnConfig[] = []): TimeEntry[] {
  if (!entries || entries.length === 0) return entries;

  const settings = getSettings();
  const defaultYear = parseInt(String(settings.defaultYear), 10) || new Date().getFullYear();
  
  let currentMonth = new Date().getMonth() + 1;
  let currentYear = defaultYear;
  
  // First pass: find baseline month/year
  for (const entry of entries) {
    const parsed = parseDateString(entry.date);
    if (parsed.year) currentYear = parsed.year;
    if (parsed.month) {
      currentMonth = parsed.month;
      break;
    }
  }

  let lastDateObj: Date | null = null;
  const calculatedKeys = new Set(configs.filter(c => c.formula && c.formula !== 'none').map(c => c.key));

  return entries.filter((entry) => {
    const parsed = parseDateString(entry.date);
    
    if (!parsed.day) {
      return true;
    }

    let entryDay = parsed.day;
    let entryMonth = parsed.month || currentMonth;
    let entryYear = parsed.year || currentYear;
    
    // Rollover detection (Forward & Reverse)
    if (!parsed.month && lastDateObj) {
      if (lastDateObj.getDate() > 20 && entryDay < 10) {
        currentMonth++;
        if (currentMonth > 12) {
          currentMonth = 1;
          currentYear++;
        }
        entryMonth = currentMonth;
        entryYear = currentYear;
      } else if (lastDateObj.getDate() < 10 && entryDay > 20) {
        currentMonth--;
        if (currentMonth < 1) {
          currentMonth = 12;
          currentYear--;
        }
        entryMonth = currentMonth;
        entryYear = currentYear;
      }
    } else if (parsed.month) {
      currentMonth = parsed.month;
      if (parsed.year) currentYear = parsed.year;
    }

    const dateObj = new Date(entryYear, entryMonth - 1, entryDay);
    const dayOfWeek = dateObj.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    lastDateObj = dateObj;

    if (!isWeekend) return true;

    // It's a weekend, check if it's empty
    // We ignore 'id', 'date', and any calculated columns
    const hasData = Object.keys(entry).some(key => {
      if (key === 'id' || key === 'date') return false;
      if (calculatedKeys.has(key)) return false;
      
      const val = entry[key];
      return val !== null && val !== undefined && String(val).trim() !== "";
    });

    // If it has manual data, keep it. If it's a weekend and has NO manual data, remove it.
    return hasData;
  });
}
