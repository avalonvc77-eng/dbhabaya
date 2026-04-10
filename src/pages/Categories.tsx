import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Tags, Pencil, Trash2 } from 'lucide-react';
import type { Category } from '@/types';

export default function Categories() {
  const { isAdmin } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    setCategories((data as unknown as Category[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editCat) {
        const { error } = await supabase.from('categories').update(form).eq('id', editCat.id);
        if (error) throw error;
        toast.success('ক্যাটেগরি আপডেট হয়েছে');
      } else {
        const { error } = await supabase.from('categories').insert(form);
        if (error) throw error;
        toast.success('নতুন ক্যাটেগরি যুক্ত হয়েছে');
      }
      setDialogOpen(false);
      setEditCat(null);
      setForm({ name: '', description: '' });
      fetchCategories();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('এই ক্যাটেগরি মুছে ফেলতে চান?')) return;
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('ক্যাটেগরি মুছে ফেলা হয়েছে'); fetchCategories(); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">লোড হচ্ছে...</p></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-heading">ক্যাটেগরি</h2>
          <p className="text-muted-foreground">প্রোডাক্ট ক্যাটেগরি পরিচালনা</p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditCat(null); setForm({ name: '', description: '' }); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />নতুন ক্যাটেগরি</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-heading">{editCat ? 'ক্যাটেগরি আপডেট' : 'নতুন ক্যাটেগরি'}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><Label>নাম</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
                <div><Label>বিবরণ</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                <Button type="submit" className="w-full">{editCat ? 'আপডেট' : 'যুক্ত করুন'}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map(cat => (
          <Card key={cat.id} className="card-hover border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                  <Tags className="w-5 h-5 text-accent-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{cat.name}</h3>
                  {cat.description && <p className="text-sm text-muted-foreground">{cat.description}</p>}
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-2 mt-4 pt-3 border-t border-border">
                  <Button variant="outline" size="sm" onClick={() => { setEditCat(cat); setForm({ name: cat.name, description: cat.description || '' }); setDialogOpen(true); }}>
                    <Pencil className="w-3 h-3 mr-1" />এডিট
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDelete(cat.id)}>
                    <Trash2 className="w-3 h-3 mr-1" />মুছুন
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
