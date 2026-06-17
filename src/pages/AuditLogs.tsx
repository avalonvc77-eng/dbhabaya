import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/common/PageHeader';
import { SEO } from '@/components/common/SEO';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { Inbox } from 'lucide-react';

interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  new_data: any;
  created_at: string;
}

interface SchemaVersion {
  id: string;
  version: string;
  name: string;
  notes: string | null;
  applied_at: string;
}

export default function AuditLogs() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [versions, setVersions] = useState<SchemaVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const [logsRes, vRes] = await Promise.all([
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200),
        (supabase as any).from('schema_versions').select('*').order('applied_at', { ascending: false }),
      ]);
      if (logsRes.data) setLogs(logsRes.data as AuditLog[]);
      if (vRes.data) setVersions(vRes.data as SchemaVersion[]);
      setLoading(false);
    })();
  }, [isAdmin]);

  if (authLoading) return <LoadingState />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const denials = logs.filter(l => l.action.startsWith('ACCESS_DENIED'));

  const renderTable = (rows: AuditLog[]) => (
    rows.length === 0 ? <EmptyState title="কোনো রেকর্ড নেই" /> : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>সময়</TableHead>
            <TableHead>ব্যবহারকারী</TableHead>
            <TableHead>অ্যাকশন</TableHead>
            <TableHead>টেবিল</TableHead>
            <TableHead>বিবরণ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(l => (
            <TableRow key={l.id}>
              <TableCell className="whitespace-nowrap text-xs">{new Date(l.created_at).toLocaleString('bn-BD')}</TableCell>
              <TableCell className="text-xs">{l.user_email || l.user_id?.slice(0, 8) || '—'}</TableCell>
              <TableCell>
                <Badge variant={l.action.startsWith('ACCESS_DENIED') ? 'destructive' : 'secondary'}>
                  {l.action}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">{l.table_name}</TableCell>
              <TableCell className="text-xs max-w-md truncate">
                {l.new_data ? JSON.stringify(l.new_data) : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  );

  return (
    <div className="space-y-6">
      <SEO title="সিকিউরিটি অডিট লগ" description="অ্যাডমিন অডিট লগ ও পলিসি ভার্সন" path="/audit-logs" noindex />
      <PageHeader title="সিকিউরিটি অডিট লগ" subtitle="পলিসি/মাইগ্রেশন ভার্সন এবং সাম্প্রতিক অ্যাক্সেস রেকর্ড" />

      <Card>
        <CardHeader><CardTitle className="text-base">পলিসি / মাইগ্রেশন ভার্সন</CardTitle></CardHeader>
        <CardContent>
          {loading ? <LoadingState /> : versions.length === 0 ? <EmptyState title="কোনো ভার্সন নেই" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ভার্সন</TableHead>
                  <TableHead>নাম</TableHead>
                  <TableHead>নোট</TableHead>
                  <TableHead>প্রয়োগ তারিখ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.map(v => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs">{v.version}</TableCell>
                    <TableCell>{v.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{v.notes || '—'}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(v.applied_at).toLocaleString('bn-BD')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">অডিট রেকর্ড</CardTitle></CardHeader>
        <CardContent>
          {loading ? <LoadingState /> : (
            <Tabs defaultValue="denials">
              <TabsList>
                <TabsTrigger value="denials">অ্যাক্সেস ডিনায়াল ({denials.length})</TabsTrigger>
                <TabsTrigger value="all">সকল ({logs.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="denials" className="mt-4">{renderTable(denials)}</TabsContent>
              <TabsContent value="all" className="mt-4">{renderTable(logs)}</TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
