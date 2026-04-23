import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, Loader2, X, ImagePlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import type { Branch, Category, Product } from '@/types';

interface Props {
  isAdmin: boolean;
  userBranchId: string | null;
  branches: Branch[];
  categories: Category[];
  editProduct: Product | null;
  existingImages: { id: string; image_url: string; display_order: number }[];
  onSubmit: (productData: any, imageUrls: string[]) => Promise<void>;
  onCancel: () => void;
}

let cachedConfig: { cloud_name: string; upload_preset: string } | null = null;

async function getCloudinaryConfig() {
  if (cachedConfig) return cachedConfig;
  const { data, error } = await supabase.functions.invoke('cloudinary-config');
  if (error || !data?.cloud_name) throw new Error('Cloudinary কনফিগারেশন পাওয়া যায়নি');
  cachedConfig = data;
  return data;
}

export function ProductForm({ isAdmin, userBranchId, branches, categories, editProduct, existingImages, onSubmit, onCancel }: Props) {
  const emptyForm = {
    name: '', category_id: '', branch_id: '', description: '',
    buy_price: '', sell_price: '', quantity: '', min_stock: '5',
    size: '', color: '', status: 'active'
  };

  const [form, setForm] = useState(() => {
    if (editProduct) {
      return {
        name: editProduct.name, category_id: editProduct.category_id || '', branch_id: editProduct.branch_id,
        description: editProduct.description || '', buy_price: String(editProduct.buy_price), sell_price: String(editProduct.sell_price),
        quantity: String(editProduct.quantity), min_stock: String(editProduct.min_stock), size: editProduct.size || '', color: editProduct.color || '', status: editProduct.status
      };
    }
    return emptyForm;
  });

  // For new products: URLs uploaded to Cloudinary but not yet saved to DB
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadToCloudinary = async (file: File): Promise<string> => {
    const config = await getCloudinaryConfig();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', config.upload_preset || 'ml_default');
    formData.append('folder', 'dubai-borka-house');

    const res = await fetch(`https://api.cloudinary.com/v1_1/${config.cloud_name}/image/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || 'Cloudinary আপলোড ব্যর্থ');
    }
    const data = await res.json();
    return data.secure_url;
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadToCloudinary(files[i]);
        newUrls.push(url);
      }

      if (editProduct) {
        // For edit mode: save directly to DB
        for (let i = 0; i < newUrls.length; i++) {
          const { error } = await supabase.from('product_images').insert({
            product_id: editProduct.id,
            image_url: newUrls[i],
            display_order: existingImages.length + i,
          });
          if (error) throw error;
          if (existingImages.length === 0 && i === 0) {
            await supabase.from('products').update({ image_url: newUrls[0] }).eq('id', editProduct.id);
          }
        }
        toast.success(`${newUrls.length}টি ছবি আপলোড হয়েছে`);
        // Trigger parent refresh
        onCancel(); // will close and refetch
      } else {
        // For new product: store in pending state
        setPendingImages(prev => [...prev, ...newUrls]);
        toast.success(`${newUrls.length}টি ছবি আপলোড হয়েছে`);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removePendingImage = (index: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index));
  };

  const deleteExistingImage = async (imageId: string) => {
    const { error } = await supabase.from('product_images').delete().eq('id', imageId);
    if (error) { toast.error(error.message); return; }
    const remaining = existingImages.filter(i => i.id !== imageId);
    if (editProduct) {
      await supabase.from('products').update({ image_url: remaining[0]?.image_url || null }).eq('id', editProduct.id);
    }
    toast.success('ছবি মুছে ফেলা হয়েছে');
    onCancel();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const branchId = isAdmin ? form.branch_id : (userBranchId || '');

    const productData = {
      name: form.name,
      category_id: form.category_id || null,
      branch_id: branchId,
      description: form.description || null,
      buy_price: parseFloat(form.buy_price) || 0,
      sell_price: parseFloat(form.sell_price) || 0,
      quantity: parseInt(form.quantity) || 0,
      min_stock: parseInt(form.min_stock) || 5,
      size: form.size || null,
      color: form.color || null,
      status: form.status,
      image_url: pendingImages.length > 0 ? pendingImages[0] : (editProduct?.image_url || null),
    };

    await onSubmit(productData, pendingImages);
  };

  const allImages = editProduct
    ? existingImages
    : pendingImages.map((url, i) => ({ id: `pending-${i}`, image_url: url, display_order: i }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div><Label>প্রোডাক্টের নাম</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>ক্যাটেগরি</Label>
          <Select value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v })}>
            <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
            <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {isAdmin && (
          <div>
            <Label>শাখা</Label>
            <Select value={form.branch_id} onValueChange={v => setForm({ ...form, branch_id: v })}>
              <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
              <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div><Label>বিবরণ</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>ক্রয়মূল্য (৳)</Label><Input type="number" value={form.buy_price} onChange={e => setForm({ ...form, buy_price: e.target.value })} /></div>
        <div><Label>বিক্রয়মূল্য (৳)</Label><Input type="number" value={form.sell_price} onChange={e => setForm({ ...form, sell_price: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>পরিমাণ</Label><Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></div>
        <div><Label>ন্যূনতম স্টক</Label><Input type="number" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>সাইজ</Label><Input value={form.size} onChange={e => setForm({ ...form, size: e.target.value })} placeholder="S, M, L, XL" /></div>
        <div><Label>রঙ</Label><Input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} /></div>
      </div>

      {/* Image Upload Section - available for both new and edit */}
      <div>
        <Label>ছবি</Label>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
        <div className="flex gap-2 mt-1">
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
            {uploading ? 'আপলোড হচ্ছে...' : 'ছবি আপলোড'}
          </Button>
          {allImages.length > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={() => setGalleryOpen(true)}>
              <ImagePlus className="w-3 h-3 mr-1" />গ্যালারি ({allImages.length})
            </Button>
          )}
        </div>

        {allImages.length > 0 && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {allImages.slice(0, 4).map((img, idx) => (
              <div key={img.id} className="relative group">
                <img src={img.image_url} alt="" className="w-12 h-12 rounded object-cover border cursor-pointer" onClick={() => setGalleryOpen(true)} />
                {!editProduct && (
                  <button type="button" onClick={() => removePendingImage(idx)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5">
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            ))}
            {allImages.length > 4 && <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-xs cursor-pointer" onClick={() => setGalleryOpen(true)}>+{allImages.length - 4}</div>}
          </div>
        )}
      </div>

      <Button type="submit" className="w-full">{editProduct ? 'আপডেট করুন' : 'যুক্ত করুন'}</Button>

      {/* Gallery Dialog */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>প্রোডাক্ট গ্যালারি</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            {allImages.map((img, idx) => (
              <div key={img.id} className="relative group">
                <img src={img.image_url} alt="" className="w-full aspect-square object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={() => editProduct ? deleteExistingImage(img.id) : removePendingImage(idx)}
                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            আরো ছবি যুক্ত করুন
          </Button>
        </DialogContent>
      </Dialog>
    </form>
  );
}
