import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Search, Users, Pencil, Trash2, Phone, Mail, MapPin } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  mobile: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  total_purchases: number;
  total_spent: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export default function Customers() {
  const { user, isAdmin } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [customerSales, setCustomerSales] = useState<any[]>([]);

  const [form, setForm] = useState({ name: '', mobile: '', email: '', address: '', notes: '' });

  const fetchData = async () => {
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    setCustomers((data as unknown as Customer[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const resetForm = () => setForm({ name: '', mobile: '', email: '', address: '', notes: '' });

  const openEdit = (c: Customer) => {
    setEditCustomer(c);
    setForm({ name: c.name, mobile: c.mobile || '', email: c.email || '', address: c.address || '', notes: c.notes || '' });
    setDialogOpen(true);
  };

  const openDetail = async (c: Customer) => {
    setDetailCustomer(c);
    const { data } = await supabase.from('sales').select('*').eq('customer_name', c.name).order('created_at', { ascending: false }).limit(50);
    setCustomerSales(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.name.trim()) { toast.error('গ্রাহকের নাম আবশ্যক'); return; }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        mobile: form.mobile.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editCustomer) {
        const { error } = await supabase.from('customers').update(payload).eq('id', editCustomer.id);
        if (error) throw error;
        toast.success('গ্রাহক আপডেট হয়েছে');
      } else {
        const { error } = await supabase.from('customers').insert({ ...payload, created_by: user.id });
        if (error) throw error;
        toast.success('নতুন গ্রাহক যুক্ত হয়েছে');
      }
      setDialogOpen(false);
      setEditCustomer(null);
      resetForm();
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('এই গ্রাহক মুছে ফেলতে চান?')) return;
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('গ্রাহক মুছে ফেলা হয়েছে'); fetchData(); }
  };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.mobile?.includes(searchTerm) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">লোড হচ্ছে...</p></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading">গ্রাহক তালিকা</h2>
          <p className="text-muted-foreground">মোট {filtered.length} জন গ্রাহক</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditCustomer(null); resetForm(); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />নতুন গ্রাহক</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="font-heading">{editCustomer ? 'গ্রাহক আপডেট' : 'নতুন গ্রাহক যুক্ত করুন'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label>নাম *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="গ্রাহকের নাম" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>মোবাইল</Label><Input value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} placeholder="01XXXXXXXXX" /></div>
                <div><Label>ইমেইল</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" /></div>
              </div>
              <div><Label>ঠিকানা</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="ঠিকানা" /></div>
              <div><Label>নোট</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="অতিরিক্ত তথ্য..." /></div>
              <Button type="submit" className="w-full" disabled={submitting}>{submitting ? 'সংরক্ষণ হচ্ছে...' : editCustomer ? 'আপডেট করুন' : 'যুক্ত করুন'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="নাম, মোবাইল বা ইমেইল দিয়ে খুঁজুন..." className="pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      <Card className="border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>নাম</TableHead>
                  <TableHead>মোবাইল</TableHead>
                  <TableHead>ইমেইল</TableHead>
                  <TableHead>ঠিকানা</TableHead>
                  <TableHead className="text-right">মোট কেনাকাটা</TableHead>
                  <TableHead className="text-right">মোট খরচ (৳)</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => openDetail(c)}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.mobile || '-'}</TableCell>
                    <TableCell className="text-sm">{c.email || '-'}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{c.address || '-'}</TableCell>
                    <TableCell className="text-right">{c.total_purchases}</TableCell>
                    <TableCell className="text-right font-medium">৳{c.total_spent.toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Pencil className="w-3 h-3" /></Button>
                        {isAdmin && <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>কোনো গ্রাহক পাওয়া যায়নি</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Detail Dialog */}
      <Dialog open={!!detailCustomer} onOpenChange={(o) => { if (!o) setDetailCustomer(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">{detailCustomer?.name}</DialogTitle></DialogHeader>
          {detailCustomer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {detailCustomer.mobile && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" />{detailCustomer.mobile}</div>}
                {detailCustomer.email && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" />{detailCustomer.email}</div>}
                {detailCustomer.address && <div className="flex items-center gap-2 col-span-2"><MapPin className="w-4 h-4 text-muted-foreground" />{detailCustomer.address}</div>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{detailCustomer.total_purchases}</p>
                  <p className="text-xs text-muted-foreground">মোট কেনাকাটা</p>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">৳{detailCustomer.total_spent.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">মোট খরচ</p>
                </div>
              </div>
              {detailCustomer.notes && <div className="text-sm bg-muted/50 rounded p-3"><strong>নোট:</strong> {detailCustomer.notes}</div>}
              {customerSales.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">সাম্প্রতিক কেনাকাটা</h4>
                  <div className="space-y-2">
                    {customerSales.slice(0, 10).map((s: any) => (
                      <div key={s.id} className="flex justify-between items-center text-sm bg-muted/30 rounded p-2">
                        <div>
                          <span className="font-mono text-primary">{s.invoice_number}</span>
                          <span className="text-muted-foreground ml-2">{new Date(s.created_at).toLocaleDateString('bn-BD')}</span>
                        </div>
                        <span className="font-medium">৳{s.total_amount?.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
