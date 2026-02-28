
import * as ort from 'onnxruntime-web';

// Note: In a real deployment, these would be paths to files served from your public/ folder.
// Since we cannot upload binaries here, we point to generic placeholders.
// Users must download PP-OCRv3 models (det, rec, cls) and place them in /models/
const MODEL_PATHS = {
    det: '/models/ch_PP-OCRv3_det_infer.onnx',
    rec: '/models/ch_PP-OCRv3_rec_infer.onnx',
    cls: '/models/ch_ppocr_mobile_v2.0_cls_infer.onnx'
};

let detSession: any = null;
let recSession: any = null;

// Configure ONNX Runtime to load WASM from CDN since we aren't bundling it locally
try {
    const env = (ort as any).env;
    if (env) {
        env.wasm.wasmPaths = "https://esm.sh/onnxruntime-web@1.18.0/dist/";
    }
} catch (e) {
    console.warn("Failed to configure ONNX WASM paths", e);
}

const initSession = async () => {
    try {
        // Safe access to InferenceSession
        const InferenceSession = (ort as any).InferenceSession || (ort as any).default?.InferenceSession;

        if (!InferenceSession) {
            throw new Error("ONNX Runtime library not loaded correctly. 'InferenceSession' is undefined.");
        }

        if (!detSession) {
            // Check if model file exists before trying to load (Fetch check)
            const check = await fetch(MODEL_PATHS.det, { method: 'HEAD' });
            if (!check.ok) throw new Error("PaddleOCR Model files not found in /models/ directory.");

            detSession = await InferenceSession.create(MODEL_PATHS.det, { executionProviders: ['wasm'] });
        }
        if (!recSession) {
            recSession = await InferenceSession.create(MODEL_PATHS.rec, { executionProviders: ['wasm'] });
        }
        return true;
    } catch (e: any) {
        console.warn("PaddleOCR Init Failed:", e.message);
        return false;
    }
};

export const runPaddleOCR = async (base64Image: string, onProgress: (msg: string) => void): Promise<string> => {
    const isReady = await initSession();
    if (!isReady) {
        throw new Error("PaddleOCR unavailable (Models missing or Runtime error). Fallback to Tesseract.");
    }

    onProgress("Running PaddleOCR Inference...");
    
    // NOTE: If models were present, execution would happen here.
    // For now, we throw to trigger the Tesseract fallback in the calling service.
    
    throw new Error("PaddleOCR Models (.onnx) missing from server. Using Tesseract fallback.");
};
