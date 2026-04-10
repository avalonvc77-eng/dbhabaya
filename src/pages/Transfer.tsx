import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, ArrowRightLeft, ArrowRight } from 'lucide-react';
import type { Branch, Product } from '@/types';
import { format } from 'date-fns';

export default function Transfer() {
  const { user, isAdmin, userBranchId } = useAuth();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    product_id: '',
    from_branch_id: '',
    to_branch_id: '',
    quantity: '',
    notes: '',
  });

  const fetchData = async () => {
    const [tRes, pRes, bRes] = await Promise.all([
      supabase
        .from('stock_movements')
        .select('*, products:product_id(name, product_code), branches:branch_id(name)')
        .eq('movement_type', 'transfer')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('products').select('*').order('name'),
      supabase.from('branches').select('*').order('name'),
    ]);
    setTransfers(tRes.data || []);
    setProducts((pRes.data as unknown as Product[]) || []);
    setBranches((bRes.data as unknown as Branch[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Filter products by source branch
  const filteredProducts = form.from_branch_id
    ? products.filter(p => p.branch_id === form.from_branch_id)
    : products;

  const selectedProduct = products.find(p => p.id === form.product_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (form.from_branch_id === form.to_branch_id) {
      toast.error('উৎস ও গন্তব্য শাখা একই হতে পারে না');
      return;
    }
    const qty = parseInt(form.quantity);
    if (selectedProduct && qty > selectedProduct.quantity) {
      toast.error(`স্টকে মাত্র ${selectedProduct.quantity}টি আছে`);
      return;
    }

    setSubmitting(true);
    try {
      // Record transfer out from source branch
      const { error: outErr } = await supabase.from('stock_movements').insert({
        product_id: form.product_id,
        branch_id: form.from_branch_id,
        movement_type: 'transfer',
        quantity: qty,
        notes: `ট্রান্সফার আউট → ${branches.find(b => b.id === form.to_branch_id)?.name || ''}. ${form.notes}`.trim(),
        created_by: user.id,
      });
      if (outErr) throw outErr;

      // Decrease quantity in source product
      if (selectedProduct) {
        await supabase.from('products').update({ quantity: selectedProduct.quantity - qty }).eq('id', selectedProduct.id);
      }

      // Check if same product exists in destination branch
      const { data: destProducts } = await supabase
        .from('products')
        .select('*')
        .eq('branch_id', form.to_branch_id)
        .eq('name', selectedProduct?.name || '')
        .limit(1);

      if (destProducts && destProducts.length > 0) {
        // Update existing product quantity in destination
        const destProduct = destProducts[0];
        await supabase.from('products').update({ quantity: destProduct.quantity + qty }).eq('id', destProduct.id);

        // Record transfer in
        await supabase.from('stock_movements').insert({
          product_id: destProduct.id,
          branch_id: form.to_branch_id,
          movement_type: 'transfer',
          quantity: qty,
          notes: `ট্রান্সফার ইন ← ${branches.find(b => b.id === form.from_branch_id)?.name || ''}. ${form.notes}`.trim(),
          created_by: user.id,
        });
      } else if (selectedProduct) {
        // Create new product in destination branch
        const destBranch = branches.find(b => b.id === form.to_branch_id);
        const prefix = (destBranch?.name || 'XXX').substring(0, 3).toUpperCase();
        const { count } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('branch_id', form.to_branch_id);
        const code = `${prefix}-${String((count || 0) + 1).padStart(5, '0')}`;

        const { data: newProduct, error: insertErr } = await supabase.from('products').insert({
          product_code: code,
          name: selectedProduct.name,
          category_id: selectedProduct.category_id,
          branch_id: form.to_branch_id,
          description: selectedProduct.description,
          buy_price: selectedProduct.buy_price,
          sell_price: selectedProduct.sell_price,
          quantity: qty,
          min_stock: selectedProduct.min_stock,
          size: selectedProduct.size,
          color: selectedProduct.color,
          image_url: selectedProduct.image_url,
          status: 'active',
          created_by: user.id,
        }).select().single();

        if (insertErr) throw insertErr;

        if (newProduct) {
          await supabase.from('stock_movements').insert({
            product_id: newProduct.id,
            branch_id: form.to_branch_id,
            movement_type: 'transfer',
            quantity: qty,
            notes: `ট্রান্সফার ইন ← ${branches.find(b => b.id === form.from_branch_id)?.name || ''}. ${form.notes}`.trim(),
            created_by: user.id,
          });
        }
      }

      toast.success('প্রোডাক্ট সফলভাবে ট্রান্সফার হয়েছে');
      setDialogOpen(false);
      setForm({ product_id: '', from_branch_id: '', to_branch_id: '', quantity: '', notes: '' });
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">লোড হচ্ছে...</p></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-heading">শাখা ট্রান্সফার</h2>
          <p className="text-muted-foreground">এক শাখা থেকে অন্য শাখায় প্রোডাক্ট স্থানান্তর</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />নতুন ট্রান্সফার</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="font-heading">প্রোডাক্ট ট্রান্সফার করুন</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>উৎস শাখা</Label>
                  <Select value={form.from_branch_id} onValueChange={v => setForm({ ...form, from_branch_id: v, product_id: '' })}>
                    <SelectTrigger><SelectValue placeholder="শাখা নির্বাচন" /></SelectTrigger>
                    <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>গন্তব্য শাখা</Label>
                  <Select value={form.to_branch_id} onValueChange={v => setForm({ ...form, to_branch_id: v })}>
                    <SelectTrigger><SelectValue placeholder="শাখা নির্বাচন" /></SelectTrigger>
                    <SelectContent>{branches.filter(b => b.id !== form.from_branch_id).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>প্রোডাক্ট</Label>
                <Select value={form.product_id} onValueChange={v => setForm({ ...form, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder="প্রোডাক্ট নির্বাচন করুন" /></SelectTrigger>
                  <SelectContent>
                    {filteredProducts.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.product_code} - {p.name} (স্টক: {p.quantity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProduct && (
                <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                  <p><span className="text-muted-foreground">বর্তমান স্টক:</span> <span className="font-bold">{selectedProduct.quantity}</span></p>
                  <p><span className="text-muted-foreground">সাইজ:</span> {selectedProduct.size || '-'} | <span className="text-muted-foreground">রঙ:</span> {selectedProduct.color || '-'}</p>
                </div>
              )}

              <div>
                <Label>পরিমাণ</Label>
                <Input
                  type="number"
                  value={form.quantity}
                  onChange={e => setForm({ ...form, quantity: e.target.value })}
                  required
                  min="1"
                  max={selectedProduct?.quantity || 9999}
                />
              </div>

              <div>
                <Label>নোট (ঐচ্ছিক)</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="ট্রান্সফারের কারণ..." />
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'ট্রান্সফার হচ্ছে...' : 'ট্রান্সফার করুন'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>তারিখ</TableHead>
                  <TableHead>প্রোডাক্ট</TableHead>
                  <TableHead>শাখা</TableHead>
                  <TableHead className="text-right">পরিমাণ</TableHead>
                  <TableHead>নোট</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">{format(new Date(t.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{t.products?.name}</p>
                        <p className="text-xs text-primary font-mono">{t.products?.product_code}</p>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{t.branches?.name}</Badge></TableCell>
                    <TableCell className="text-right font-medium">{t.quantity}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">{t.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {transfers.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">কোনো ট্রান্সফার রেকর্ড নেই</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
