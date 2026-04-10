import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Package, Store, AlertTriangle, ArrowLeftRight, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardStats {
  totalProducts: number;
  totalBranches: number;
  lowStockCount: number;
  totalMovements: number;
  branchProductCounts: { name: string; count: number }[];
}

export default function Dashboard() {
  const { isAdmin, userBranchId } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0, totalBranches: 0, lowStockCount: 0, totalMovements: 0, branchProductCounts: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const branchFilter = !isAdmin && userBranchId ? userBranchId : null;

      const [productsRes, branchesRes, lowStockRes, movementsRes] = await Promise.all([
        branchFilter
          ? supabase.from('products').select('id', { count: 'exact', head: true }).eq('branch_id', branchFilter)
          : supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('branches').select('id', { count: 'exact', head: true }),
        branchFilter
          ? supabase.from('products').select('id', { count: 'exact', head: true }).eq('branch_id', branchFilter).lt('quantity', 5)
          : supabase.from('products').select('id', { count: 'exact', head: true }).lt('quantity', 5),
        branchFilter
          ? supabase.from('stock_movements').select('id', { count: 'exact', head: true }).eq('branch_id', branchFilter)
          : supabase.from('stock_movements').select('id', { count: 'exact', head: true }),
      ]);

      // Branch product counts for chart
      const { data: branches } = await supabase.from('branches').select('id, name');
      const branchProductCounts: { name: string; count: number }[] = [];
      if (branches) {
        for (const b of branches) {
          const { count } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('branch_id', b.id);
          branchProductCounts.push({ name: b.name, count: count || 0 });
        }
      }

      setStats({
        totalProducts: productsRes.count || 0,
        totalBranches: branchesRes.count || 0,
        lowStockCount: lowStockRes.count || 0,
        totalMovements: movementsRes.count || 0,
        branchProductCounts,
      });
      setLoading(false);
    };
    fetchStats();
  }, [isAdmin, userBranchId]);

  const statCards = [
    { title: 'মোট প্রোডাক্ট', value: stats.totalProducts, icon: Package, color: 'text-primary' },
    { title: 'মোট শাখা', value: stats.totalBranches, icon: Store, color: 'text-info' },
    { title: 'কম স্টক', value: stats.lowStockCount, icon: AlertTriangle, color: 'text-warning' },
    { title: 'স্টক মুভমেন্ট', value: stats.totalMovements, icon: ArrowLeftRight, color: 'text-success' },
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">লোড হচ্ছে...</p></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold font-heading text-foreground">ড্যাশবোর্ড</h2>
        <p className="text-muted-foreground">আপনার ব্যবসার সার্বিক অবস্থা</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => (
          <Card key={card.title} className="card-hover border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <p className="text-3xl font-bold font-heading mt-1">{card.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-muted flex items-center justify-center ${card.color}`}>
                  <card.icon className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.branchProductCounts.length > 0 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-heading">শাখা অনুযায়ী প্রোডাক্ট</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.branchProductCounts}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40 15% 88%)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(164 60% 28%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
