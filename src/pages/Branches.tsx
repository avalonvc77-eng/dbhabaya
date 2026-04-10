import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Store, Phone, MapPin, Star, Pencil, Trash2 } from 'lucide-react';
import type { Branch } from '@/types';

export default function Branches() {
  const { isAdmin } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: '', shop_code: '', address: '', phone: '', is_main: false });

  const fetchBranches = async () => {
    const { data } = await supabase.from('branches').select('*').order('created_at');
    setBranches((data as unknown as Branch[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchBranches(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editBranch) {
        const { error } = await supabase.from('branches').update(form).eq('id', editBranch.id);
        if (error) throw error;
        toast.success('শাখা আপডেট হয়েছে');
      } else {
        const { error } = await supabase.from('branches').insert(form);
        if (error) throw error;
        toast.success('নতুন শাখা যুক্ত হয়েছে');
      }
      setDialogOpen(false);
      setEditBranch(null);
      setForm({ name: '', shop_code: '', address: '', phone: '', is_main: false });
      fetchBranches();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('এই শাখা মুছে ফেলতে চান?')) return;
    const { error } = await supabase.from('branches').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('শাখা মুছে ফেলা হয়েছে'); fetchBranches(); }
  };

  const openEdit = (branch: Branch) => {
    setEditBranch(branch);
    setForm({ name: branch.name, shop_code: branch.shop_code, address: branch.address || '', phone: branch.phone || '', is_main: branch.is_main });
    setDialogOpen(true);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">লোড হচ্ছে...</p></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-heading">শাখাসমূহ</h2>
          <p className="text-muted-foreground">সকল শো-রুমের তালিকা</p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditBranch(null); setForm({ name: '', shop_code: '', address: '', phone: '', is_main: false }); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />নতুন শাখা</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-heading">{editBranch ? 'শাখা আপডেট করুন' : 'নতুন শাখা যুক্ত করুন'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><Label>শাখার নাম</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
                <div><Label>শপ কোড</Label><Input value={form.shop_code} onChange={e => setForm({ ...form, shop_code: e.target.value })} placeholder="যেমন: DBH-001" required /></div>
                <div><Label>ঠিকানা</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
                <div><Label>ফোন</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="is_main" checked={form.is_main} onChange={e => setForm({ ...form, is_main: e.target.checked })} />
                  <Label htmlFor="is_main">মেইন শাখা</Label>
                </div>
                <Button type="submit" className="w-full">{editBranch ? 'আপডেট করুন' : 'যুক্ত করুন'}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {branches.map(branch => (
          <Card key={branch.id} className="card-hover border-border relative">
            {branch.is_main && (
              <div className="absolute top-3 right-3">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent/20 text-accent-foreground text-xs font-medium">
                  <Star className="w-3 h-3" />মেইন
                </span>
              </div>
            )}
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Store className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground font-heading">{branch.name}</h3>
                  <p className="text-sm text-primary font-mono mt-1">{branch.shop_code}</p>
                  {branch.address && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-2"><MapPin className="w-3 h-3" />{branch.address}</p>
                  )}
                  {branch.phone && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1"><Phone className="w-3 h-3" />{branch.phone}</p>
                  )}
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                  <Button variant="outline" size="sm" onClick={() => openEdit(branch)}><Pencil className="w-3 h-3 mr-1" />এডিট</Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDelete(branch.id)}><Trash2 className="w-3 h-3 mr-1" />মুছুন</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {branches.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">কোনো শাখা যুক্ত করা হয়নি</div>
      )}
    </div>
  );
}
