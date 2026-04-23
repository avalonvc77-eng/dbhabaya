import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageZoomProps {
  src: string;
  alt?: string;
  className?: string;
  thumbnailClassName?: string;
}

export function ImageZoom({ src, alt = '', className, thumbnailClassName }: ImageZoomProps) {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);

  const zoomIn = () => setScale(s => Math.min(s + 0.5, 4));
  const zoomOut = () => setScale(s => Math.max(s - 0.5, 0.5));

  return (
    <>
      <img
        src={src}
        alt={alt}
        className={`cursor-zoom-in ${thumbnailClassName || className || ''}`}
        onClick={() => { setOpen(true); setScale(1); }}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden bg-black/90 border-none">
          <div className="absolute top-3 right-3 z-50 flex gap-2">
            <Button variant="secondary" size="icon" className="h-8 w-8" onClick={zoomIn}><ZoomIn className="w-4 h-4" /></Button>
            <Button variant="secondary" size="icon" className="h-8 w-8" onClick={zoomOut}><ZoomOut className="w-4 h-4" /></Button>
            <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}><X className="w-4 h-4" /></Button>
          </div>
          <div className="flex items-center justify-center w-full h-[80vh] overflow-auto p-4">
            <img
              src={src}
              alt={alt}
              className="max-w-none transition-transform duration-200"
              style={{ transform: `scale(${scale})` }}
              draggable={false}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
