
import Tesseract from 'tesseract.js';
import { TimeEntry, AppSettings, OCRWord, OfflineScanData, ScanResult, OCRAlgorithm, RegionOfInterest } from "../types";
import { autoEnhanceImage, detectRowSeparators } from './imageProcessing';

// Enhanced time parsing with broader character substitution for difficult OCR
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

const normalizeText = (text: string): string => {
  return text.trim().replace(/[;,\.]/g, ':').replace(/\|/g, '');
};

const isDate = (text: string): boolean => {
  const clean = text.replace(/\s/g, '');
  return /^([0-3]?\d)[\/\-\.]([0-1]?\d)/.test(clean);
};

const isHeader = (text: string): boolean => {
    const headers = ['entrata', 'uscita', 'inizio', 'fine', 'pausa', 'pranzo', 'ingresso', 'in', 'out', 'break', 'data', 'giorno'];
    const norm = text.toLowerCase();
    return headers.some(h => norm.includes(h));
};

export const performOCR = async (
    base64Image: string, 
    onProgress: (status: string) => void,
    algorithm: OCRAlgorithm = 'neural'
): Promise<OfflineScanData> => {
    try {
        // 1. Transparently enhance image for better results unless raw is requested
        let processImage = base64Image;
        if (algorithm !== 'raw_matrix') {
             onProgress("Optimizing image contrast...");
             processImage = await autoEnhanceImage(base64Image);
        }

        onProgress(`Initializing ${algorithm} Engine...`);
        
        // 2. Select Page Segmentation Mode based on Algorithm
        // PSM 3: Auto (Default)
        // PSM 6: Assume a single uniform block of text (Matrix/Grid)
        // PSM 11: Sparse text. Find as much text as possible in no particular order.
        let psm = Tesseract.PSM.AUTO;
        if (algorithm === 'sparse') psm = Tesseract.PSM.SPARSE_TEXT;
        if (algorithm === 'raw_matrix') psm = Tesseract.PSM.SINGLE_BLOCK;

        const workerOptions: any = {
          tessedit_pageseg_mode: psm,
          preserve_interword_spaces: '1',
          // Whitelist helps avoid random noise characters
          tessedit_char_whitelist: '0123456789:/-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.',
          logger: (m: any) => {
              if (m.status === 'recognizing text') {
                  onProgress(`Analyzing Layout... ${Math.round(m.progress * 100)}%`);
              }
          }
        };

        const result = await Tesseract.recognize(processImage, 'eng', workerOptions);
        const data = result.data as any;
        
        const img = new Image();
        img.src = processImage;
        await new Promise(r => img.onload = r);
        const width = img.width;
        const height = img.height;

        if (!data.lines || data.lines.length === 0) {
             // If we failed with processed image, fallback to raw just in case enhancement killed it
             if (processImage !== base64Image) {
                 return performOCR(base64Image, onProgress, 'sparse');
             }
             throw new Error("No text found. Ensure image is clear.");
        }

        const allWords = data.lines.reduce((acc: any, line: any) => acc.concat(line.words), [] as any[]);
        
        const words: OCRWord[] = allWords.map((w: any) => ({
            text: w.text, 
            bbox: w.bbox,
            type: 'unknown',
            centerX: (w.bbox.x0 + w.bbox.x1) / 2,
            centerY: (w.bbox.y0 + w.bbox.y1) / 2
        }));

        // 3. Smart Grid Detection (Columns & Rows)
        
        // Detect Columns via vertical projection (histogram of X centers)
        const binSize = Math.max(10, width / 100); 
        const numBins = Math.ceil(width / binSize);
        const hist = new Array(numBins).fill(0);
        words.filter(w => /\d/.test(w.text) || w.text.length > 2).forEach(w => hist[Math.floor(w.centerX / binSize)]++);

        const peaks: number[] = [];
        // Smoothing
        const smoothHist = hist.map((val, i, arr) => {
             const prev = arr[i-1] || 0;
             const next = arr[i+1] || 0;
             return (prev + val + next) / 3;
        });

        const threshold = Math.max(...smoothHist) * 0.25;
        for (let i = 1; i < smoothHist.length - 1; i++) {
            if (smoothHist[i] > threshold && smoothHist[i] > smoothHist[i-1] && smoothHist[i] > smoothHist[i+1]) {
                peaks.push(i * binSize + binSize/2);
            }
        }
        
        // Detect Rows via Image Analysis (Horizontal Whitespace)
        const detectedRows = await detectRowSeparators(processImage);

        return {
            words,
            imageWidth: width,
            imageHeight: height,
            base64Image: processImage, // Return the enhanced image so the UI shows what the OCR saw
            suggestedColumns: peaks.sort((a,b) => a-b).slice(0, 6),
            suggestedRows: detectedRows
        };

    } catch (err) {
        console.error("OCR Failed", err);
        throw err;
    }
};

