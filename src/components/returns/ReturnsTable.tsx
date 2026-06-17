import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Undo2 } from 'lucide-react';
import { format } from 'date-fns';
import { EmptyState } from '@/components/common/EmptyState';

export interface ReturnRow {
  id: string;
  return_number: string;
  created_at: string;
  customer_name: string;
  total_refund: number;
  reason?: string | null;
  branch_id: string;
  branches?: { name: string } | null;
}

interface Props {
  returns: ReturnRow[];
  onView: (row: ReturnRow) => void;
}

export function ReturnsTable({ returns, onView }: Props) {
  return (
    <Card className="border-border">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>রিটার্ন নং</TableHead>
                <TableHead>তারিখ</TableHead>
                <TableHead>গ্রাহক</TableHead>
                <TableHead>শাখা</TableHead>
                <TableHead className="text-right">রিফান্ড (৳)</TableHead>
                <TableHead>কারণ</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-primary text-sm font-medium">{r.return_number}</TableCell>
                  <TableCell className="text-sm">{format(new Date(r.created_at), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="font-medium">{r.customer_name}</TableCell>
                  <TableCell><Badge variant="secondary">{r.branches?.name || '-'}</Badge></TableCell>
                  <TableCell className="text-right font-bold text-destructive">৳{r.total_refund?.toLocaleString()}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{r.reason || '-'}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => onView(r)}><Eye className="w-3 h-3" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {returns.length === 0 && <EmptyState icon={Undo2} message="কোনো রিটার্ন নেই" />}
      </CardContent>
    </Card>
  );
}
