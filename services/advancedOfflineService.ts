
import Tesseract from 'tesseract.js';
import { runPaddleOCR } from './paddleService';
import { cropCell } from './imageProcessing';
import { TimeEntry, AppSettings, OCREngine, ScanResult } from '../types';

// We reuse the pattern matcher from the original service
const forceTimePattern = (text: string): string => {
    const clean = text.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
    const mapped = clean.split('').map(c => {
        if (/[0-9]/.test(c)) return c;
        if (['L','I','l','i','|','[',']','!','/','\\','(',')','{','}'].includes(c)) return '1';
        if (['O','D','Q','U','V'].includes(c)) return '0';
        if (['S','5','§','$'].includes(c)) return '5';
        if (['Z','2'].includes(c)) return '2';
        if (['A','H','4'].includes(c)) return '4';
        if (['G','6'].includes(c)) return '6';
        if (['B','8','&'].includes(c)) return '8';
        if (['P','9','G'].includes(c)) return '9';
        return '';
    }).join('');
    
    if (mapped.length === 3) return `0${mapped[0]}:${mapped.slice(1)}`;
    if (mapped.length === 4) return `${mapped.slice(0,2)}:${mapped.slice(2)}`;
    return mapped;
};

// Helper for Tesseract fallback
const runTesseractCell = async (image: string, mode: 'line' | 'word' = 'word'): Promise<string> => {
    const psm = mode === 'line' ? Tesseract.PSM.SINGLE_LINE : Tesseract.PSM.SINGLE_WORD;
    const whitelist = mode === 'line' ? '0123456789/-.' : '0123456789';
    
    const res = await Tesseract.recognize(image, 'eng', {
        tessedit_char_whitelist: whitelist,
        tessedit_pageseg_mode: psm
    } as any);
    return res.data.text.trim();
};

export const performGridScan = async (
    base64Image: string,
    cols: number[],
    rows: number[],
    engine: OCREngine,
    settings: AppSettings,
    onProgress: (msg: string) => void
): Promise<ScanResult> => {

    const sortedCols = [...cols].sort((a,b) => a-b);
    const sortedRows = [...rows].sort((a,b) => a-b);
    const year = settings.defaultYear || new Date().getFullYear().toString();
    const entries: TimeEntry[] = [];

    const totalCells = (sortedRows.length - 1) * sortedCols.length;
    let processed = 0;

    // Load main image to get dimensions for boundary checks
    const img = new Image();
    img.src = base64Image;
    await new Promise(r => img.onload = r);
    const totalW = img.width;

    // Iterate Rows
    for (let r = 0; r < sortedRows.length - 1; r++) {
        const y1 = sortedRows[r];
        const y2 = sortedRows[r+1];
        const h = y2 - y1;
        
        // Skip tiny rows (noise)
        if (h < 20) continue;

        // Iterate Cols
        const allSeparators = [0, ...sortedCols, totalW];
        
        // --- 1. Date Cell (First Column) ---
        const dateCellW = allSeparators[1] - allSeparators[0];
        const dateCellBase64 = await cropCell(base64Image, allSeparators[0], y1, dateCellW, h);
        
        let dateText = "";
        try {
            if (engine === 'paddle') {
                try {
                    dateText = await runPaddleOCR(dateCellBase64, () => {});
                } catch (paddleError) {
                    // Silent Fallback
                    dateText = await runTesseractCell(dateCellBase64, 'line');
                }
            } else {
                dateText = await runTesseractCell(dateCellBase64, 'line');
            }
        } catch (e) { console.warn("Date OCR Error", e); }

        processed++;
        onProgress(`Grid Scan: ${Math.round((processed / totalCells) * 100)}%`);

        // Parse Date
        let dateStr = "";
        if (dateText.match(/([0-3]?\d)[\/\-\.]([0-1]?\d)/)) {
             const parts = dateText.replace(/[^0-9\/\-\.]/g,'').split(/[\/\-\.]/);
             if (parts.length >= 2) dateStr = `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${year}`;
        }

        // --- 2. Time Cells (Remaining Columns) ---
        const times: string[] = [];
        for (let c = 1; c < allSeparators.length - 1; c++) {
            const tx1 = allSeparators[c];
            const tx2 = allSeparators[c+1];
            if (tx2 - tx1 < 10) continue;

            const timeCell = await cropCell(base64Image, tx1, y1, tx2 - tx1, h);
            let timeText = "";
            try {
                 if (engine === 'paddle') {
                    try {
                        timeText = await runPaddleOCR(timeCell, () => {});
                    } catch (paddleError) {
                        timeText = await runTesseractCell(timeCell, 'word');
                    }
                 } else {
                    timeText = await runTesseractCell(timeCell, 'word');
                 }
            } catch {}
            
            times.push(forceTimePattern(timeText));
            processed++;
            onProgress(`Grid Scan: ${Math.round((processed / totalCells) * 100)}%`);
        }

        if (dateStr || times.some(t => t)) {
            entries.push({
                id: `grid-${Date.now()}-${r}`,
                date: dateStr || dateText, // Fallback to raw if regex fails
                entrance: times[0] || "",
                lunchStart: times[1] || "",
                lunchEnd: times[2] || "",
                exit: times[3] || ""
            });
        }
    }

    return {
        entries,
        rawResponse: `Grid Mode processed ${entries.length} rows`,
        debugMeta: { engine, rows: sortedRows, cols: sortedCols }
    };
};
