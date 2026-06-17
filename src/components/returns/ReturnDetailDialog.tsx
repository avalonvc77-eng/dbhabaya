import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import type { ReturnRow } from './ReturnsTable';

interface DetailItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Props {
  returnRow: ReturnRow | null;
  onClose: () => void;
}

export function ReturnDetailDialog({ returnRow, onClose }: Props) {
  const [items, setItems] = useState<DetailItem[]>([]);

  useEffect(() => {
    if (!returnRow) { setItems([]); return; }
    supabase.from('sales_return_items').select('*').eq('return_id', returnRow.id)
      .then(({ data }) => setItems((data as DetailItem[]) || []));
  }, [returnRow]);

  return (
    <Dialog open={!!returnRow} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-heading">রিটার্ন বিবরণ</DialogTitle></DialogHeader>
        {returnRow && (
          <div className="space-y-3">
            <div className="text-sm space-y-1">
              <p><strong>রিটার্ন নং:</strong> {returnRow.return_number}</p>
              <p><strong>গ্রাহক:</strong> {returnRow.customer_name}</p>
              <p><strong>তারিখ:</strong> {format(new Date(returnRow.created_at), 'dd/MM/yyyy hh:mm a')}</p>
              {returnRow.reason && <p><strong>কারণ:</strong> {returnRow.reason}</p>}
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
                {items.map(i => (
                  <TableRow key={i.id}>
                    <TableCell className="text-sm">{i.product_name}</TableCell>
                    <TableCell className="text-right">{i.quantity}</TableCell>
                    <TableCell className="text-right">৳{i.unit_price}</TableCell>
                    <TableCell className="text-right font-medium">৳{i.total_price?.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="text-right font-bold text-lg text-destructive">
              রিফান্ড: ৳{returnRow.total_refund?.toLocaleString()}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
