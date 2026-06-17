import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, ShoppingCart } from 'lucide-react';
import { format } from 'date-fns';
import { EmptyState } from '@/components/common/EmptyState';

export interface SaleRow {
  id: string;
  invoice_number: string;
  created_at: string;
  customer_name: string;
  customer_mobile?: string | null;
  total_amount: number;
  payment_method: string;
  branch_id: string;
  branches?: { name: string } | null;
}

interface Props {
  sales: SaleRow[];
  onView: (sale: SaleRow) => void;
}

const paymentBadge = (m: string) =>
  m === 'cash' ? 'নগদ' : m === 'bkash' ? 'বিকাশ' : m === 'nagad' ? 'নগদ (ডি.)' : 'কার্ড';

export function SalesTable({ sales, onView }: Props) {
  return (
    <Card className="border-border">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ইনভয়েস</TableHead>
                <TableHead>তারিখ</TableHead>
                <TableHead>গ্রাহক</TableHead>
                <TableHead>শাখা</TableHead>
                <TableHead className="text-right">মোট (৳)</TableHead>
                <TableHead>পেমেন্ট</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-primary text-sm font-medium">{s.invoice_number}</TableCell>
                  <TableCell className="text-sm">{format(new Date(s.created_at), 'dd/MM/yyyy hh:mm a')}</TableCell>
                  <TableCell>
                    <p className="font-medium">{s.customer_name}</p>
                    {s.customer_mobile && <p className="text-xs text-muted-foreground">{s.customer_mobile}</p>}
                  </TableCell>
                  <TableCell><Badge variant="secondary">{s.branches?.name || '-'}</Badge></TableCell>
                  <TableCell className="text-right font-bold">৳{s.total_amount?.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={s.payment_method === 'cash' ? 'default' : 'secondary'}>
                      {paymentBadge(s.payment_method)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => onView(s)}><Eye className="w-3 h-3" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {sales.length === 0 && <EmptyState icon={ShoppingCart} message="কোনো বিক্রয় রেকর্ড নেই" />}
      </CardContent>
    </Card>
  );
}
