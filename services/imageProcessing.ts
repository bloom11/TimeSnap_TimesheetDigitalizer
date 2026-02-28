
import { Point, RegionOfInterest } from '../types';

export interface ImageTuningParams {
    brightness: number; // -100 to 100
    contrast: number;   // -100 to 100
    sharpen: boolean;
    grayscale: boolean;
    binarize?: boolean; // New: Force black/white thresholding
}

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
};

// Otsu's Method for automatic thresholding
const getOtsuThreshold = (data: Uint8ClampedArray): number => {
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) {
        // Use green channel or avg for brightness
        const val = Math.round((data[i] + data[i+1] + data[i+2]) / 3);
        histogram[val]++;
    }

    let total = data.length / 4;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * histogram[i];

    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let maxVar = 0;
    let threshold = 0;

    for (let t = 0; t < 256; t++) {
        wB += histogram[t];
        if (wB === 0) continue;
        wF = total - wB;
        if (wF === 0) break;

        sumB += t * histogram[t];
        let mB = sumB / wB;
        let mF = (sum - sumB) / wF;

        let varBetween = wB * wF * (mB - mF) * (mB - mF);
        if (varBetween > maxVar) {
            maxVar = varBetween;
            threshold = t;
        }
    }
    return threshold;
};

export const applyTuningToCanvas = (canvas: HTMLCanvasElement, params: ImageTuningParams, zones?: RegionOfInterest[]) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { brightness, contrast, sharpen, grayscale, binarize } = params;
    
    // 1. If zones exist, we black out everything else first to focus the OCR
    if (zones && zones.length > 0) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tCtx = tempCanvas.getContext('2d')!;
        tCtx.drawImage(canvas, 0, 0);
        
        ctx.fillStyle = 'white'; // White background for Tesseract is better than black
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        zones.forEach(zone => {
            ctx.drawImage(
                tempCanvas, 
                zone.x, zone.y, zone.w, zone.h,
                zone.x, zone.y, zone.w, zone.h
            );
        });
    }

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    // Apply Contrast & Brightness
    const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const brightnessOffset = brightness;

    for (let i = 0; i < data.length; i += 4) {
        // Skip purely masked pixels if using zones (though we painted white above)
        
        let r = data[i];
        let g = data[i+1];
        let b = data[i+2];

        // Brightness
        r += brightnessOffset;
        g += brightnessOffset;
        b += brightnessOffset;

        // Contrast
        r = contrastFactor * (r - 128) + 128;
        g = contrastFactor * (g - 128) + 128;
        b = contrastFactor * (b - 128) + 128;

        // Clamp
        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));

        if (grayscale || binarize) {
            const avg = (r + g + b) / 3;
            data[i] = data[i+1] = data[i+2] = avg;
        } else {
            data[i] = r;
            data[i+1] = g;
            data[i+2] = b;
        }
    }

    if (binarize) {
        const threshold = getOtsuThreshold(data);
        for (let i = 0; i < data.length; i += 4) {
            const avg = data[i]; // already grayscaled above
            const val = avg > threshold ? 255 : 0;
            data[i] = data[i+1] = data[i+2] = val;
        }
    }

    if (sharpen && !binarize) {
        const weights = [0, -1, 0, -1, 5, -1, 0, -1, 0];
        const side = 3;
        const w = canvas.width;
        const h = canvas.height;
        const copy = new Uint8ClampedArray(data);

        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const dstOff = (y * w + x) * 4;
                
                let r = 0, g = 0, b = 0;
                for (let cy = 0; cy < side; cy++) {
                    for (let cx = 0; cx < side; cx++) {
                        const scy = y + cy - 1;
                        const scx = x + cx - 1;
                        const srcOff = (scy * w + scx) * 4;
                        const wt = weights[cy * side + cx];
                        r += copy[srcOff] * wt;
                        g += copy[srcOff + 1] * wt;
                        b += copy[srcOff + 2] * wt;
                    }
                }
                data[dstOff] = Math.min(255, Math.max(0, r));
                data[dstOff + 1] = Math.min(255, Math.max(0, g));
                data[dstOff + 2] = Math.min(255, Math.max(0, b));
            }
        }
    }

    ctx.putImageData(imgData, 0, 0);
};

export const performPerspectiveWarp = async (
    imageSrc: string, 
    corners: Point[]
): Promise<string> => {
    const img = await loadImage(imageSrc);
    
    // Calculate new dimensions
    const width = Math.max(
        Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y),
        Math.hypot(corners[2].x - corners[3].x, corners[2].y - corners[3].y)
    );
    const height = Math.max(
        Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y),
        Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y)
    );

    const canvas = document.createElement('canvas');
    canvas.width = 2000; 
    canvas.height = Math.round(height * (canvas.width / width));
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return imageSrc;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height); 
    
    return canvas.toDataURL('image/jpeg', 0.95);
};

// Automatic pre-processing for better OCR results without user intervention
export const autoEnhanceImage = async (base64Image: string): Promise<string> => {
    const img = await loadImage(base64Image);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if(!ctx) return base64Image;

    ctx.drawImage(img, 0, 0);
    
    // Auto-apply slight contrast boost and binarization for clear text
    applyTuningToCanvas(canvas, {
        brightness: 5,
        contrast: 20,
        sharpen: true,
        grayscale: true,
        binarize: true 
    });

    return canvas.toDataURL('image/jpeg', 0.9);
};

// Detect Rows for Grid Splitting using Horizontal Projection Profile
export const detectRowSeparators = (base64Image: string): Promise<number[]> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const width = canvas.width;
            const height = canvas.height;
            
            // 1. Calculate Horizontal Projection (Row Density)
            // We sum the "ink" (blackness) per row.
            const rowDensity = new Float32Array(height).fill(0);
            
            for (let y = 0; y < height; y++) {
                let darkPixels = 0;
                for (let x = 0; x < width; x++) {
                    const i = (y * width + x) * 4;
                    // Binarized image assumption: 0=black(text), 255=white(bg)
                    const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
                    if (brightness < 100) { 
                        darkPixels++;
                    }
                }
                rowDensity[y] = darkPixels;
            }
            
            // 2. Find Valleys (Whitespace) vs Peaks (Text)
            const separators: number[] = [];
            
            // We assume a row of text has high density, a gap has low density.
            // We want to place separators in the middle of low density areas.
            const EMPTY_THRESHOLD = width * 0.01; // < 1% pixels are dark
            
            let inGap = true;
            let gapStart = 0;
            
            for (let y = 0; y < height; y++) {
                const isEmpty = rowDensity[y] <= EMPTY_THRESHOLD;
                
                if (isEmpty && !inGap) {
                    // Entered a gap (end of text line)
                    inGap = true;
                    gapStart = y;
                } else if (!isEmpty && inGap) {
                    // Exited a gap (start of text line)
                    inGap = false;
                    const gapHeight = y - gapStart;
                    // Only consider it a separator if the gap is substantial enough (e.g., > 10px)
                    if (gapHeight > 10) {
                        separators.push(Math.floor(gapStart + gapHeight / 2));
                    }
                }
            }
            
            // Add top and bottom if missing
            if (separators.length === 0 || separators[0] > 50) separators.unshift(0);
            if (separators[separators.length - 1] < height - 50) separators.push(height);

            resolve(separators);
        };
        img.src = base64Image;
    });
};

export const cropCell = (
    base64Image: string, 
    x: number, y: number, w: number, h: number
): Promise<string> => {
     return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
            resolve(canvas.toDataURL('image/png'));
        };
        img.src = base64Image;
     });
}
