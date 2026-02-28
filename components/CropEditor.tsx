
import React, { useRef, useState, useEffect } from 'react';
import { Check, X, Move } from 'lucide-react';
import { Point } from '../types';

interface CropEditorProps {
  imageSrc: string;
  onConfirm: (corners: Point[]) => void;
  onCancel: () => void;
}

const MAGNIFIER_SIZE = 100;
const ZOOM_LEVEL = 1.5;

const CropEditor: React.FC<CropEditorProps> = ({ imageSrc, onConfirm, onCancel }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [draggingPoint, setDraggingPoint] = useState<number | null>(null);
  const [imgSize, setImgSize] = useState<{w: number, h: number} | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
        setImgSize({ w: img.width, h: img.height });
        const w = img.width;
        const h = img.height;
        // Default box inset
        setPoints([
            { x: w * 0.15, y: h * 0.15 }, // TL
            { x: w * 0.85, y: h * 0.15 }, // TR
            { x: w * 0.85, y: h * 0.85 }, // BR
            { x: w * 0.15, y: h * 0.85 }, // BL
        ]);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const handlePointerDown = (index: number) => {
    setDraggingPoint(index);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingPoint === null || !containerRef.current || !imgSize) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const scale = imgSize.w / rect.width;
    const actualX = Math.max(0, Math.min(imgSize.w, x * scale));
    const actualY = Math.max(0, Math.min(imgSize.h, y * scale));

    const newPoints = [...points];
    newPoints[draggingPoint] = { x: actualX, y: actualY };
    setPoints(newPoints);
  };

  const handlePointerUp = () => {
    setDraggingPoint(null);
  };

  if (!imgSize || points.length === 0) return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center text-white">
          Loading image...
      </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
      <div className="p-4 bg-slate-800 text-white flex justify-between items-center shrink-0">
         <div>
            <h3 className="font-bold text-lg">Crop Document</h3>
            <p className="text-xs text-slate-400">Drag corners to match the table edges.</p>
         </div>
         <button onClick={onCancel} className="p-2 hover:bg-slate-700 rounded-full">
            <X className="w-6 h-6" />
         </button>
      </div>

      <div 
        className="flex-1 overflow-auto bg-black flex items-center justify-center p-4 touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div 
            ref={containerRef}
            className="relative shadow-2xl bg-black"
            style={{ 
                aspectRatio: `${imgSize.w} / ${imgSize.h}`,
                maxHeight: '80vh',
                maxWidth: '100%'
            }}
        >
            <img 
                src={imageSrc} 
                alt="Source" 
                className="w-full h-full object-contain pointer-events-none opacity-60" 
            />

            {/* Connecting Lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                 {/* Shadow Line for Visibility on Light Backgrounds */}
                <polygon 
                    points={points.map(p => `${(p.x/imgSize.w)*100}% ${(p.y/imgSize.h)*100}%`).join(', ')}
                    fill="rgba(0, 255, 255, 0.05)"
                    stroke="black"
                    strokeWidth="6" 
                    strokeLinecap="round"
                    strokeOpacity="0.5"
                />
                {/* Main Visible Line (Cyan for high contrast) */}
                <polygon 
                    points={points.map(p => `${(p.x/imgSize.w)*100}% ${(p.y/imgSize.h)*100}%`).join(', ')}
                    fill="none"
                    stroke="#06b6d4" 
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray="10, 5"
                />
                {/* Corner Dots */}
                {points.map((p, i) => (
                    <circle 
                        key={i}
                        cx={`${(p.x/imgSize.w)*100}%`}
                        cy={`${(p.y/imgSize.h)*100}%`}
                        r="4"
                        fill="#06b6d4"
                    />
                ))}
            </svg>

            {/* Touch Handles */}
            {points.map((p, idx) => {
                const leftPct = (p.x / imgSize.w) * 100;
                const topPct = (p.y / imgSize.h) * 100;

                return (
                    <div
                        key={idx}
                        className="absolute w-12 h-12 -ml-6 -mt-6 bg-cyan-500/20 border-2 border-cyan-400 rounded-full flex items-center justify-center cursor-move z-10 shadow-[0_0_10px_rgba(0,255,255,0.5)] active:scale-110 transition-transform"
                        style={{ left: `${leftPct}%`, top: `${topPct}%`, touchAction: 'none' }}
                        onPointerDown={(e) => { e.preventDefault(); handlePointerDown(idx); }}
                    >
                        <Move className="w-5 h-5 text-white drop-shadow-md" />
                    </div>
                );
            })}

            {/* Magnifier / Zoom Glass */}
            {draggingPoint !== null && (
                <div 
                    className="absolute pointer-events-none z-50 overflow-hidden border-2 border-white rounded-full shadow-2xl"
                    style={{
                        width: MAGNIFIER_SIZE,
                        height: MAGNIFIER_SIZE,
                        left: `${(points[draggingPoint].x / imgSize.w) * 100}%`,
                        top: `${(points[draggingPoint].y / imgSize.h) * 100}%`,
                        transform: 'translate(-50%, -130%)',
                        backgroundColor: '#000'
                    }}
                >
                    <div 
                        style={{
                            position: 'absolute',
                            width: imgSize.w * ZOOM_LEVEL,
                            height: imgSize.h * ZOOM_LEVEL,
                            left: -(points[draggingPoint].x * ZOOM_LEVEL) + (MAGNIFIER_SIZE / 2),
                            top: -(points[draggingPoint].y * ZOOM_LEVEL) + (MAGNIFIER_SIZE / 2),
                            backgroundImage: `url(${imageSrc})`,
                            backgroundSize: '100% 100%',
                            backgroundRepeat: 'no-repeat'
                        }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-70">
                        <div className="w-0.5 h-3 bg-cyan-400" />
                        <div className="h-0.5 w-3 bg-cyan-400 absolute" />
                    </div>
                </div>
            )}
        </div>
      </div>

      <div className="p-4 bg-slate-800 border-t border-slate-700 flex justify-end">
         <button 
            onClick={() => onConfirm(points)}
            className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20"
         >
            <Check className="w-6 h-6 mr-2" />
            Apply & Scan
         </button>
      </div>
    </div>
  );
};

export default CropEditor;
