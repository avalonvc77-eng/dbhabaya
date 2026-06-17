import { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Search, Undo2 } from 'lucide-react';
import { format } from 'date-fns';
import { salesReturnSchema, firstZodError } from '@/lib/validation';

interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface ReturnItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  max_qty: number;
}

interface Props {
  onSuccess: () => void;
}

export function ReturnForm({ onSuccess }: Props) {
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const totalRefund = useMemo(
    () => returnItems.reduce((s, r) => s + r.quantity * r.unit_price, 0),
    [returnItems]
  );

  const searchInvoice = async () => {
    if (!invoiceSearch.trim()) return;
    const { data, error } = await supabase
      .from('sales')
      .select('*, branches:branch_id(name)')
      .eq('invoice_number', invoiceSearch.trim())
      .single();
    if (error || !data) { toast.error('ইনভয়েস খুঁজে পাওয়া যায়নি'); return; }
    setSelectedSale(data);
    const { data: items } = await supabase.from('sale_items').select('*').eq('sale_id', data.id);
    setSaleItems((items as SaleItem[]) || []);
    setReturnItems([]);
  };

  const toggleReturnItem = (item: SaleItem) => {
    setReturnItems(prev => {
      if (prev.some(r => r.product_id === item.product_id)) {
        return prev.filter(r => r.product_id !== item.product_id);
      }
      return [...prev, {
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        max_qty: item.quantity,
      }];
    });
  };

  const updateReturnQty = (productId: string, qty: number) => {
    setReturnItems(prev => prev.map(r =>
      r.product_id === productId ? { ...r, quantity: Math.min(qty, r.max_qty) } : r
    ));
  };

  const handleSubmit = async () => {
    if (!selectedSale) return;
    const parsed = salesReturnSchema.safeParse({
      sale_id: selectedSale.id,
      reason,
      items: returnItems.map(r => ({
        product_id: r.product_id,
        product_name: r.product_name,
        quantity: r.quantity,
        unit_price: r.unit_price,
      })),
    });
    if (!parsed.success) {
      toast.error(firstZodError(parsed.error));
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('create_sales_return', {
        p_sale_id: parsed.data.sale_id,
        p_reason: parsed.data.reason || null,
        p_items: parsed.data.items,
      });
      if (error) throw error;
      const result = data as { return_number: string };
      toast.success(`রিটার্ন সম্পন্ন! রিটার্ন নং: ${result.return_number}`);
      setSelectedSale(null); setSaleItems([]); setReturnItems([]); setReason(''); setInvoiceSearch('');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'রিটার্ন সম্পন্ন হয়নি');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>ইনভয়েস নম্বর দিয়ে খুঁজুন *</Label>
        <div className="flex gap-2">
          <Input
            value={invoiceSearch}
            onChange={e => setInvoiceSearch(e.target.value)}
            placeholder="DBH-INV-000001"
            onKeyDown={e => e.key === 'Enter' && searchInvoice()}
          />
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
                {saleItems.map(item => {
                  const ri = returnItems.find(r => r.product_id === item.product_id);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <input type="checkbox" checked={!!ri} onChange={() => toggleReturnItem(item)} className="rounded" />
                      </TableCell>
                      <TableCell className="text-sm">{item.product_name}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {ri && (
                          <Input
                            type="number" min="1" max={item.quantity}
                            value={ri.quantity}
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
            <div className="flex justify-between font-bold text-lg">
              <span>রিফান্ড পরিমাণ:</span><span>৳{totalRefund.toLocaleString()}</span>
            </div>
          </div>

          <Button onClick={handleSubmit} className="w-full" disabled={submitting || returnItems.length === 0}>
            <Undo2 className="w-4 h-4 mr-2" />{submitting ? 'প্রসেস হচ্ছে...' : 'রিটার্ন সম্পন্ন করুন'}
          </Button>
        </>
      )}
    </div>
  );
}
