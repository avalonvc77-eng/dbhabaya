import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, ArrowRightLeft, Search, Undo2, TrendingUp, TrendingDown } from 'lucide-react';
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
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBranch, setFilterBranch] = useState<string>('all');
  const [summaryBranch, setSummaryBranch] = useState<string>('');
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
        .select('*, products:product_id(name, product_code, buy_price, sell_price), branches:branch_id(name)')
        .eq('movement_type', 'transfer')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.from('products').select('*').eq('status', 'active').order('name'),
      supabase.from('branches').select('*').order('name'),
    ]);
    setTransfers(tRes.data || []);
    setProducts((pRes.data as unknown as Product[]) || []);
    const branchList = (bRes.data as unknown as Branch[]) || [];
    setBranches(branchList);
    if (!summaryBranch && branchList.length > 0) setSummaryBranch(branchList[0].id);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

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

  // Branch summary
  const branchTransfers = transfers.filter(t => t.branch_id === summaryBranch);
  const summaryIn = branchTransfers.filter(t => t.notes?.includes('ইন'));
  const summaryOut = branchTransfers.filter(t => t.notes?.includes('আউট'));
  const totalInPcs = summaryIn.reduce((s, t) => s + t.quantity, 0);
  const totalOutPcs = summaryOut.reduce((s, t) => s + t.quantity, 0);
  const totalInValue = summaryIn.reduce((s, t) => s + (t.quantity * (t.products?.sell_price || 0)), 0);
  const totalOutValue = summaryOut.reduce((s, t) => s + (t.quantity * (t.products?.sell_price || 0)), 0);

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

    const { data: freshProduct, error: fetchErr } = await supabase.from('products').select('*').eq('id', form.product_id).single();
    if (fetchErr || !freshProduct) { toast.error('প্রোডাক্ট খুঁজে পাওয়া যায়নি'); return; }
    if (qty > freshProduct.quantity) { toast.error(`স্টকে মাত্র ${freshProduct.quantity}টি আছে`); return; }

    setSubmitting(true);
    const fromName = branches.find(b => b.id === form.from_branch_id)?.name || '';
    const toName = branches.find(b => b.id === form.to_branch_id)?.name || '';

    try {
      await supabase.from('products').update({ quantity: freshProduct.quantity - qty }).eq('id', freshProduct.id);
      await supabase.from('stock_movements').insert({
        product_id: freshProduct.id, branch_id: form.from_branch_id, movement_type: 'transfer', quantity: qty,
        notes: `ট্রান্সফার আউট → ${toName}${form.notes ? '. ' + form.notes : ''}`, created_by: user.id,
      });

      const { data: destProducts } = await supabase.from('products').select('*')
        .eq('branch_id', form.to_branch_id).eq('name', freshProduct.name).eq('status', 'active').limit(1);

      let destProductId: string;
      if (destProducts && destProducts.length > 0) {
        const dest = destProducts[0];
        destProductId = dest.id;
        await supabase.from('products').update({ quantity: dest.quantity + qty }).eq('id', dest.id);
      } else {
        const destBranch = branches.find(b => b.id === form.to_branch_id);
        const prefix = (destBranch?.name || 'XXX').substring(0, 3).toUpperCase();
        const { count } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('branch_id', form.to_branch_id);
        const code = `${prefix}-${String((count || 0) + 1).padStart(5, '0')}`;
        const { data: newProduct, error: insertErr } = await supabase.from('products').insert({
          product_code: code, name: freshProduct.name, category_id: freshProduct.category_id,
          branch_id: form.to_branch_id, description: freshProduct.description,
          buy_price: freshProduct.buy_price, sell_price: freshProduct.sell_price,
          quantity: qty, min_stock: freshProduct.min_stock, size: freshProduct.size,
          color: freshProduct.color, image_url: freshProduct.image_url, status: 'active', created_by: user.id,
        }).select().single();
        if (insertErr) throw insertErr;
        destProductId = newProduct.id;
      }

      await supabase.from('stock_movements').insert({
        product_id: destProductId, branch_id: form.to_branch_id, movement_type: 'transfer', quantity: qty,
        notes: `ট্রান্সফার ইন ← ${fromName}${form.notes ? '. ' + form.notes : ''}`, created_by: user.id,
      });

      toast.success(`${qty}টি "${freshProduct.name}" সফলভাবে ট্রান্সফার হয়েছে`);
      setDialogOpen(false);
      setForm({ product_id: '', from_branch_id: isAdmin ? '' : (userBranchId || ''), to_branch_id: '', quantity: '', notes: '' });
      fetchData();
    } catch (error: any) {
      toast.error('ট্রান্সফার ব্যর্থ: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Reverse a transfer pair (OUT record)
  const handleReverse = async (outRecord: any) => {
    if (!user || !isAdmin) { toast.error('শুধু অ্যাডমিন রিভার্স করতে পারেন'); return; }
    const confirmed = window.confirm(`"${outRecord.products?.name}" এর ${outRecord.quantity}টি ট্রান্সফার বাতিল করতে চান?`);
    if (!confirmed) return;

    setReversingId(outRecord.id);
    try {
      // Find the source product
      const { data: srcProduct } = await supabase.from('products').select('*').eq('id', outRecord.product_id).single();
      if (!srcProduct) throw new Error('উৎস প্রোডাক্ট খুঁজে পাওয়া যায়নি');

      // Find the destination product (same name, different branch)
      const noteMatch = outRecord.notes?.match(/→\s*(.+?)(\.|$)/);
      const destBranchName = noteMatch?.[1]?.trim();
      const destBranch = branches.find(b => b.name === destBranchName);

      if (!destBranch) throw new Error('গন্তব্য শাখা চিহ্নিত করা যায়নি');

      const { data: destProducts } = await supabase.from('products').select('*')
        .eq('branch_id', destBranch.id).eq('name', srcProduct.name).eq('status', 'active').limit(1);

      const destProduct = destProducts?.[0];
      if (!destProduct) throw new Error('গন্তব্যে প্রোডাক্ট খুঁজে পাওয়া যায়নি');

      const qty = outRecord.quantity;

      if (destProduct.quantity < qty) {
        toast.error(`গন্তব্যে মাত্র ${destProduct.quantity}টি আছে, ${qty}টি ফেরত সম্ভব নয়`);
        return;
      }

      // Reverse: add back to source, subtract from dest
      await supabase.from('products').update({ quantity: srcProduct.quantity + qty }).eq('id', srcProduct.id);
      await supabase.from('products').update({ quantity: destProduct.quantity - qty }).eq('id', destProduct.id);

      // Record reversal movements
      await supabase.from('stock_movements').insert({
        product_id: srcProduct.id, branch_id: srcProduct.branch_id, movement_type: 'transfer', quantity: qty,
        notes: `রিভার্স ইন ← ${destBranchName} (বাতিল)`, created_by: user.id,
      });
      await supabase.from('stock_movements').insert({
        product_id: destProduct.id, branch_id: destBranch.id, movement_type: 'transfer', quantity: qty,
        notes: `রিভার্স আউট → ${branches.find(b => b.id === srcProduct.branch_id)?.name} (বাতিল)`, created_by: user.id,
      });

      toast.success('ট্রান্সফার সফলভাবে বাতিল/রিভার্স হয়েছে');
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setReversingId(null);
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
                  <Select value={form.from_branch_id} onValueChange={v => setForm({ ...form, from_branch_id: v, product_id: '' })} disabled={!isAdmin}>
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
                    {filteredProducts.length === 0 && <div className="p-2 text-sm text-muted-foreground text-center">কোনো প্রোডাক্ট নেই</div>}
                    {filteredProducts.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.product_code} - {p.name} (স্টক: {p.quantity})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedProduct && (
                <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                  <p><span className="text-muted-foreground">বর্তমান স্টক:</span> <span className="font-bold">{selectedProduct.quantity}</span></p>
                  <p><span className="text-muted-foreground">ক্রয়:</span> ৳{selectedProduct.buy_price} | <span className="text-muted-foreground">বিক্রয়:</span> ৳{selectedProduct.sell_price}</p>
                </div>
              )}
              <div>
                <Label>পরিমাণ *</Label>
                <Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required min="1" max={selectedProduct?.quantity || 9999} />
                {selectedProduct && form.quantity && parseInt(form.quantity) > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">ট্রান্সফারের পর উৎসে থাকবে: {selectedProduct.quantity - parseInt(form.quantity)}টি</p>
                )}
              </div>
              <div>
                <Label>নোট (ঐচ্ছিক)</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="ট্রান্সফারের কারণ..." />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                <ArrowRightLeft className="w-4 h-4 mr-2" />{submitting ? 'ট্রান্সফার হচ্ছে...' : 'ট্রান্সফার করুন'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="history" className="space-y-4">
        <TabsList>
          <TabsTrigger value="history">ট্রান্সফার হিস্ট্রি</TabsTrigger>
          <TabsTrigger value="summary">শাখা সারাংশ</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-4">
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
                      {isAdmin && <TableHead className="text-center">অ্যাকশন</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransfers.map((t: any) => {
                      const isOut = t.notes?.includes('আউট');
                      const isReversed = t.notes?.includes('বাতিল') || t.notes?.includes('রিভার্স');
                      return (
                        <TableRow key={t.id} className={isReversed ? 'opacity-50' : ''}>
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
                              {isReversed ? '↩ বাতিল' : isOut ? 'আউট' : 'ইন'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">{t.quantity}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{t.notes || '-'}</TableCell>
                          {isAdmin && (
                            <TableCell className="text-center">
                              {isOut && !isReversed && (
                                <Button
                                  variant="ghost" size="sm"
                                  onClick={() => handleReverse(t)}
                                  disabled={reversingId === t.id}
                                  title="ট্রান্সফার বাতিল করুন"
                                >
                                  <Undo2 className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {filteredTransfers.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">কোনো ট্রান্সফার রেকর্ড নেই</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branch Summary Tab */}
        <TabsContent value="summary" className="space-y-4">
          <Select value={summaryBranch} onValueChange={setSummaryBranch}>
            <SelectTrigger className="w-[250px]"><SelectValue placeholder="শাখা নির্বাচন" /></SelectTrigger>
            <SelectContent>
              {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <TrendingDown className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold">{totalInPcs}</p>
                    <p className="text-sm text-muted-foreground">ইন (পিস)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-8 w-8 text-destructive" />
                  <div>
                    <p className="text-2xl font-bold">{totalOutPcs}</p>
                    <p className="text-sm text-muted-foreground">আউট (পিস)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div>
                  <p className="text-2xl font-bold text-green-600">৳{totalInValue.toLocaleString('bn-BD')}</p>
                  <p className="text-sm text-muted-foreground">ইন মূল্য (বিক্রয়)</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div>
                  <p className="text-2xl font-bold text-destructive">৳{totalOutValue.toLocaleString('bn-BD')}</p>
                  <p className="text-sm text-muted-foreground">আউট মূল্য (বিক্রয়)</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Per-product breakdown for this branch */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">প্রোডাক্ট ভিত্তিক ট্রান্সফার</CardTitle>
              <CardDescription>{branches.find(b => b.id === summaryBranch)?.name || ''} শাখার ট্রান্সফার বিবরণ</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>তারিখ</TableHead>
                      <TableHead>প্রোডাক্ট</TableHead>
                      <TableHead>ধরন</TableHead>
                      <TableHead className="text-right">পরিমাণ</TableHead>
                      <TableHead className="text-right">মূল্য (৳)</TableHead>
                      <TableHead>নোট</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branchTransfers.map((t: any) => {
                      const isOut = t.notes?.includes('আউট');
                      const value = t.quantity * (t.products?.sell_price || 0);
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="text-sm whitespace-nowrap">{format(new Date(t.created_at), 'dd/MM/yyyy')}</TableCell>
                          <TableCell className="font-medium">{t.products?.name}</TableCell>
                          <TableCell><Badge variant={isOut ? 'destructive' : 'default'}>{isOut ? 'আউট' : 'ইন'}</Badge></TableCell>
                          <TableCell className="text-right">{t.quantity}</TableCell>
                          <TableCell className={`text-right font-medium ${isOut ? 'text-destructive' : 'text-green-600'}`}>
                            {isOut ? '-' : '+'}৳{value.toLocaleString('bn-BD')}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{t.notes || '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {branchTransfers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">এই শাখার কোনো ট্রান্সফার নেই</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
