import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, Check, RotateCw, Image as ImageIcon } from 'lucide-react';

interface PhotoCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  onCropComplete: (croppedDataUrl: string) => void;
  onClose: () => void;
}

export const PhotoCropModal: React.FC<PhotoCropModalProps> = ({
  isOpen,
  imageSrc,
  onCropComplete,
  onClose,
}) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Crop frame dimensions: 4:5 aspect ratio
  const CROP_WIDTH = 240;
  const CROP_HEIGHT = 300;

  useEffect(() => {
    if (!isOpen || !imageSrc) return;
    setZoom(1);
    setPosition({ x: 0, y: 0 });

    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = imageSrc;
  }, [isOpen, imageSrc]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom((prev) => Math.min(3, Math.max(0.6, prev + delta)));
  };

  const handleConfirmCrop = () => {
    const img = new Image();
    img.onload = () => {
      const targetWidth = 300;
      const targetHeight = 375; // 4:5 ratio
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Background fill in case of borders
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      // Scale factor from preview frame to export canvas
      const scaleToCanvas = targetWidth / CROP_WIDTH;

      // Draw image with current pan and zoom
      // In the crop frame, image is centered + position, scaled by zoom
      const baseScale = Math.max(CROP_WIDTH / img.naturalWidth, CROP_HEIGHT / img.naturalHeight);
      const effectiveZoom = baseScale * zoom;

      const drawWidth = img.naturalWidth * effectiveZoom * scaleToCanvas;
      const drawHeight = img.naturalHeight * effectiveZoom * scaleToCanvas;

      const centerX = (targetWidth / 2) + (position.x * scaleToCanvas);
      const centerY = (targetHeight / 2) + (position.y * scaleToCanvas);

      const drawX = centerX - (drawWidth / 2);
      const drawY = centerY - (drawHeight / 2);

      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

      const croppedUrl = canvas.toDataURL('image/jpeg', 0.92);
      onCropComplete(croppedUrl);
      onClose();
    };
    img.src = imageSrc;
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#0F172A] border border-amber-500/40 rounded-xl shadow-2xl overflow-hidden flex flex-col text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-[#090D16] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-white font-cinzel">
              Crop Member Photo (4:5 Portrait)
            </h4>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewport & Drag Canvas */}
        <div
          ref={containerRef}
          onWheel={handleWheel}
          className="relative h-80 bg-black flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleMouseDown}
        >
          {/* Active Image */}
          {imageSize.width > 0 && (
            <div
              className="absolute pointer-events-none transition-none"
              style={{
                transform: `translate(${position.x}px, ${position.y}px)`,
              }}
            >
              <img
                src={imageSrc}
                alt="Source preview"
                className="max-none"
                style={{
                  width: `${Math.max(CROP_WIDTH, imageSize.width * Math.max(CROP_WIDTH / imageSize.width, CROP_HEIGHT / imageSize.height) * zoom)}px`,
                  display: 'block',
                }}
                draggable={false}
              />
            </div>
          )}

          {/* Mask Overlay with 4:5 Cutout */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Cutout border */}
            <div
              className="rounded border-2 border-amber-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] relative"
              style={{ width: `${CROP_WIDTH}px`, height: `${CROP_HEIGHT}px` }}
            >
              {/* Corner indicators */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-amber-300" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-amber-300" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-amber-300" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-amber-300" />

              {/* Grid guide */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-20">
                <div className="border-r border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-b border-white" />
                <div className="border-r border-white" />
                <div className="border-r border-white" />
                <div />
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="px-5 py-3 bg-[#090D16] border-t border-slate-800 space-y-3">
          {/* Zoom Slider */}
          <div className="flex items-center gap-3 text-xs">
            <ZoomOut className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="range"
              min="0.6"
              max="2.5"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-amber-500 cursor-pointer"
            />
            <ZoomIn className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-[11px] font-mono text-slate-400 w-10 text-right">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-slate-400">
              Drag to pan · Scroll to zoom · Target 300 × 375 px
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCrop}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply Crop</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoCropModal;
