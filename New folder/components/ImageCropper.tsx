'use client';
import { useState } from 'react';
import { ZoomIn, ZoomOut, Move } from 'lucide-react';

export default function ImageCropper({ imageUrl, initialPos, initialZoom, onSave }: { imageUrl: string, initialPos: string, initialZoom: number, onSave: (pos: string, zoom: number) => void }) {
  // Parsing string "x% y%" ke object {x, y}
  const defaultX = parseInt(initialPos?.split(' ')[0] || '50');
  const defaultY = parseInt(initialPos?.split(' ')[1] || '50');

  const [zoom, setZoom] = useState(initialZoom || 1);
  const [position, setPosition] = useState({ x: defaultX, y: defaultY });
  const [isSaved, setIsSaved] = useState(false);

  const handleDrag = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsSaved(false);
    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const startPos = { ...position };

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : (moveEvent as MouseEvent).clientX;
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : (moveEvent as MouseEvent).clientY;
      
      const dx = ((currentX - startX) / 200) * 100;
      const dy = ((currentY - startY) / 100) * 100;
      
      setPosition({
        x: Math.max(0, Math.min(100, startPos.x - dx)),
        y: Math.max(0, Math.min(100, startPos.y - dy))
      });
    };

    const onEnd = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onEnd);
  };

  return (
    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mt-3 animate-in fade-in">
      <p className="text-[10px] text-gray-500 mb-2 flex items-center gap-1"><Move className="w-3 h-3"/> Geser gambar untuk mengatur posisi</p>
      
      <div 
        className="relative w-full h-40 bg-gray-200 rounded-lg overflow-hidden cursor-move touch-none"
        onMouseDown={handleDrag}
        onTouchStart={handleDrag}
      >
        <img 
          src={imageUrl} 
          alt="Preview" 
          className="absolute w-full h-full object-cover pointer-events-none"
          style={{ 
            objectPosition: `${position.x}% ${position.y}%`,
            transform: `scale(${zoom})`,
            transformOrigin: `${position.x}% ${position.y}%`
          }} 
        />
      </div>

      <div className="flex items-center gap-2 mt-3">
        <ZoomOut className="w-4 h-4 text-gray-500" />
        <input type="range" min="1" max="3" step="0.1" value={zoom} onChange={(e) => { setZoom(Number(e.target.value)); setIsSaved(false); }} className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer" />
        <ZoomIn className="w-4 h-4 text-gray-500" />
      </div>

      <button 
        type="button" 
        onClick={() => { onSave(`${position.x}% ${position.y}%`, zoom); setIsSaved(true); }}
        className={`w-full mt-3 font-bold py-2 rounded-lg text-xs transition-all ${isSaved ? 'bg-green-500 text-white' : 'bg-teal-600 text-white hover:bg-teal-700'}`}
      >
        {isSaved ? 'Posisi Tersimpan!' : 'Terapkan Posisi'}
      </button>
    </div>
  );
}