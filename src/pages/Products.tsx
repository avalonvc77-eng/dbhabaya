import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Search, Package, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { ImageZoom } from '@/components/ImageZoom';
import type { Branch, Category, Product } from '@/types';
import { ProductForm } from '@/components/ProductForm';
import { ProductCSV } from '@/components/ProductCSV';

export default function Products() {
  const { isAdmin, userBranchId, user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBranch, setFilterBranch] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [productImages, setProductImages] = useState<Record<string, any[]>>({});

  const fetchData = async () => {
    const [pRes, bRes, cRes, imgRes] = await Promise.all([
      supabase.from('products').select('*, branches:branch_id(name, shop_code), categories:category_id(name)').order('created_at', { ascending: false }),
      supabase.from('branches').select('*').order('name'),
      supabase.from('categories').select('*').order('name'),
      supabase.from('product_images').select('*').order('display_order'),
    ]);
    setProducts((pRes.data as unknown as Product[]) || []);
    setBranches((bRes.data as unknown as Branch[]) || []);
    setCategories((cRes.data as unknown as Category[]) || []);
    
    const imgMap: Record<string, any[]> = {};
    (imgRes.data || []).forEach((img: any) => {
      if (!imgMap[img.product_id]) imgMap[img.product_id] = [];
      imgMap[img.product_id].push(img);
    });
    setProductImages(imgMap);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const generateProductCode = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    if (!branch) return '';
    const prefix = branch.name.substring(0, 3).toUpperCase();
    const random = Math.floor(10000 + Math.random() * 90000);
    return `${prefix}-${random}`;
  };

  const handleFormSubmit = async (productData: any, imageUrls: string[]) => {
    if (!user) return;
    try {
      if (editProduct) {
        const { error } = await supabase.from('products').update(productData).eq('id', editProduct.id);
        if (error) throw error;
        toast.success('প্রোডাক্ট আপডেট হয়েছে');
      } else {
        const { data: newProduct, error } = await supabase.from('products').insert({
          ...productData,
          product_code: generateProductCode(productData.branch_id),
          created_by: user.id,
        }).select().single();
        if (error) throw error;

        // Save pending images to DB
        if (imageUrls.length > 0 && newProduct) {
          for (let i = 0; i < imageUrls.length; i++) {
            await supabase.from('product_images').insert({
              product_id: newProduct.id,
              image_url: imageUrls[i],
              display_order: i,
            });
          }
          // Set first image as product thumbnail
          await supabase.from('products').update({ image_url: imageUrls[0] }).eq('id', newProduct.id);
        }
        toast.success('নতুন প্রোডাক্ট যুক্ত হয়েছে');
      }
      setDialogOpen(false);
      setEditProduct(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('এই প্রোডাক্ট মুছে ফেলতে চান?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('প্রোডাক্ট মুছে ফেলা হয়েছে'); fetchData(); }
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setDialogOpen(true);
  };

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.product_code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchBranch = filterBranch === 'all' || p.branch_id === filterBranch;
    const matchCategory = filterCategory === 'all' || p.category_id === filterCategory;
    return matchSearch && matchBranch && matchCategory;
  });

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">লোড হচ্ছে...</p></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading">প্রোডাক্ট</h2>
          <p className="text-muted-foreground">মোট {filtered.length}টি প্রোডাক্ট</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ProductCSV products={filtered} onImport={fetchData} />
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditProduct(null); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />নতুন প্রোডাক্ট</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-heading">{editProduct ? 'প্রোডাক্ট আপডেট' : 'নতুন প্রোডাক্ট যুক্ত করুন'}</DialogTitle>
              </DialogHeader>
              {dialogOpen && (
                <ProductForm
                  isAdmin={isAdmin}
                  userBranchId={userBranchId}
                  branches={branches}
                  categories={categories}
                  editProduct={editProduct}
                  existingImages={editProduct ? (productImages[editProduct.id] || []) : []}
                  onSubmit={handleFormSubmit}
                  onCancel={() => { setDialogOpen(false); setEditProduct(null); fetchData(); }}
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="নাম বা কোড দিয়ে খুঁজুন..." className="pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Select value={filterBranch} onValueChange={setFilterBranch}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="শাখা ফিল্টার" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সকল শাখা</SelectItem>
            {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="ক্যাটেগরি ফিল্টার" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সকল ক্যাটেগরি</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Product Table */}
      <Card className="border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ছবি</TableHead>
                  <TableHead>কোড</TableHead>
                  <TableHead>নাম</TableHead>
                  <TableHead>ক্যাটেগরি</TableHead>
                  <TableHead>শাখা</TableHead>
                  <TableHead className="text-right">ক্রয়মূল্য</TableHead>
                  <TableHead className="text-right">বিক্রয়মূল্য</TableHead>
                  <TableHead className="text-right">স্টক</TableHead>
                  <TableHead>অবস্থা</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {p.image_url ? (
                        <ImageZoom src={p.image_url} alt={p.name} thumbnailClassName="w-10 h-10 rounded object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center"><Package className="w-4 h-4 text-muted-foreground" /></div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-primary font-medium">{p.product_code}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{(p as any).categories?.name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{(p as any).branches?.name || '-'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">৳{p.buy_price}</TableCell>
                    <TableCell className="text-right">৳{p.sell_price}</TableCell>
                    <TableCell className="text-right">
                      <span className={`flex items-center justify-end gap-1 ${p.quantity <= p.min_stock ? 'text-destructive font-medium' : ''}`}>
                        {p.quantity <= p.min_stock && <AlertTriangle className="w-3 h-3" />}
                        {p.quantity}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.status === 'active' ? 'default' : 'secondary'}>
                        {p.status === 'active' ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Pencil className="w-3 h-3" /></Button>
                        {isAdmin && <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>কোনো প্রোডাক্ট পাওয়া যায়নি</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
