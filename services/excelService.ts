
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { TimeEntry, ExcelColumnMapping } from "../types";

// Returns a preview of data for the AI using XLSX (fast read)
export const readExcelFile = (file: File): Promise<{ workbook: XLSX.WorkBook, previews: Record<string, any[][]> }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        // Read strictly for preview generation
        const workbook = XLSX.read(data, { type: 'binary', cellFormula: false, cellStyles: false });
        
        const previews: Record<string, any[][]> = {};
        
        workbook.SheetNames.forEach(name => {
            const sheet = workbook.Sheets[name];
            // Get raw values only for preview
            const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", range: 0 }); 
            previews[name] = (json as any[][]).slice(0, 20); // First 20 rows for context
        });

        resolve({ workbook, previews });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};

const getHeaderLabel = (key: string) => {
    const map: Record<string, string> = {
        date: "Date",
        entrance: "Entrance",
        lunchStart: "Lunch Start",
        lunchEnd: "Lunch End",
        exit: "Exit"
    };
    return map[key] || key.charAt(0).toUpperCase() + key.slice(1);
};

export const getExportableColumns = (data: TimeEntry[]): string[] => {
    if (data.length === 0) return [];
    const availableKeys = Object.keys(data[0]).filter(k => k !== 'id');
    const standardOrder = ['date', 'entrance', 'lunchStart', 'lunchEnd', 'exit'];
    const presentStandardKeys = standardOrder.filter(k => availableKeys.includes(k));
    const customKeys = availableKeys.filter(k => !standardOrder.includes(k));
    return [...presentStandardKeys, ...customKeys];
};

export const generateStandardExcel = (data: TimeEntry[]) => {
  if (data.length === 0) return;
  const columns = getExportableColumns(data);
  const headers = columns.map(getHeaderLabel);
  const rows = data.map(item => columns.map(col => item[col] || ''));

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Orari");
  XLSX.writeFile(wb, "Timesheet_Export.xlsx");
};

const normalizeDate = (d: any): string => {
    if (!d) return "";
    // Handle JS Date objects from ExcelJS
    if (d instanceof Date) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}${mm}${yyyy}`;
    }
    // Handle string inputs like 01/01/2024 or 2024-01-01
    const str = String(d).replace(/[^0-9]/g, '');
    return str;
};

// Uses ExcelJS to modify the file in-place, preserving ALL structure/macros/styles
export const mergeAndSave = async (
    file: File, 
    sheetName: string, 
    startRow: number, 
    entries: TimeEntry[], 
    mapping: ExcelColumnMapping
) => {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) throw new Error(`Sheet "${sheetName}" not found in workbook.`);

    const dateColChar = mapping['dateCol'];
    const useDateMatching = !!dateColChar;

    entries.forEach((entry, idx) => {
        let targetRow: ExcelJS.Row | undefined;
        
        if (useDateMatching) {
             const entryDateKey = normalizeDate(entry.date);
             if (entryDateKey) {
                 // Search for the matching date row
                 for (let r = startRow; r < startRow + 100; r++) {
                     const row = sheet.getRow(r);
                     const dateCell = row.getCell(dateColChar);
                     const cellVal = dateCell.value; 
                     
                     let rawVal = cellVal;
                     if (typeof cellVal === 'object' && cellVal !== null && 'result' in cellVal) {
                         rawVal = (cellVal as any).result;
                     } else if (typeof cellVal === 'object' && cellVal !== null && 'text' in cellVal) {
                          rawVal = (cellVal as any).text;
                     }

                     if (normalizeDate(rawVal).includes(entryDateKey)) {
                         targetRow = row;
                         break;
                     }
                 }
             }
        }

        if (!targetRow && !useDateMatching) {
             targetRow = sheet.getRow(startRow + idx);
        }

        if (targetRow) {
            Object.keys(mapping).forEach(mappingKey => {
                if (!mappingKey.endsWith('Col')) return;
                if (useDateMatching && mappingKey === 'dateCol') return;

                const dataKey = mappingKey.replace(/Col$/, '');
                const colLetter = mapping[mappingKey];
                
                const val = entry[dataKey];
                if (colLetter && val !== undefined && val !== null) {
                    const cell = targetRow.getCell(colLetter);
                    
                    // Attempt to write numbers as numbers to avoid "Number Stored as Text" warnings.
                    // But strictly avoid converting "08:00" to a number, as it might lose the colon formatting
                    // if the cell style isn't set to Time.
                    const numVal = parseFloat(val);
                    const isNum = !isNaN(numVal) && isFinite(numVal) && val.trim() !== '';
                    const isTimeFormat = val.includes(':') || val.includes('/') || val.includes('-');

                    if (isNum && !isTimeFormat) {
                        cell.value = numVal;
                    } else {
                        // Ensure we write a string. 
                        // Note: If cell was previously rich text, this overwrites it with simple text, which is desired.
                        cell.value = val.toString();
                    }
                }
            });
        }
    });

    // CRITICAL FIX: 
    // Clear calculation properties. This prevents Excel from trying to validate the (now outdated) calculation chain
    // against the new data immediately upon open, which is the primary cause of the "Repair" popup.
    // By removing this, Excel will just silently rebuild the chain when needed.
    // @ts-ignore - Accessing private/internal property safely
    if (workbook.calcProperties) {
        // @ts-ignore
        workbook.calcProperties = {};
    }

    const outBuffer = await workbook.xlsx.writeBuffer();
    
    const blob = new Blob([outBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Updated_${file.name}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
};
