import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Branch } from '@/types';

export function BranchOnboardingDialog() {
  const { user, profile, isAdmin, loading } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const open = !loading && !!user && !isAdmin && !!profile && !profile.branch_id;

  useEffect(() => {
    if (!open) return;
    supabase.from('branches').select('*').order('name').then(({ data }) => {
      if (data) setBranches(data as unknown as Branch[]);
    });
  }, [open]);

  const handleClaim = async () => {
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase.rpc('claim_branch', { p_branch_id: selected });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('শাখা সফলভাবে নির্ধারিত হয়েছে');
    window.location.reload();
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>স্বাগতম! আপনার শাখা নির্বাচন করুন</DialogTitle>
          <DialogDescription>
            সিস্টেম ব্যবহার শুরু করার আগে একটি শাখা নির্বাচন করুন। এটি শুধুমাত্র একবারই সেট করা যাবে।
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger><SelectValue placeholder="শাখা বাছাই করুন" /></SelectTrigger>
            <SelectContent>
              {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={handleClaim} disabled={!selected || submitting} className="w-full">
            {submitting ? 'নির্ধারণ হচ্ছে...' : 'নিশ্চিত করুন'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
