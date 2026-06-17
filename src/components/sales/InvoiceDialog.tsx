import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';
import { printInvoice, type InvoicePayload } from './printInvoice';

interface Props {
  invoice: InvoicePayload | null;
  onClose: () => void;
}

export function InvoiceDialog({ invoice, onClose }: Props) {
  return (
    <Dialog open={!!invoice} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-heading">ইনভয়েস বিবরণ</DialogTitle></DialogHeader>
        {invoice && (
          <div className="space-y-3 text-sm">
            <div className="text-center border-b pb-3">
              <h3 className="font-bold text-lg">দুবাই বোরকা হাউজ</h3>
              <p className="text-muted-foreground">ইনভয়েস নং: {invoice.invoice_number}</p>
              <p className="text-muted-foreground">{format(new Date(invoice.created_at), 'dd/MM/yyyy hh:mm a')}</p>
            </div>
            <div>
              <p><strong>গ্রাহক:</strong> {invoice.customer_name}</p>
              {invoice.customer_mobile && <p><strong>মোবাইল:</strong> {invoice.customer_mobile}</p>}
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-xs">প্রোডাক্ট</TableHead>
                <TableHead className="text-xs text-right">পরিমাণ</TableHead>
                <TableHead className="text-xs text-right">দর</TableHead>
                <TableHead className="text-xs text-right">মোট</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {invoice.items.map((i, idx) => (
                  <TableRow key={i.id ?? idx}>
                    <TableCell className="text-xs">{i.product_name}</TableCell>
                    <TableCell className="text-xs text-right">{i.quantity}</TableCell>
                    <TableCell className="text-xs text-right">৳{i.unit_price}</TableCell>
                    <TableCell className="text-xs text-right">৳{i.total_price}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t pt-2 space-y-1">
              <div className="flex justify-between"><span>সাবটোটাল:</span><span>৳{invoice.subtotal}</span></div>
              {invoice.discount_amount > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>ডিসকাউন্ট ({invoice.discount_percent}%):</span><span>-৳{invoice.discount_amount}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg"><span>মোট:</span><span>৳{invoice.total_amount}</span></div>
            </div>
            <Button onClick={() => printInvoice(invoice)} className="w-full">
              <Printer className="w-4 h-4 mr-2" />প্রিন্ট করুন
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