export const mapWordsToEntries = (
    scanData: OfflineScanData, 
    columnXPositions: number[],
    settings?: AppSettings
): ScanResult => {
    const { words } = scanData;
    const sortedColXs = [...columnXPositions].sort((a, b) => a - b);
    
    const LEFT_REACH = scanData.imageWidth * 0.12; 
    const RIGHT_REACH = scanData.imageWidth * 0.05; 

    const avgHeight = words.reduce((sum, w) => sum + (w.bbox.y1 - w.bbox.y0), 0) / (words.length || 1);
    const ROW_HEIGHT_TOLERANCE = Math.max(20, avgHeight * 0.8); 

    // Bucket words into columns
    const colBuckets: OCRWord[][] = Array.from({ length: sortedColXs.length }, () => []);
    
    words.forEach(w => {
        if (w.text.length < 1) return;
        for (let i = 0; i < sortedColXs.length; i++) {
            const diff = sortedColXs[i] - w.centerX;
            if (diff >= -RIGHT_REACH && diff <= LEFT_REACH) {
                colBuckets[i].push(w);
                break;
            }
        }
    });

    // Detect rows by clustering Y positions of words in the first few columns
    const allYs = colBuckets.flat().map(w => w.centerY).sort((a,b) => a - b);
    const rowCenters: number[] = [];
    
    if (allYs.length > 0) {
        let currentClusterY = allYs[0];
        let clusterSum = currentClusterY;
        let clusterCount = 1;
        
        for (let i = 1; i < allYs.length; i++) {
            if (Math.abs(allYs[i] - (clusterSum / clusterCount)) < ROW_HEIGHT_TOLERANCE) {
                clusterSum += allYs[i];
                clusterCount++;
            } else {
                rowCenters.push(clusterSum / clusterCount);
                clusterSum = allYs[i];
                clusterCount = 1;
            }
        }
        rowCenters.push(clusterSum / clusterCount);
    }

    const entries: TimeEntry[] = [];
    const year = settings?.defaultYear || new Date().getFullYear().toString();

    rowCenters.forEach((y, rowIdx) => {
        // Find date in first column
        const dateWord = colBuckets[0]?.find(w => Math.abs(w.centerY - y) < ROW_HEIGHT_TOLERANCE * 1.5);
        let dateStr = "";
        
        if (dateWord) {
             const norm = normalizeText(dateWord.text);
             if (isDate(norm)) {
                 const parts = norm.split(/[\/\-\.]/);
                 // Heuristic: If day/month are inverted, try to standardize, but basic usually works
                 dateStr = `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${year}`;
             } else {
                 dateStr = dateWord.text.substring(0, 10); 
             }
        }

        // Find times in subsequent columns
        const times = sortedColXs.slice(1).map((_, idx) => {
             // Look for a word in this column bucket that is vertically aligned with the row center
             const word = colBuckets[idx + 1]?.find(w => Math.abs(w.centerY - y) < ROW_HEIGHT_TOLERANCE * 1.5);
             return word ? forceTimePattern(word.text) : "";
        });

        if (isHeader([dateStr, ...times].join(' '))) return;
        // Filter empty rows
        if (!dateStr && times.every(t => !t)) return;

        entries.push({
            id: `offline-${Date.now()}-${rowIdx}`,
            date: dateStr,
            entrance: times[0] || "",
            lunchStart: times[1] || "",
            lunchEnd: times[2] || "",
            exit: times[3] || ""
        });
    });

    return {
        entries,
        rawResponse: "Enhanced Multi-Pass Matrix Scan",
        debugMeta: { columns: sortedColXs }
    };
};
