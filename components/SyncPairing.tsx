
import React, { useEffect, useRef, useState } from 'react';
import { Smartphone, Monitor, Loader2, X, Camera, AlertCircle, Upload, Maximize } from 'lucide-react';
import jsQR from 'jsqr';
import { SyncService } from '../services/syncService';
import { getSettings } from '../services/settingsService';

interface SyncPairingProps {
    mode: 'host' | 'client';
    onConnect: (service: SyncService) => void;
    onCancel: () => void;
}

const SyncPairing: React.FC<SyncPairingProps> = ({ mode, onConnect, onCancel }) => {
    const [status, setStatus] = useState("Initializing...");
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [service, setService] = useState<SyncService | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isZoomed, setIsZoomed] = useState(false);
    
    // Client Scanning
    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [scanning, setScanning] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);

    useEffect(() => {
        const settings = getSettings();
        const svc = new SyncService(
            (msg, connected) => {
                setStatus(msg);
                if (connected && mode === 'host') {
                    // Slight delay to show success before completing
                    setTimeout(() => onConnect(svc), 800);
                }
            },
            (data) => {
                console.log("Data received during pairing", data);
            },
            settings.debugMode
        );
        setService(svc);

        if (mode === 'host') {
            svc.initializeHost().then(async (id) => {
                const url = await SyncService.generateQRCode(id);
                setQrCodeUrl(url);
            }).catch(err => {
                setError("Failed to start server. Are you offline?");
            });
        }

        return () => {
            // Clean up is handled by parent App.tsx or explicit disconnect
        };
    }, []);

    const handleQrCodeDetected = (data: string) => {
        setScanning(false);
        setStatus("Found PC! Negotiating link...");
        service?.initializeClient(data).then(() => {
            onConnect(service);
        }).catch((err) => {
            console.error("Client Init Error", err);
            setStatus("Connection failed. Try again.");
            setScanning(true); // Resume scanning
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setStatus("Reading image file...");
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    ctx.drawImage(img, 0, 0);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const code = jsQR(imageData.data, imageData.width, imageData.height);
                    
                    if (code) {
                        handleQrCodeDetected(code.data);
                    } else {
                        setStatus("No QR code found in image.");
                        setError("Could not find a valid QR code in the selected image.");
                        setTimeout(() => setError(null), 3000);
                    }
                }
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    // Client Scan Logic
    useEffect(() => {
        if (mode !== 'client' || !scanning) return;
        
        let stream: MediaStream | null = null;
        let animationId: number;
        
        const startScan = async () => {
            setCameraError(null);
            try {
                stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } 
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.setAttribute("playsinline", "true");
                    videoRef.current.play();
                    requestAnimationFrame(tick);
                }
            } catch (e: any) {
                if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
                    setCameraError("Camera access was denied. Please click the lock icon 🔒 in your browser's address bar to allow access, or refresh the page to reset permissions.");
                } else {
                    setCameraError("Camera not available. Please check your device permissions.");
                }
                setScanning(false);
            }
        };

        const tick = () => {
            if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                const canvas = document.createElement("canvas");
                canvas.width = videoRef.current.videoWidth;
                canvas.height = videoRef.current.videoHeight;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const code = jsQR(imageData.data, imageData.width, imageData.height);
                    
                    if (code) {
                        handleQrCodeDetected(code.data);
                        return;
                    }
                }
            }
            if (scanning) animationId = requestAnimationFrame(tick);
        };

        startScan();

        return () => {
            if (stream) stream.getTracks().forEach(t => t.stop());
            cancelAnimationFrame(animationId);
        };
    }, [scanning, mode, service]);

    if (mode === 'host') {
        return (
            <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full animate-fade-in border border-slate-200 dark:border-slate-700">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full mb-4">
                    <Monitor className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Connect Phone</h2>
                <p className="text-slate-500 dark:text-slate-400 text-center text-sm mb-6">
                    Scan this QR code with your phone camera to link devices.
                </p>

                {error ? (
                    <div className="flex flex-col items-center p-6 text-red-600 dark:text-red-400">
                        <AlertCircle className="w-12 h-12 mb-2" />
                        <p className="text-center font-medium">{error}</p>
                        <button onClick={() => window.location.reload()} className="mt-4 text-blue-600 underline">Retry</button>
                    </div>
                ) : qrCodeUrl ? (
                    <>
                        <div 
                            className="p-4 bg-white rounded-xl border-2 border-slate-100 dark:border-slate-800 shadow-inner mb-6 transition-all scale-100 hover:scale-[1.02] cursor-pointer relative group"
                            onClick={() => setIsZoomed(true)}
                        >
                            <img src={qrCodeUrl} alt="Scan to Connect" className="w-48 h-48" />
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                                <Maximize className="w-8 h-8 text-white" />
                            </div>
                        </div>
                        {isZoomed && (
                            <div 
                                className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-pointer animate-fade-in"
                                onClick={() => setIsZoomed(false)}
                            >
                                <div className="bg-white p-8 rounded-3xl max-w-full max-h-full">
                                    <img src={qrCodeUrl} alt="Scan to Connect" className="w-[80vw] max-w-[500px] h-auto object-contain" />
                                    <p className="text-center text-slate-500 mt-4 font-bold uppercase tracking-widest text-sm">Tap anywhere to close</p>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="w-48 h-48 flex flex-col items-center justify-center mb-6 bg-slate-50 dark:bg-slate-800 rounded-xl">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Setting up</span>
                    </div>
                )}

                <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 mb-6 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-full">
                    <div className={`w-2 h-2 rounded-full ${status.includes('Connected') ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-yellow-500 animate-pulse'}`} />
                    {status}
                </div>

                <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm transition-colors">Cancel & Go Back</button>
            </div>
        );
    }

    // Client Mode
    return (
        <div className="flex flex-col items-center justify-center p-4 bg-black/90 fixed inset-0 z-50 animate-fade-in">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800">
                 <div className="p-4 bg-slate-50 dark:bg-slate-800 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
                     <h3 className="font-bold text-slate-800 dark:text-white flex items-center">
                         <Camera className="w-4 h-4 mr-2 text-blue-600" /> Pairing Camera
                     </h3>
                     <button onClick={onCancel} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                 </div>
                 
                 {error && !scanning ? (
                    <div className="p-8 text-center space-y-4">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                        <p className="text-slate-800 dark:text-white font-medium text-sm">{error}</p>
                        <div className="flex flex-col gap-2">
                            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-slate-800 text-white rounded-lg font-bold">Reload Page</button>
                            <button onClick={() => setScanning(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">Retry Camera</button>
                            <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg">Choose Another Image</button>
                        </div>
                    </div>
                 ) : (
                    <>
                        <div className="relative aspect-square bg-black group">
                            {scanning ? (
                                <>
                                    <video ref={videoRef} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 border-2 border-blue-500/50 m-12 rounded-3xl flex items-center justify-center">
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Target</div>
                                        <p className="text-white/80 text-xs font-medium bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-md">Align QR Code</p>
                                    </div>
                                </>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400 p-8 text-center">
                                    {cameraError ? (
                                        <div className="bg-amber-900/40 border border-amber-700 p-6 rounded-2xl max-w-sm">
                                            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                                            <h3 className="text-amber-400 font-bold mb-2">Camera Blocked</h3>
                                            <p className="text-amber-200/70 text-sm mb-6">{cameraError}</p>
                                            <div className="flex flex-col gap-2">
                                                <button 
                                                    onClick={() => window.location.reload()}
                                                    className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-all"
                                                >
                                                    Reload Page to Show Prompt Again
                                                </button>
                                                <button 
                                                    onClick={() => setScanning(true)}
                                                    className="px-6 py-2 border border-amber-700 text-amber-400 hover:bg-amber-900/50 rounded-xl font-bold transition-all"
                                                >
                                                    I've enabled it, try again
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="bg-blue-600/20 p-6 rounded-full mb-6">
                                                <Camera className="w-12 h-12 text-blue-500" />
                                            </div>
                                            <h3 className="text-white font-bold mb-2">Ready to Scan?</h3>
                                            <p className="text-sm mb-8 opacity-60">Click the button below to start your camera and scan the QR code on your computer.</p>
                                            <button 
                                                onClick={() => setScanning(true)}
                                                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all active:scale-95"
                                            >
                                                Start Camera
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="p-4 flex flex-col gap-3 bg-slate-50 dark:bg-slate-900">
                            <div className="flex items-center justify-center gap-3 py-2">
                                {status.includes('Negotiating') || status.includes('Initializing') ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> : null}
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{status}</p>
                            </div>
                            
                            <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                ref={fileInputRef} 
                                onChange={handleFileChange} 
                            />
                            
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-sm"
                            >
                                <Upload className="w-4 h-4" />
                                Upload QR Screenshot
                            </button>
                        </div>
                    </>
                 )}
            </div>
        </div>
    );
};

export default SyncPairing;
