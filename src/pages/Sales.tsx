import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import type { Branch, Product } from '@/types';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingState } from '@/components/common/LoadingState';
import { BranchFilter } from '@/components/common/BranchFilter';
import { SalesForm } from '@/components/sales/SalesForm';
import { SalesTable, type SaleRow } from '@/components/sales/SalesTable';
import { InvoiceDialog } from '@/components/sales/InvoiceDialog';
import type { InvoicePayload } from '@/components/sales/printInvoice';

export default function Sales() {
  const { isAdmin } = useAuth();
  const { userBranchId } = useAuth();
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [invoiceDialog, setInvoiceDialog] = useState<InvoicePayload | null>(null);
  const [filterBranch, setFilterBranch] = useState('all');

  const fetchData = async () => {
    const [sRes, pRes, bRes] = await Promise.all([
      supabase.from('sales').select('*, branches:branch_id(name)').order('created_at', { ascending: false }).limit(200),
      supabase.from('products').select('*').eq('status', 'active').order('name'),
      supabase.from('branches').select('*').order('name'),
    ]);
    setSales((sRes.data as SaleRow[]) || []);
    setProducts((pRes.data as unknown as Product[]) || []);
    setBranches((bRes.data as unknown as Branch[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filteredSales = useMemo(
    () => (filterBranch === 'all' ? sales : sales.filter(s => s.branch_id === filterBranch)),
    [sales, filterBranch]
  );

  const viewInvoice = async (sale: SaleRow) => {
    const { data: items } = await supabase.from('sale_items').select('*').eq('sale_id', sale.id);
    setInvoiceDialog({ ...(sale as any), items: items || [] });
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="বিক্রয়"
        subtitle={`মোট ${filteredSales.length}টি বিক্রয় রেকর্ড`}
        actions={
          <>
            {isAdmin && <BranchFilter branches={branches} value={filterBranch} onChange={setFilterBranch} />}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" />নতুন বিক্রয়</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle className="font-heading">নতুন বিক্রয় রেকর্ড</DialogTitle></DialogHeader>
                <SalesForm
                  products={products}
                  isAdmin={isAdmin}
                  userBranchId={userBranchId}
                  onSuccess={() => { setDialogOpen(false); fetchData(); }}
                />
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <SalesTable sales={filteredSales} onView={viewInvoice} />
      <InvoiceDialog invoice={invoiceDialog} onClose={() => setInvoiceDialog(null)} />
    </div>
  );
}
