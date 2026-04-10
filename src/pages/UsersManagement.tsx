import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { UserPlus, Shield, Store } from 'lucide-react';
import type { Profile, Branch, UserRole } from '@/types';

export default function UsersManagement() {
  const [profiles, setProfiles] = useState<(Profile & { roles: UserRole[] })[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const [pRes, bRes, rRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('branches').select('*').order('name'),
      supabase.from('user_roles').select('*'),
    ]);
    const profilesData = (pRes.data as unknown as Profile[]) || [];
    const rolesData = (rRes.data as unknown as UserRole[]) || [];
    const merged = profilesData.map(p => ({
      ...p,
      roles: rolesData.filter(r => r.user_id === p.user_id),
    }));
    setProfiles(merged);
    setBranches((bRes.data as unknown as Branch[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const assignRole = async (userId: string, role: 'admin' | 'branch_manager') => {
    const { error } = await supabase.from('user_roles').upsert({ user_id: userId, role }, { onConflict: 'user_id,role' });
    if (error) toast.error(error.message);
    else { toast.success('রোল আপডেট হয়েছে'); fetchData(); }
  };

  const assignBranch = async (userId: string, branchId: string) => {
    const { error } = await supabase.from('profiles').update({ branch_id: branchId }).eq('user_id', userId);
    if (error) toast.error(error.message);
    else { toast.success('শাখা অ্যাসাইন হয়েছে'); fetchData(); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">লোড হচ্ছে...</p></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold font-heading">ব্যবহারকারী পরিচালনা</h2>
        <p className="text-muted-foreground">রোল ও শাখা অ্যাসাইন করুন</p>
      </div>

      <Card className="border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>নাম</TableHead>
                  <TableHead>ফোন</TableHead>
                  <TableHead>রোল</TableHead>
                  <TableHead>শাখা</TableHead>
                  <TableHead>অ্যাকশন</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.full_name || 'নাম নেই'}</TableCell>
                    <TableCell>{p.phone || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {p.roles.map(r => (
                          <Badge key={r.id} variant={r.role === 'admin' ? 'default' : 'secondary'}>
                            {r.role === 'admin' ? 'অ্যাডমিন' : 'ব্রাঞ্চ ম্যানেজার'}
                          </Badge>
                        ))}
                        {p.roles.length === 0 && <span className="text-muted-foreground text-sm">রোল নেই</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select value={p.branch_id || ''} onValueChange={v => assignBranch(p.user_id, v)}>
                        <SelectTrigger className="w-40"><SelectValue placeholder="শাখা নির্বাচন" /></SelectTrigger>
                        <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => assignRole(p.user_id, 'admin')}>
                          <Shield className="w-3 h-3 mr-1" />অ্যাডমিন
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => assignRole(p.user_id, 'branch_manager')}>
                          <Store className="w-3 h-3 mr-1" />ম্যানেজার
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
