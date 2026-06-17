import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import type { Branch } from '@/types';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingState } from '@/components/common/LoadingState';
import { BranchFilter } from '@/components/common/BranchFilter';
import { SearchInput } from '@/components/common/SearchInput';
import { ReturnForm } from '@/components/returns/ReturnForm';
import { ReturnsTable, type ReturnRow } from '@/components/returns/ReturnsTable';
import { ReturnDetailDialog } from '@/components/returns/ReturnDetailDialog';

export default function SalesReturn() {
  const { isAdmin } = useAuth();
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBranch, setFilterBranch] = useState('all');
  const [detailReturn, setDetailReturn] = useState<ReturnRow | null>(null);

  const fetchData = async () => {
    const [rRes, bRes] = await Promise.all([
      supabase.from('sales_returns').select('*, branches:branch_id(name)').order('created_at', { ascending: false }),
      supabase.from('branches').select('*').order('name'),
    ]);
    setReturns((rRes.data as ReturnRow[]) || []);
    setBranches((bRes.data as unknown as Branch[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filteredReturns = useMemo(() => returns.filter(r => {
    const term = searchTerm.toLowerCase();
    const matchSearch = !term ||
      r.return_number?.toLowerCase().includes(term) ||
      r.customer_name?.toLowerCase().includes(term);
    const matchBranch = filterBranch === 'all' || r.branch_id === filterBranch;
    return matchSearch && matchBranch;
  }), [returns, searchTerm, filterBranch]);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="বিক্রয় রিটার্ন"
        subtitle={`মোট ${filteredReturns.length}টি রিটার্ন`}
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />নতুন রিটার্ন</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-heading">বিক্রয় রিটার্ন</DialogTitle></DialogHeader>
              <ReturnForm onSuccess={() => { setDialogOpen(false); fetchData(); }} />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex gap-3 flex-wrap">
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="রিটার্ন নং বা গ্রাহক..." />
        {isAdmin && <BranchFilter branches={branches} value={filterBranch} onChange={setFilterBranch} width="w-[180px]" />}
      </div>

      <ReturnsTable returns={filteredReturns} onView={setDetailReturn} />
      <ReturnDetailDialog returnRow={detailReturn} onClose={() => setDetailReturn(null)} />
    </div>
  );
}
