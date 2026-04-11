import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReportDownload } from '@/components/ReportDownload';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { Package, TrendingUp, AlertTriangle, ArrowLeftRight } from 'lucide-react';
import { format, subDays, startOfWeek, startOfMonth, endOfWeek, endOfMonth, isWithinInterval } from 'date-fns';
import type { Branch, Product } from '@/types';

const COLORS = ['hsl(164, 60%, 28%)', 'hsl(36, 80%, 50%)', 'hsl(200, 60%, 45%)', 'hsl(340, 60%, 50%)', 'hsl(120, 40%, 40%)', 'hsl(270, 50%, 55%)', 'hsl(20, 70%, 50%)', 'hsl(180, 50%, 40%)'];

type Period = 'daily' | 'weekly' | 'monthly';

export default function Reports() {
  const { isAdmin, userBranchId } = useAuth();
  const [period, setPeriod] = useState<Period>('daily');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [bRes, pRes, mRes] = await Promise.all([
        supabase.from('branches').select('*').order('name'),
        supabase.from('products').select('*, branches:branch_id(name), categories:category_id(name)').order('name'),
        supabase.from('stock_movements').select('*, products:product_id(name, product_code, sell_price), branches:branch_id(name)').order('created_at', { ascending: false }),
      ]);
      setBranches((bRes.data as unknown as Branch[]) || []);
      setProducts((pRes.data as unknown as Product[]) || []);
      setMovements(mRes.data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const getDateRange = () => {
    const now = new Date();
    if (period === 'daily') return { start: subDays(now, 1), end: now };
    if (period === 'weekly') return { start: startOfWeek(now, { weekStartsOn: 6 }), end: endOfWeek(now, { weekStartsOn: 6 }) };
    return { start: startOfMonth(now), end: endOfMonth(now) };
  };

  const { start, end } = getDateRange();

  const filteredMovements = movements.filter(m => {
    const d = new Date(m.created_at);
    const inRange = isWithinInterval(d, { start, end });
    const inBranch = branchFilter === 'all' || m.branch_id === branchFilter;
    return inRange && inBranch;
  });

  const filteredProducts = branchFilter === 'all' ? products : products.filter(p => p.branch_id === branchFilter);

  const stockIn = filteredMovements.filter(m => m.movement_type === 'in');
  const stockOut = filteredMovements.filter(m => m.movement_type === 'out');
  const transfers = filteredMovements.filter(m => m.movement_type === 'transfer');

  const totalStockInQty = stockIn.reduce((s, m) => s + m.quantity, 0);
  const totalStockOutQty = stockOut.reduce((s, m) => s + m.quantity, 0);
  const totalSalesValue = stockOut.reduce((s, m) => s + (m.quantity * (m.products?.sell_price || 0)), 0);
  const lowStockProducts = filteredProducts.filter(p => p.quantity < p.min_stock);

  // Branch-wise stock distribution
  const branchStockData = branches.map(b => {
    const branchProducts = products.filter(p => p.branch_id === b.id);
    const totalQty = branchProducts.reduce((s, p) => s + p.quantity, 0);
    const totalValue = branchProducts.reduce((s, p) => s + (p.quantity * p.sell_price), 0);
    return { name: b.name, quantity: totalQty, value: totalValue };
  });

  // Category-wise distribution
  const categoryMap: Record<string, number> = {};
  filteredProducts.forEach(p => {
    const cat = (p as any).categories?.name || 'অন্যান্য';
    categoryMap[cat] = (categoryMap[cat] || 0) + p.quantity;
  });
  const categoryData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

  // Daily movement trend (last 7 days)
  const trendData = Array.from({ length: 7 }, (_, i) => {
    const day = subDays(new Date(), 6 - i);
    const dayStr = format(day, 'dd/MM');
    const dayMovements = movements.filter(m => format(new Date(m.created_at), 'dd/MM') === dayStr);
    return {
      date: dayStr,
      in: dayMovements.filter(m => m.movement_type === 'in').reduce((s, m) => s + m.quantity, 0),
      out: dayMovements.filter(m => m.movement_type === 'out').reduce((s, m) => s + m.quantity, 0),
    };
  });

  const periodLabel = period === 'daily' ? 'আজকের' : period === 'weekly' ? 'এই সপ্তাহের' : 'এই মাসের';

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">লোড হচ্ছে...</p></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading">রিপোর্ট</h2>
          <p className="text-muted-foreground">বিক্রয় ও স্টক রিপোর্ট — চার্ট ও টেবিল সহ</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={v => setPeriod(v as Period)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">দৈনিক</SelectItem>
              <SelectItem value="weekly">সাপ্তাহিক</SelectItem>
              <SelectItem value="monthly">মাসিক</SelectItem>
            </SelectContent>
          </Select>
          <ReportDownload data={{
            title: `${periodLabel}_স্টক_রিপোর্ট`,
            headers: ['শাখা', 'মোট পরিমাণ', 'মোট মূল্য (৳)'],
            rows: branchStockData.map(b => [b.name, b.quantity, `৳${b.value.toLocaleString()}`]),
            summary: { 'মোট স্টক ইন': totalStockInQty, 'মোট স্টক আউট': totalStockOutQty, 'মোট বিক্রয় মূল্য': `৳${totalSalesValue.toLocaleString()}` }
          }} />
          {isAdmin && (
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সকল শাখা</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: `${periodLabel} স্টক ইন`, value: totalStockInQty, icon: Package, color: 'text-success' },
          { title: `${periodLabel} স্টক আউট`, value: totalStockOutQty, icon: TrendingUp, color: 'text-primary' },
          { title: `${periodLabel} বিক্রয় মূল্য`, value: `৳${totalSalesValue.toLocaleString()}`, icon: TrendingUp, color: 'text-info' },
          { title: 'কম স্টক প্রোডাক্ট', value: lowStockProducts.length, icon: AlertTriangle, color: 'text-warning' },
        ].map(card => (
          <Card key={card.title} className="card-hover border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <p className="text-2xl font-bold font-heading mt-1">{card.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-muted flex items-center justify-center ${card.color}`}>
                  <card.icon className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="stock" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stock">স্টক রিপোর্ট</TabsTrigger>
          <TabsTrigger value="movement">মুভমেন্ট রিপোর্ট</TabsTrigger>
          <TabsTrigger value="lowstock">কম স্টক</TabsTrigger>
        </TabsList>

        {/* Stock Report Tab */}
        <TabsContent value="stock" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-border">
              <CardHeader><CardTitle className="font-heading text-base">শাখা অনুযায়ী স্টক পরিমাণ</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={branchStockData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="quantity" fill="hsl(164, 60%, 28%)" radius={[6, 6, 0, 0]} name="পরিমাণ" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader><CardTitle className="font-heading text-base">ক্যাটেগরি অনুযায়ী স্টক</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Branch stock table */}
          <Card className="border-border">
            <CardHeader><CardTitle className="font-heading text-base">শাখা অনুযায়ী স্টক বিবরণ</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>শাখা</TableHead>
                    <TableHead className="text-right">মোট প্রোডাক্ট</TableHead>
                    <TableHead className="text-right">মোট পরিমাণ</TableHead>
                    <TableHead className="text-right">মোট মূল্য (৳)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branchStockData.map(b => (
                    <TableRow key={b.name}>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell className="text-right">{products.filter(p => {
                        const br = branches.find(br => br.name === b.name);
                        return br && p.branch_id === br.id;
                      }).length}</TableCell>
                      <TableCell className="text-right">{b.quantity}</TableCell>
                      <TableCell className="text-right font-medium">৳{b.value.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Movement Report Tab */}
        <TabsContent value="movement" className="space-y-4">
          <Card className="border-border">
            <CardHeader><CardTitle className="font-heading text-base">গত ৭ দিনের মুভমেন্ট ট্রেন্ড</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="in" stroke="hsl(164, 60%, 28%)" strokeWidth={2} name="স্টক ইন" />
                  <Line type="monotone" dataKey="out" stroke="hsl(0, 60%, 50%)" strokeWidth={2} name="স্টক আউট" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader><CardTitle className="font-heading text-base">{periodLabel} মুভমেন্ট তালিকা</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>তারিখ</TableHead>
                    <TableHead>প্রোডাক্ট</TableHead>
                    <TableHead>শাখা</TableHead>
                    <TableHead>ধরন</TableHead>
                    <TableHead className="text-right">পরিমাণ</TableHead>
                    <TableHead className="text-right">মূল্য (৳)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMovements.slice(0, 50).map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm">{format(new Date(m.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                      <TableCell>
                        <p className="font-medium">{m.products?.name}</p>
                        <p className="text-xs text-primary font-mono">{m.products?.product_code}</p>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{m.branches?.name}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={m.movement_type === 'in' ? 'default' : m.movement_type === 'out' ? 'destructive' : 'secondary'}>
                          {m.movement_type === 'in' ? 'ইন' : m.movement_type === 'out' ? 'আউট' : m.movement_type === 'transfer' ? 'ট্রান্সফার' : 'অ্যাডজাস্ট'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{m.quantity}</TableCell>
                      <TableCell className="text-right">৳{(m.quantity * (m.products?.sell_price || 0)).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredMovements.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">{periodLabel} কোনো মুভমেন্ট নেই</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Low Stock Tab */}
        <TabsContent value="lowstock">
          <Card className="border-border">
            <CardHeader><CardTitle className="font-heading text-base">কম স্টক প্রোডাক্ট ({lowStockProducts.length}টি)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>কোড</TableHead>
                    <TableHead>প্রোডাক্ট</TableHead>
                    <TableHead>শাখা</TableHead>
                    <TableHead className="text-right">বর্তমান স্টক</TableHead>
                    <TableHead className="text-right">মিনিমাম</TableHead>
                    <TableHead>অবস্থা</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockProducts.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-primary text-sm">{p.product_code}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell><Badge variant="secondary">{(p as any).branches?.name}</Badge></TableCell>
                      <TableCell className="text-right font-bold text-destructive">{p.quantity}</TableCell>
                      <TableCell className="text-right">{p.min_stock}</TableCell>
                      <TableCell>
                        {p.quantity === 0
                          ? <Badge variant="destructive">স্টক নেই</Badge>
                          : <Badge variant="outline" className="border-warning text-warning">কম স্টক</Badge>
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {lowStockProducts.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">সব প্রোডাক্টে পর্যাপ্ত স্টক আছে</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
