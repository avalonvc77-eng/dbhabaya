import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, ArrowRightLeft, Search } from 'lucide-react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBranch, setFilterBranch] = useState<string>('all');
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
        .limit(200),
      supabase.from('products').select('*').eq('status', 'active').order('name'),
      supabase.from('branches').select('*').order('name'),
    ]);
    setTransfers(tRes.data || []);
    setProducts((pRes.data as unknown as Product[]) || []);
    setBranches((bRes.data as unknown as Branch[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Non-admin: auto-set from_branch
  useEffect(() => {
    if (!isAdmin && userBranchId && !form.from_branch_id) {
      setForm(f => ({ ...f, from_branch_id: userBranchId }));
    }
  }, [isAdmin, userBranchId]);

  const filteredProducts = form.from_branch_id
    ? products.filter(p => p.branch_id === form.from_branch_id && p.quantity > 0)
    : [];

  const selectedProduct = products.find(p => p.id === form.product_id);

  const filteredTransfers = transfers.filter(t => {
    const matchSearch = !searchTerm || 
      t.products?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.products?.product_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchBranch = filterBranch === 'all' || t.branch_id === filterBranch;
    return matchSearch && matchBranch;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!form.from_branch_id || !form.to_branch_id || !form.product_id || !form.quantity) {
      toast.error('সকল তথ্য পূরণ করুন');
      return;
    }

    if (form.from_branch_id === form.to_branch_id) {
      toast.error('উৎস ও গন্তব্য শাখা একই হতে পারে না');
      return;
    }

    const qty = parseInt(form.quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('সঠিক পরিমাণ দিন');
      return;
    }

    // Re-fetch the latest product data to avoid stale quantity
    const { data: freshProduct, error: fetchErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', form.product_id)
      .single();

    if (fetchErr || !freshProduct) {
      toast.error('প্রোডাক্ট খুঁজে পাওয়া যায়নি');
      return;
    }

    if (qty > freshProduct.quantity) {
      toast.error(`স্টকে মাত্র ${freshProduct.quantity}টি আছে, ${qty}টি ট্রান্সফার করা সম্ভব নয়`);
      return;
    }

    setSubmitting(true);
    const fromBranchName = branches.find(b => b.id === form.from_branch_id)?.name || '';
    const toBranchName = branches.find(b => b.id === form.to_branch_id)?.name || '';

    try {
      // 1. Decrease source product quantity
      const newSourceQty = freshProduct.quantity - qty;
      const { error: updateErr } = await supabase
        .from('products')
        .update({ quantity: newSourceQty })
        .eq('id', freshProduct.id);
      if (updateErr) throw updateErr;

      // 2. Record transfer OUT movement
      const { error: outErr } = await supabase.from('stock_movements').insert({
        product_id: freshProduct.id,
        branch_id: form.from_branch_id,
        movement_type: 'transfer',
        quantity: qty,
        notes: `ট্রান্সফার আউট → ${toBranchName}${form.notes ? '. ' + form.notes : ''}`,
        created_by: user.id,
      });
      if (outErr) throw outErr;

      // 3. Find or create product in destination branch
      const { data: destProducts } = await supabase
        .from('products')
        .select('*')
        .eq('branch_id', form.to_branch_id)
        .eq('name', freshProduct.name)
        .eq('status', 'active')
        .limit(1);

      let destProductId: string;

      if (destProducts && destProducts.length > 0) {
        const dest = destProducts[0];
        destProductId = dest.id;
        await supabase.from('products')
          .update({ quantity: dest.quantity + qty })
          .eq('id', dest.id);
      } else {
        // Create new product in destination
        const destBranch = branches.find(b => b.id === form.to_branch_id);
        const prefix = (destBranch?.name || 'XXX').substring(0, 3).toUpperCase();
        const { count } = await supabase.from('products')
          .select('id', { count: 'exact', head: true })
          .eq('branch_id', form.to_branch_id);
        const code = `${prefix}-${String((count || 0) + 1).padStart(5, '0')}`;

        const { data: newProduct, error: insertErr } = await supabase.from('products').insert({
          product_code: code,
          name: freshProduct.name,
          category_id: freshProduct.category_id,
          branch_id: form.to_branch_id,
          description: freshProduct.description,
          buy_price: freshProduct.buy_price,
          sell_price: freshProduct.sell_price,
          quantity: qty,
          min_stock: freshProduct.min_stock,
          size: freshProduct.size,
          color: freshProduct.color,
          image_url: freshProduct.image_url,
          status: 'active',
          created_by: user.id,
        }).select().single();

        if (insertErr) throw insertErr;
        destProductId = newProduct.id;
      }

      // 4. Record transfer IN movement
      await supabase.from('stock_movements').insert({
        product_id: destProductId,
        branch_id: form.to_branch_id,
        movement_type: 'transfer',
        quantity: qty,
        notes: `ট্রান্সফার ইন ← ${fromBranchName}${form.notes ? '. ' + form.notes : ''}`,
        created_by: user.id,
      });

      toast.success(`${qty}টি "${freshProduct.name}" সফলভাবে ${fromBranchName} → ${toBranchName} ট্রান্সফার হয়েছে`);
      setDialogOpen(false);
      setForm({ product_id: '', from_branch_id: isAdmin ? '' : (userBranchId || ''), to_branch_id: '', quantity: '', notes: '' });
      fetchData();
    } catch (error: any) {
      toast.error('ট্রান্সফার ব্যর্থ: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">লোড হচ্ছে...</p></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
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
                  <Label>উৎস শাখা *</Label>
                  <Select 
                    value={form.from_branch_id} 
                    onValueChange={v => setForm({ ...form, from_branch_id: v, product_id: '' })}
                    disabled={!isAdmin}
                  >
                    <SelectTrigger><SelectValue placeholder="শাখা নির্বাচন" /></SelectTrigger>
                    <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>গন্তব্য শাখা *</Label>
                  <Select value={form.to_branch_id} onValueChange={v => setForm({ ...form, to_branch_id: v })}>
                    <SelectTrigger><SelectValue placeholder="শাখা নির্বাচন" /></SelectTrigger>
                    <SelectContent>{branches.filter(b => b.id !== form.from_branch_id).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>প্রোডাক্ট *</Label>
                <Select value={form.product_id} onValueChange={v => setForm({ ...form, product_id: v })} disabled={!form.from_branch_id}>
                  <SelectTrigger><SelectValue placeholder={form.from_branch_id ? "প্রোডাক্ট নির্বাচন করুন" : "আগে উৎস শাখা নির্বাচন করুন"} /></SelectTrigger>
                  <SelectContent>
                    {filteredProducts.length === 0 && (
                      <div className="p-2 text-sm text-muted-foreground text-center">কোনো প্রোডাক্ট নেই</div>
                    )}
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
                  <p><span className="text-muted-foreground">ক্রয় মূল্য:</span> ৳{selectedProduct.buy_price} | <span className="text-muted-foreground">বিক্রয় মূল্য:</span> ৳{selectedProduct.sell_price}</p>
                  <p><span className="text-muted-foreground">সাইজ:</span> {selectedProduct.size || '-'} | <span className="text-muted-foreground">রঙ:</span> {selectedProduct.color || '-'}</p>
                </div>
              )}

              <div>
                <Label>পরিমাণ *</Label>
                <Input
                  type="number"
                  value={form.quantity}
                  onChange={e => setForm({ ...form, quantity: e.target.value })}
                  required
                  min="1"
                  max={selectedProduct?.quantity || 9999}
                  placeholder="ট্রান্সফার পরিমাণ"
                />
                {selectedProduct && form.quantity && parseInt(form.quantity) > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ট্রান্সফারের পর উৎসে থাকবে: {selectedProduct.quantity - parseInt(form.quantity)}টি
                  </p>
                )}
              </div>

              <div>
                <Label>নোট (ঐচ্ছিক)</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="ট্রান্সফারের কারণ..." />
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                {submitting ? 'ট্রান্সফার হচ্ছে...' : 'ট্রান্সফার করুন'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="প্রোডাক্ট খুঁজুন..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterBranch} onValueChange={setFilterBranch}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="শাখা ফিল্টার" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সকল শাখা</SelectItem>
            {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
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
                  <TableHead>ধরন</TableHead>
                  <TableHead className="text-right">পরিমাণ</TableHead>
                  <TableHead>নোট</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransfers.map((t: any) => {
                  const isOut = t.notes?.includes('আউট');
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm whitespace-nowrap">{format(new Date(t.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{t.products?.name}</p>
                          <p className="text-xs text-primary font-mono">{t.products?.product_code}</p>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{t.branches?.name}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={isOut ? 'destructive' : 'default'}>
                          {isOut ? 'আউট' : 'ইন'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{t.quantity}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">{t.notes || '-'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {filteredTransfers.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              {searchTerm || filterBranch !== 'all' ? 'কোনো ফলাফল পাওয়া যায়নি' : 'কোনো ট্রান্সফার রেকর্ড নেই'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
