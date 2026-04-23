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
import { Plus, Search, Undo2, Eye } from 'lucide-react';
import { format } from 'date-fns';
import type { Branch } from '@/types';

interface ReturnItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  max_qty: number;
}

export default function SalesReturn() {
  const { user, isAdmin, userBranchId } = useAuth();
  const [returns, setReturns] = useState<any[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBranch, setFilterBranch] = useState('all');
  const [detailReturn, setDetailReturn] = useState<any>(null);
  const [detailItems, setDetailItems] = useState<any[]>([]);

  // Form state
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [reason, setReason] = useState('');

  const fetchData = async () => {
    const [rRes, bRes] = await Promise.all([
      supabase.from('sales_returns').select('*, branches:branch_id(name)').order('created_at', { ascending: false }),
      supabase.from('branches').select('*').order('name'),
    ]);
    setReturns(rRes.data || []);
    setBranches((bRes.data as unknown as Branch[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const searchInvoice = async () => {
    if (!invoiceSearch.trim()) return;
    const { data, error } = await supabase.from('sales').select('*, branches:branch_id(name)').eq('invoice_number', invoiceSearch.trim()).single();
    if (error || !data) { toast.error('ইনভয়েস খুঁজে পাওয়া যায়নি'); return; }
    setSelectedSale(data);
    const { data: items } = await supabase.from('sale_items').select('*').eq('sale_id', data.id);
    setSaleItems(items || []);
    setReturnItems([]);
  };

  const toggleReturnItem = (item: any) => {
    const existing = returnItems.find(r => r.product_id === item.product_id);
    if (existing) {
      setReturnItems(returnItems.filter(r => r.product_id !== item.product_id));
    } else {
      setReturnItems([...returnItems, {
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        max_qty: item.quantity,
      }]);
    }
  };

  const updateReturnQty = (productId: string, qty: number) => {
    setReturnItems(returnItems.map(r =>
      r.product_id === productId ? { ...r, quantity: Math.min(qty, r.max_qty) } : r
    ));
  };

  const totalRefund = returnItems.reduce((s, r) => s + r.quantity * r.unit_price, 0);

  const handleSubmit = async () => {
    if (!user || !selectedSale || returnItems.length === 0) {
      toast.error('রিটার্ন আইটেম নির্বাচন করুন');
      return;
    }
    setSubmitting(true);
    try {
      const { data: returnNum } = await supabase.rpc('generate_return_number', { p_branch_id: selectedSale.branch_id });

      const { data: returnRecord, error: retErr } = await supabase.from('sales_returns').insert({
        sale_id: selectedSale.id,
        branch_id: selectedSale.branch_id,
        return_number: returnNum,
        customer_name: selectedSale.customer_name,
        customer_mobile: selectedSale.customer_mobile,
        total_refund: totalRefund,
        reason: reason.trim() || null,
        created_by: user.id,
      }).select().single();
      if (retErr) throw retErr;

      // Insert return items
      const items = returnItems.map(r => ({
        return_id: returnRecord.id,
        product_id: r.product_id,
        product_name: r.product_name,
        quantity: r.quantity,
        unit_price: r.unit_price,
        total_price: r.quantity * r.unit_price,
      }));
      const { error: itemsErr } = await supabase.from('sales_return_items').insert(items);
      if (itemsErr) throw itemsErr;

      // Restore stock for returned items
      for (const r of returnItems) {
        const { data: product } = await supabase.from('products').select('quantity').eq('id', r.product_id).single();
        if (product) {
          await supabase.from('products').update({ quantity: product.quantity + r.quantity }).eq('id', r.product_id);
          await supabase.from('stock_movements').insert({
            product_id: r.product_id,
            branch_id: selectedSale.branch_id,
            movement_type: 'in',
            quantity: r.quantity,
            notes: `রিটার্ন - ${returnNum} (ইনভয়েস: ${selectedSale.invoice_number})`,
            created_by: user.id,
          });
        }
      }

      toast.success(`রিটার্ন সম্পন্ন! রিটার্ন নং: ${returnNum}`);
      setDialogOpen(false);
      setSelectedSale(null);
      setSaleItems([]);
      setReturnItems([]);
      setReason('');
      setInvoiceSearch('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const viewDetail = async (ret: any) => {
    setDetailReturn(ret);
    const { data } = await supabase.from('sales_return_items').select('*').eq('return_id', ret.id);
    setDetailItems(data || []);
  };

  const filteredReturns = returns.filter(r => {
    const matchSearch = !searchTerm ||
      r.return_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchBranch = filterBranch === 'all' || r.branch_id === filterBranch;
    return matchSearch && matchBranch;
  });

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">লোড হচ্ছে...</p></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading">বিক্রয় রিটার্ন</h2>
          <p className="text-muted-foreground">মোট {filteredReturns.length}টি রিটার্ন</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setSelectedSale(null); setSaleItems([]); setReturnItems([]); setReason(''); setInvoiceSearch(''); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />নতুন রিটার্ন</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-heading">বিক্রয় রিটার্ন</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {/* Invoice Search */}
              <div>
                <Label>ইনভয়েস নম্বর দিয়ে খুঁজুন *</Label>
                <div className="flex gap-2">
                  <Input value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)} placeholder="DBH-INV-000001" onKeyDown={e => e.key === 'Enter' && searchInvoice()} />
                  <Button type="button" onClick={searchInvoice} variant="outline"><Search className="w-4 h-4" /></Button>
                </div>
              </div>

              {selectedSale && (
                <>
                  <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                    <p><strong>ইনভয়েস:</strong> {selectedSale.invoice_number}</p>
                    <p><strong>গ্রাহক:</strong> {selectedSale.customer_name}</p>
                    <p><strong>তারিখ:</strong> {format(new Date(selectedSale.created_at), 'dd/MM/yyyy')}</p>
                    <p><strong>মোট:</strong> ৳{selectedSale.total_amount?.toLocaleString()}</p>
                  </div>

                  <div>
                    <Label className="font-medium">রিটার্ন করতে আইটেম নির্বাচন করুন</Label>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>নির্বাচন</TableHead>
                          <TableHead>প্রোডাক্ট</TableHead>
                          <TableHead className="text-right">বিক্রিত</TableHead>
                          <TableHead className="text-right">রিটার্ন</TableHead>
                          <TableHead className="text-right">দর (৳)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {saleItems.map((item: any) => {
                          const isSelected = returnItems.some(r => r.product_id === item.product_id);
                          const returnItem = returnItems.find(r => r.product_id === item.product_id);
                          return (
                            <TableRow key={item.id}>
                              <TableCell>
                                <input type="checkbox" checked={isSelected} onChange={() => toggleReturnItem(item)} className="rounded" />
                              </TableCell>
                              <TableCell className="text-sm">{item.product_name}</TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                              <TableCell className="text-right">
                                {isSelected && (
                                  <Input
                                    type="number" min="1" max={item.quantity}
                                    value={returnItem?.quantity || 1}
                                    onChange={e => updateReturnQty(item.product_id, parseInt(e.target.value) || 1)}
                                    className="w-16 h-7 text-right"
                                  />
                                )}
                              </TableCell>
                              <TableCell className="text-right">৳{item.unit_price}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div><Label>রিটার্নের কারণ</Label><Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="কারণ লিখুন..." /></div>

                  <div className="bg-muted rounded-lg p-4">
                    <div className="flex justify-between font-bold text-lg"><span>রিফান্ড পরিমাণ:</span><span>৳{totalRefund.toLocaleString()}</span></div>
                  </div>

                  <Button onClick={handleSubmit} className="w-full" disabled={submitting || returnItems.length === 0}>
                    <Undo2 className="w-4 h-4 mr-2" />{submitting ? 'প্রসেস হচ্ছে...' : 'রিটার্ন সম্পন্ন করুন'}
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="রিটার্ন নং বা গ্রাহক..." className="pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        {isAdmin && (
          <Select value={filterBranch} onValueChange={setFilterBranch}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="শাখা ফিল্টার" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সকল শাখা</SelectItem>
              {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Returns List */}
      <Card className="border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>রিটার্ন নং</TableHead>
                  <TableHead>তারিখ</TableHead>
                  <TableHead>গ্রাহক</TableHead>
                  <TableHead>শাখা</TableHead>
                  <TableHead className="text-right">রিফান্ড (৳)</TableHead>
                  <TableHead>কারণ</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReturns.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-primary text-sm font-medium">{r.return_number}</TableCell>
                    <TableCell className="text-sm">{format(new Date(r.created_at), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="font-medium">{r.customer_name}</TableCell>
                    <TableCell><Badge variant="secondary">{r.branches?.name || '-'}</Badge></TableCell>
                    <TableCell className="text-right font-bold text-destructive">৳{r.total_refund?.toLocaleString()}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{r.reason || '-'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => viewDetail(r)}><Eye className="w-3 h-3" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredReturns.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Undo2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>কোনো রিটার্ন নেই</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailReturn} onOpenChange={(o) => { if (!o) setDetailReturn(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-heading">রিটার্ন বিবরণ</DialogTitle></DialogHeader>
          {detailReturn && (
            <div className="space-y-3">
              <div className="text-sm space-y-1">
                <p><strong>রিটার্ন নং:</strong> {detailReturn.return_number}</p>
                <p><strong>গ্রাহক:</strong> {detailReturn.customer_name}</p>
                <p><strong>তারিখ:</strong> {format(new Date(detailReturn.created_at), 'dd/MM/yyyy hh:mm a')}</p>
                {detailReturn.reason && <p><strong>কারণ:</strong> {detailReturn.reason}</p>}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>প্রোডাক্ট</TableHead>
                    <TableHead className="text-right">পরিমাণ</TableHead>
                    <TableHead className="text-right">দর</TableHead>
                    <TableHead className="text-right">মোট</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailItems.map((i: any) => (
                    <TableRow key={i.id}>
                      <TableCell className="text-sm">{i.product_name}</TableCell>
                      <TableCell className="text-right">{i.quantity}</TableCell>
                      <TableCell className="text-right">৳{i.unit_price}</TableCell>
                      <TableCell className="text-right font-medium">৳{i.total_price?.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="text-right font-bold text-lg text-destructive">রিফান্ড: ৳{detailReturn.total_refund?.toLocaleString()}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
