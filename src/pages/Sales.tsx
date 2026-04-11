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
import { Plus, ShoppingCart, Trash2, Eye, Printer } from 'lucide-react';
import type { Branch, Product } from '@/types';
import { format } from 'date-fns';

interface CartItem {
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  unit_price: number;
  available: number;
}

export default function Sales() {
  const { user, isAdmin, userBranchId } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [invoiceDialog, setInvoiceDialog] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [qty, setQty] = useState('1');
  const [filterBranch, setFilterBranch] = useState('all');

  const fetchData = async () => {
    const [sRes, pRes, bRes] = await Promise.all([
      supabase.from('sales').select('*, branches:branch_id(name)').order('created_at', { ascending: false }).limit(200),
      supabase.from('products').select('*').eq('status', 'active').order('name'),
      supabase.from('branches').select('*').order('name'),
    ]);
    setSales(sRes.data || []);
    setProducts((pRes.data as unknown as Product[]) || []);
    setBranches((bRes.data as unknown as Branch[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const branchProducts = isAdmin
    ? products
    : products.filter(p => p.branch_id === userBranchId);

  const addToCart = () => {
    const p = branchProducts.find(pr => pr.id === selectedProduct);
    if (!p) return;
    const q = parseInt(qty) || 1;
    if (q > p.quantity) { toast.error(`স্টকে মাত্র ${p.quantity}টি আছে`); return; }
    const existing = cart.find(c => c.product_id === p.id);
    if (existing) {
      if (existing.quantity + q > p.quantity) { toast.error('স্টক অপর্যাপ্ত'); return; }
      setCart(cart.map(c => c.product_id === p.id ? { ...c, quantity: c.quantity + q } : c));
    } else {
      setCart([...cart, { product_id: p.id, product_name: p.name, product_code: p.product_code, quantity: q, unit_price: p.sell_price, available: p.quantity }]);
    }
    setSelectedProduct('');
    setQty('1');
  };

  const subtotal = cart.reduce((s, c) => s + c.quantity * c.unit_price, 0);
  const discPct = parseFloat(discountPercent) || 0;
  const discountAmount = subtotal * (discPct / 100);
  const total = subtotal - discountAmount;

  const handleSubmit = async () => {
    if (!user || cart.length === 0 || !customerName.trim()) {
      toast.error('গ্রাহকের নাম ও কমপক্ষে একটি প্রোডাক্ট যুক্ত করুন');
      return;
    }
    setSubmitting(true);
    try {
      const branchId = isAdmin ? (cart[0] ? products.find(p => p.id === cart[0].product_id)?.branch_id : userBranchId) : userBranchId;
      if (!branchId) throw new Error('শাখা নির্ধারণ করা যায়নি');

      // Generate invoice number via RPC
      const { data: invoiceNum, error: invErr } = await supabase.rpc('generate_invoice_number', { p_branch_id: branchId });
      if (invErr) throw invErr;

      const { data: sale, error: saleErr } = await supabase.from('sales').insert({
        invoice_number: invoiceNum,
        branch_id: branchId,
        customer_name: customerName.trim(),
        customer_mobile: customerMobile.trim() || null,
        subtotal,
        discount_percent: discPct,
        discount_amount: discountAmount,
        total_amount: total,
        payment_method: paymentMethod,
        notes: notes.trim() || null,
        created_by: user.id,
      }).select().single();
      if (saleErr) throw saleErr;

      // Insert sale items
      const items = cart.map(c => ({
        sale_id: sale.id,
        product_id: c.product_id,
        product_name: c.product_name,
        quantity: c.quantity,
        unit_price: c.unit_price,
        total_price: c.quantity * c.unit_price,
      }));
      const { error: itemsErr } = await supabase.from('sale_items').insert(items);
      if (itemsErr) throw itemsErr;

      // Update product quantities & record stock out
      for (const c of cart) {
        const p = products.find(pr => pr.id === c.product_id);
        if (p) {
          await supabase.from('products').update({ quantity: p.quantity - c.quantity }).eq('id', p.id);
          await supabase.from('stock_movements').insert({
            product_id: c.product_id,
            branch_id: branchId,
            movement_type: 'out',
            quantity: c.quantity,
            notes: `বিক্রয় - ইনভয়েস: ${invoiceNum}`,
            created_by: user.id,
          });
        }
      }

      toast.success(`বিক্রয় সম্পন্ন! ইনভয়েস: ${invoiceNum}`);
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setCustomerName(''); setCustomerMobile(''); setPaymentMethod('cash');
    setDiscountPercent('0'); setNotes(''); setCart([]);
  };

  const viewInvoice = async (sale: any) => {
    const { data: items } = await supabase.from('sale_items').select('*').eq('sale_id', sale.id);
    setInvoiceDialog({ ...sale, items: items || [] });
  };

  const printInvoice = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !invoiceDialog) return;
    const items = invoiceDialog.items || [];
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ইনভয়েস ${invoiceDialog.invoice_number}</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;max-width:400px;margin:0 auto}
    h2{text-align:center;margin-bottom:5px}p{margin:2px 0;font-size:13px}
    table{width:100%;border-collapse:collapse;margin:10px 0}
    th,td{border-bottom:1px solid #ddd;padding:5px;font-size:12px;text-align:left}
    th{background:#f5f5f5}.right{text-align:right}.total{font-weight:bold;font-size:14px}
    .divider{border-top:1px dashed #999;margin:10px 0}
    @media print{body{padding:0}}</style></head><body>
    <h2>দুবাই বোরকা হাউজ</h2>
    <p style="text-align:center">ইনভয়েস</p>
    <div class="divider"></div>
    <p><strong>ইনভয়েস নং:</strong> ${invoiceDialog.invoice_number}</p>
    <p><strong>তারিখ:</strong> ${format(new Date(invoiceDialog.created_at), 'dd/MM/yyyy hh:mm a')}</p>
    <p><strong>গ্রাহক:</strong> ${invoiceDialog.customer_name}</p>
    ${invoiceDialog.customer_mobile ? `<p><strong>মোবাইল:</strong> ${invoiceDialog.customer_mobile}</p>` : ''}
    <p><strong>পেমেন্ট:</strong> ${invoiceDialog.payment_method === 'cash' ? 'নগদ' : invoiceDialog.payment_method === 'bkash' ? 'বিকাশ' : invoiceDialog.payment_method === 'nagad' ? 'নগদ (ডিজিটাল)' : 'কার্ড'}</p>
    <table><thead><tr><th>প্রোডাক্ট</th><th class="right">পরিমাণ</th><th class="right">দর</th><th class="right">মোট</th></tr></thead><tbody>
    ${items.map((i: any) => `<tr><td>${i.product_name}</td><td class="right">${i.quantity}</td><td class="right">৳${i.unit_price}</td><td class="right">৳${i.total_price}</td></tr>`).join('')}
    </tbody></table>
    <div class="divider"></div>
    <p class="right">সাবটোটাল: ৳${invoiceDialog.subtotal}</p>
    ${invoiceDialog.discount_amount > 0 ? `<p class="right">ডিসকাউন্ট (${invoiceDialog.discount_percent}%): -৳${invoiceDialog.discount_amount}</p>` : ''}
    <p class="right total">মোট: ৳${invoiceDialog.total_amount}</p>
    <div class="divider"></div>
    <p style="text-align:center;font-size:11px;margin-top:20px">ধন্যবাদ! আবার আসবেন।</p>
    </body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const filteredSales = filterBranch === 'all' ? sales : sales.filter(s => s.branch_id === filterBranch);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">লোড হচ্ছে...</p></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading">বিক্রয়</h2>
          <p className="text-muted-foreground">মোট {filteredSales.length}টি বিক্রয় রেকর্ড</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Select value={filterBranch} onValueChange={setFilterBranch}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="শাখা ফিল্টার" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সকল শাখা</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />নতুন বিক্রয়</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-heading">নতুন বিক্রয় রেকর্ড</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>গ্রাহকের নাম *</Label><Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="গ্রাহকের নাম" /></div>
                  <div><Label>মোবাইল নম্বর</Label><Input value={customerMobile} onChange={e => setCustomerMobile(e.target.value)} placeholder="01XXXXXXXXX" /></div>
                </div>

                <div className="border rounded-lg p-3 space-y-3">
                  <Label className="font-medium">প্রোডাক্ট যুক্ত করুন</Label>
                  <div className="flex gap-2">
                    <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="প্রোডাক্ট নির্বাচন" /></SelectTrigger>
                      <SelectContent>
                        {branchProducts.filter(p => p.quantity > 0).map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.product_code} - {p.name} (৳{p.sell_price}, স্টক: {p.quantity})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input type="number" value={qty} onChange={e => setQty(e.target.value)} className="w-20" min="1" />
                    <Button type="button" onClick={addToCart} size="sm">যুক্ত</Button>
                  </div>

                  {cart.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>প্রোডাক্ট</TableHead>
                          <TableHead className="text-right">পরিমাণ</TableHead>
                          <TableHead className="text-right">দর (৳)</TableHead>
                          <TableHead className="text-right">মোট (৳)</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cart.map(c => (
                          <TableRow key={c.product_id}>
                            <TableCell className="text-sm">{c.product_name}<br /><span className="text-xs text-primary font-mono">{c.product_code}</span></TableCell>
                            <TableCell className="text-right">{c.quantity}</TableCell>
                            <TableCell className="text-right">৳{c.unit_price}</TableCell>
                            <TableCell className="text-right font-medium">৳{(c.quantity * c.unit_price).toLocaleString()}</TableCell>
                            <TableCell><Button variant="ghost" size="sm" onClick={() => setCart(cart.filter(x => x.product_id !== c.product_id))}><Trash2 className="w-3 h-3 text-destructive" /></Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div><Label>পেমেন্ট পদ্ধতি</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">নগদ</SelectItem>
                        <SelectItem value="bkash">বিকাশ</SelectItem>
                        <SelectItem value="nagad">নগদ (ডিজিটাল)</SelectItem>
                        <SelectItem value="card">কার্ড</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>ডিসকাউন্ট (%)</Label><Input type="number" value={discountPercent} onChange={e => setDiscountPercent(e.target.value)} min="0" max="100" /></div>
                </div>

                <div><Label>নোট (ঐচ্ছিক)</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="অতিরিক্ত তথ্য..." /></div>

                <div className="bg-muted rounded-lg p-4 space-y-1">
                  <div className="flex justify-between"><span>সাবটোটাল:</span><span>৳{subtotal.toLocaleString()}</span></div>
                  {discountAmount > 0 && <div className="flex justify-between text-destructive"><span>ডিসকাউন্ট ({discPct}%):</span><span>-৳{discountAmount.toLocaleString()}</span></div>}
                  <div className="flex justify-between font-bold text-lg border-t pt-2"><span>মোট:</span><span>৳{total.toLocaleString()}</span></div>
                </div>

                <Button onClick={handleSubmit} className="w-full" disabled={submitting || cart.length === 0}>
                  {submitting ? 'প্রসেস হচ্ছে...' : 'বিক্রয় সম্পন্ন করুন'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Sales List */}
      <Card className="border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ইনভয়েস</TableHead>
                  <TableHead>তারিখ</TableHead>
                  <TableHead>গ্রাহক</TableHead>
                  <TableHead>শাখা</TableHead>
                  <TableHead className="text-right">মোট (৳)</TableHead>
                  <TableHead>পেমেন্ট</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-primary text-sm font-medium">{s.invoice_number}</TableCell>
                    <TableCell className="text-sm">{format(new Date(s.created_at), 'dd/MM/yyyy hh:mm a')}</TableCell>
                    <TableCell>
                      <p className="font-medium">{s.customer_name}</p>
                      {s.customer_mobile && <p className="text-xs text-muted-foreground">{s.customer_mobile}</p>}
                    </TableCell>
                    <TableCell><Badge variant="secondary">{s.branches?.name || '-'}</Badge></TableCell>
                    <TableCell className="text-right font-bold">৳{s.total_amount?.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={s.payment_method === 'cash' ? 'default' : 'secondary'}>
                        {s.payment_method === 'cash' ? 'নগদ' : s.payment_method === 'bkash' ? 'বিকাশ' : s.payment_method === 'nagad' ? 'নগদ (ডি.)' : 'কার্ড'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => viewInvoice(s)}><Eye className="w-3 h-3" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredSales.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>কোনো বিক্রয় রেকর্ড নেই</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Dialog */}
      <Dialog open={!!invoiceDialog} onOpenChange={() => setInvoiceDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-heading">ইনভয়েস বিবরণ</DialogTitle></DialogHeader>
          {invoiceDialog && (
            <div className="space-y-3 text-sm">
              <div className="text-center border-b pb-3">
                <h3 className="font-bold text-lg">দুবাই বোরকা হাউজ</h3>
                <p className="text-muted-foreground">ইনভয়েস নং: {invoiceDialog.invoice_number}</p>
                <p className="text-muted-foreground">{format(new Date(invoiceDialog.created_at), 'dd/MM/yyyy hh:mm a')}</p>
              </div>
              <div>
                <p><strong>গ্রাহক:</strong> {invoiceDialog.customer_name}</p>
                {invoiceDialog.customer_mobile && <p><strong>মোবাইল:</strong> {invoiceDialog.customer_mobile}</p>}
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-xs">প্রোডাক্ট</TableHead>
                  <TableHead className="text-xs text-right">পরিমাণ</TableHead>
                  <TableHead className="text-xs text-right">দর</TableHead>
                  <TableHead className="text-xs text-right">মোট</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(invoiceDialog.items || []).map((i: any) => (
                    <TableRow key={i.id}>
                      <TableCell className="text-xs">{i.product_name}</TableCell>
                      <TableCell className="text-xs text-right">{i.quantity}</TableCell>
                      <TableCell className="text-xs text-right">৳{i.unit_price}</TableCell>
                      <TableCell className="text-xs text-right">৳{i.total_price}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t pt-2 space-y-1">
                <div className="flex justify-between"><span>সাবটোটাল:</span><span>৳{invoiceDialog.subtotal}</span></div>
                {invoiceDialog.discount_amount > 0 && (
                  <div className="flex justify-between text-destructive"><span>ডিসকাউন্ট ({invoiceDialog.discount_percent}%):</span><span>-৳{invoiceDialog.discount_amount}</span></div>
                )}
                <div className="flex justify-between font-bold text-lg"><span>মোট:</span><span>৳{invoiceDialog.total_amount}</span></div>
              </div>
              <Button onClick={printInvoice} className="w-full"><Printer className="w-4 h-4 mr-2" />প্রিন্ট করুন</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
