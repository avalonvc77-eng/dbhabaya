import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, AlertTriangle, CheckCircle, Download, RefreshCw } from 'lucide-react';
import type { Branch } from '@/types';

interface AuditRow {
  product_id: string;
  product_code: string;
  product_name: string;
  branch_name: string;
  branch_id: string;
  current_stock: number;
  calculated_stock: number;
  difference: number;
}

export default function StockAudit() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filterBranch, setFilterBranch] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [auditData, setAuditData] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMismatchOnly, setShowMismatchOnly] = useState(false);

  const fetchAudit = async () => {
    setLoading(true);
    const [pRes, bRes, mRes] = await Promise.all([
      supabase.from('products').select('id, product_code, name, branch_id, quantity').eq('status', 'active'),
      supabase.from('branches').select('*').order('name'),
      supabase.from('stock_movements').select('product_id, movement_type, quantity'),
    ]);

    const products = pRes.data || [];
    const branchList = (bRes.data as unknown as Branch[]) || [];
    const movements = mRes.data || [];
    setBranches(branchList);

    // Calculate expected stock from movements per product
    const movementMap: Record<string, number> = {};
    movements.forEach((m: any) => {
      if (!movementMap[m.product_id]) movementMap[m.product_id] = 0;
      if (m.movement_type === 'in') {
        movementMap[m.product_id] += m.quantity;
      } else if (m.movement_type === 'out' || m.movement_type === 'adjustment') {
        movementMap[m.product_id] -= m.quantity;
      }
      // transfers: 'transfer' notes contain আউট/ইন but we track as net effect
      // For reconciliation, we just compare current_stock vs what DB says
    });

    const rows: AuditRow[] = products.map((p: any) => {
      const branch = branchList.find(b => b.id === p.branch_id);
      const calcStock = movementMap[p.id] ?? 0;
      return {
        product_id: p.id,
        product_code: p.product_code,
        product_name: p.name,
        branch_name: branch?.name || 'অজানা',
        branch_id: p.branch_id,
        current_stock: p.quantity,
        calculated_stock: calcStock,
        difference: p.quantity - calcStock,
      };
    });

    setAuditData(rows);
    setLoading(false);
  };

  useEffect(() => { fetchAudit(); }, []);

  const filtered = auditData.filter(r => {
    const matchBranch = filterBranch === 'all' || r.branch_id === filterBranch;
    const matchSearch = !searchTerm ||
      r.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.product_code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchMismatch = !showMismatchOnly || r.difference !== 0;
    return matchBranch && matchSearch && matchMismatch;
  });

  const totalProducts = filtered.length;
  const mismatchCount = filtered.filter(r => r.difference !== 0).length;
  const matchCount = totalProducts - mismatchCount;

  const exportCSV = () => {
    const header = 'প্রোডাক্ট কোড,প্রোডাক্ট নাম,শাখা,বর্তমান স্টক,গণনাকৃত স্টক,পার্থক্য\n';
    const rows = filtered.map(r =>
      `${r.product_code},${r.product_name},${r.branch_name},${r.current_stock},${r.calculated_stock},${r.difference}`
    ).join('\n');
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">অডিট ডাটা লোড হচ্ছে...</p></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading">স্টক রিকনসিলিয়েশন / অডিট</h2>
          <p className="text-muted-foreground">বর্তমান স্টক বনাম মুভমেন্ট থেকে গণনাকৃত স্টকের তুলনা</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAudit}><RefreshCw className="w-4 h-4 mr-2" />রিফ্রেশ</Button>
          <Button variant="outline" onClick={exportCSV}><Download className="w-4 h-4 mr-2" />CSV ডাউনলোড</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{matchCount}</p>
                <p className="text-sm text-muted-foreground">মিল আছে</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{mismatchCount}</p>
                <p className="text-sm text-muted-foreground">অমিল আছে</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalProducts}</p>
                <p className="text-sm text-muted-foreground">মোট প্রোডাক্ট</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="প্রোডাক্ট খুঁজুন..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterBranch} onValueChange={setFilterBranch}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="শাখা ফিল্টার" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সকল শাখা</SelectItem>
            {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={showMismatchOnly ? 'default' : 'outline'} onClick={() => setShowMismatchOnly(!showMismatchOnly)}>
          <AlertTriangle className="w-4 h-4 mr-2" />
          শুধু অমিল
        </Button>
      </div>

      {/* Table */}
      <Card className="border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>কোড</TableHead>
                  <TableHead>প্রোডাক্ট</TableHead>
                  <TableHead>শাখা</TableHead>
                  <TableHead className="text-right">বর্তমান স্টক</TableHead>
                  <TableHead className="text-right">গণনাকৃত স্টক</TableHead>
                  <TableHead className="text-right">পার্থক্য</TableHead>
                  <TableHead>স্ট্যাটাস</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.product_id} className={r.difference !== 0 ? 'bg-destructive/5' : ''}>
                    <TableCell className="font-mono text-xs text-primary">{r.product_code}</TableCell>
                    <TableCell className="font-medium">{r.product_name}</TableCell>
                    <TableCell><Badge variant="secondary">{r.branch_name}</Badge></TableCell>
                    <TableCell className="text-right font-medium">{r.current_stock}</TableCell>
                    <TableCell className="text-right">{r.calculated_stock}</TableCell>
                    <TableCell className={`text-right font-bold ${r.difference !== 0 ? 'text-destructive' : 'text-green-600'}`}>
                      {r.difference > 0 ? `+${r.difference}` : r.difference}
                    </TableCell>
                    <TableCell>
                      {r.difference === 0 ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">✓ মিল</Badge>
                      ) : (
                        <Badge variant="destructive">✗ অমিল</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">কোনো ডাটা পাওয়া যায়নি</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
