import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Upload, X, ImagePlus, Loader2 } from 'lucide-react';

interface Props {
  productId: string;
  images: { id: string; image_url: string; display_order: number }[];
  onImagesChange: () => void;
}

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '';

export function ProductImageUpload({ productId, images, onImagesChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadToCloudinary = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', 'dubai-borka-house');

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Cloudinary আপলোড ব্যর্থ');
    const data = await res.json();
    return data.secure_url;
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      toast.error('Cloudinary কনফিগারেশন সেট করা হয়নি');
      return;
    }

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const url = await uploadToCloudinary(files[i]);
        
        // Save to product_images table
        const { error } = await supabase.from('product_images').insert({
          product_id: productId,
          image_url: url,
          display_order: images.length + i,
        });
        if (error) throw error;

        // Set first image as main product image if none exists
        if (images.length === 0 && i === 0) {
          await supabase.from('products').update({ image_url: url }).eq('id', productId);
        }
      }
      toast.success(`${files.length}টি ছবি আপলোড হয়েছে`);
      onImagesChange();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const deleteImage = async (imageId: string, imageUrl: string) => {
    const { error } = await supabase.from('product_images').delete().eq('id', imageId);
    if (error) { toast.error(error.message); return; }
    // If deleted image was main, set next one or null
    const remaining = images.filter(i => i.id !== imageId);
    await supabase.from('products').update({ image_url: remaining[0]?.image_url || null }).eq('id', productId);
    toast.success('ছবি মুছে ফেলা হয়েছে');
    onImagesChange();
  };

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
          {uploading ? 'আপলোড হচ্ছে...' : 'ছবি আপলোড'}
        </Button>
        {images.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={() => setGalleryOpen(true)}>
            <ImagePlus className="w-3 h-3 mr-1" />গ্যালারি ({images.length})
          </Button>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 0 && (
        <div className="flex gap-2 mt-2 flex-wrap">
          {images.slice(0, 4).map(img => (
            <img key={img.id} src={img.image_url} alt="" className="w-12 h-12 rounded object-cover border cursor-pointer" onClick={() => setGalleryOpen(true)} />
          ))}
          {images.length > 4 && <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-xs cursor-pointer" onClick={() => setGalleryOpen(true)}>+{images.length - 4}</div>}
        </div>
      )}

      {/* Gallery Dialog */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>প্রোডাক্ট গ্যালারি</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            {images.map(img => (
              <div key={img.id} className="relative group">
                <img src={img.image_url} alt="" className="w-full aspect-square object-cover rounded-lg" />
                <button onClick={() => deleteImage(img.id, img.image_url)} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            আরো ছবি যুক্ত করুন
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
