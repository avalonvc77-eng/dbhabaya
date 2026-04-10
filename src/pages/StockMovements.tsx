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
import { Plus, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, Settings2 } from 'lucide-react';
import type { Branch, Product } from '@/types';
import { format } from 'date-fns';

const movementTypes = [
  { value: 'in', label: 'স্টক ইন', icon: ArrowDownCircle, color: 'bg-green-100 text-green-700' },
  { value: 'out', label: 'স্টক আউট', icon: ArrowUpCircle, color: 'bg-red-100 text-red-700' },
  { value: 'transfer', label: 'ট্রান্সফার', icon: ArrowLeftRight, color: 'bg-blue-100 text-blue-700' },
  { value: 'adjustment', label: 'অ্যাডজাস্টমেন্ট', icon: Settings2, color: 'bg-yellow-100 text-yellow-700' },
];

export default function StockMovements() {
  const { user, isAdmin, userBranchId } = useAuth();
  const [movements, setMovements] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ product_id: '', branch_id: '', movement_type: 'in', quantity: '', notes: '' });

  const fetchData = async () => {
    const [mRes, pRes, bRes] = await Promise.all([
      supabase.from('stock_movements').select('*, products:product_id(name, product_code), branches:branch_id(name)').order('created_at', { ascending: false }).limit(100),
      supabase.from('products').select('*').order('name'),
      supabase.from('branches').select('*').order('name'),
    ]);
    setMovements(mRes.data || []);
    setProducts((pRes.data as unknown as Product[]) || []);
    setBranches((bRes.data as unknown as Branch[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const branchId = isAdmin ? form.branch_id : (userBranchId || '');
    try {
      const { error } = await supabase.from('stock_movements').insert({
        product_id: form.product_id,
        branch_id: branchId,
        movement_type: form.movement_type,
        quantity: parseInt(form.quantity),
        notes: form.notes || null,
        created_by: user.id,
      });
      if (error) throw error;

      // Update product quantity
      const product = products.find(p => p.id === form.product_id);
      if (product) {
        const qty = parseInt(form.quantity);
        const newQty = form.movement_type === 'in' ? product.quantity + qty : form.movement_type === 'out' ? product.quantity - qty : product.quantity;
        await supabase.from('products').update({ quantity: newQty }).eq('id', product.id);
      }

      toast.success('স্টক মুভমেন্ট রেকর্ড হয়েছে');
      setDialogOpen(false);
      setForm({ product_id: '', branch_id: '', movement_type: 'in', quantity: '', notes: '' });
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getMovementType = (type: string) => movementTypes.find(m => m.value === type);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">লোড হচ্ছে...</p></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-heading">স্টক মুভমেন্ট</h2>
          <p className="text-muted-foreground">স্টক ইন/আউট ট্র্যাকিং</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />নতুন মুভমেন্ট</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading">স্টক মুভমেন্ট রেকর্ড করুন</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>প্রোডাক্ট</Label>
                <Select value={form.product_id} onValueChange={v => setForm({ ...form, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                  <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.product_code} - {p.name}</SelectItem>)}</SelectContent>
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
              <div>
                <Label>ধরন</Label>
                <Select value={form.movement_type} onValueChange={v => setForm({ ...form, movement_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {movementTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>পরিমাণ</Label><Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required min="1" /></div>
              <div><Label>নোট</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <Button type="submit" className="w-full">রেকর্ড করুন</Button>
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
                  <TableHead>ধরন</TableHead>
                  <TableHead className="text-right">পরিমাণ</TableHead>
                  <TableHead>নোট</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m: any) => {
                  const type = getMovementType(m.movement_type);
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm">{format(new Date(m.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{m.products?.name}</p>
                          <p className="text-xs text-primary font-mono">{m.products?.product_code}</p>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{m.branches?.name}</Badge></TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${type?.color}`}>
                          {type?.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">{m.quantity}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{m.notes || '-'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {movements.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">কোনো স্টক মুভমেন্ট নেই</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
