import React, { useState, useRef, useEffect } from 'react';
import { Grip, X } from 'lucide-react';

interface DraggableMenuProps {
  icon: React.ReactNode;
  children: React.ReactNode;
  onDisableDraggable: () => void;
}

export default function DraggableMenu({ icon, children, onDisableDraggable }: DraggableMenuProps) {
  const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight / 2 });
  const [isDragging, setIsDragging] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
    };
    setIsDragging(true);
    // Don't close or open immediately, wait for pointer up to decide if it was a click or drag
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging || !dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    
    // If dragged more than 5px, it's a drag, not a click
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      setIsOpen(false); // Close menu while dragging
    }

    setPosition({
      x: Math.max(0, Math.min(window.innerWidth - 56, dragRef.current.initialX + dx)),
      y: Math.max(0, Math.min(window.innerHeight - 56, dragRef.current.initialY + dy)),
    });
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (!isDragging || !dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    
    // If it was a small movement, treat as click
    if (Math.abs(dx) <= 5 && Math.abs(dy) <= 5) {
      setIsOpen(!isOpen);
    }
    
    setIsDragging(false);
    dragRef.current = null;
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging]);

  return (
    <>
      <div
        className="fixed z-[100] w-14 h-14 bg-indigo-600 text-white rounded-2xl shadow-xl flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
        style={{ left: position.x, top: position.y }}
        onPointerDown={handlePointerDown}
      >
        {isOpen ? <X className="w-6 h-6" /> : icon}
      </div>

      {isOpen && (
        <div 
          className="fixed z-[90] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 flex flex-col gap-2 w-48"
          style={{
            // Position the menu near the cube, but keep it on screen
            left: Math.min(position.x, window.innerWidth - 200),
            top: Math.min(position.y + 60, window.innerHeight - 300),
          }}
        >
          <div className="flex justify-between items-center px-2 pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">
            <span className="text-xs font-semibold text-slate-500">Actions</span>
            <button onClick={onDisableDraggable} className="text-xs text-blue-500 hover:text-blue-600">
              Dock
            </button>
          </div>
          {children}
        </div>
      )}
    </>
  );
}
