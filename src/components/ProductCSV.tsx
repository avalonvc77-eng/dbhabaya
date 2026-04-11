import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Download, Upload, Loader2 } from 'lucide-react';
import type { Product } from '@/types';

interface Props {
  products: Product[];
  onImport: () => void;
}

export function ProductCSV({ products, onImport }: Props) {
  const { user, isAdmin, userBranchId } = useAuth();
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportCSV = () => {
    const headers = ['product_code', 'name', 'category_id', 'branch_id', 'description', 'buy_price', 'sell_price', 'quantity', 'min_stock', 'size', 'color', 'status'];
    const rows = products.map(p => headers.map(h => {
      const val = (p as any)[h];
      return val !== null && val !== undefined ? `"${String(val).replace(/"/g, '""')}"` : '';
    }).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `products_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    toast.success('CSV এক্সপোর্ট সম্পন্ন');
  };

  const importCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) throw new Error('CSV ফাইলে ডেটা নেই');

      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
      const nameIdx = headers.indexOf('name');
      const branchIdx = headers.indexOf('branch_id');
      if (nameIdx === -1) throw new Error('CSV-এ "name" কলাম আবশ্যক');

      let imported = 0;
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row: Record<string, any> = {};
        headers.forEach((h, idx) => { if (values[idx]) row[h] = values[idx]; });

        if (!row.name) continue;
        const branchId = isAdmin ? (row.branch_id || userBranchId) : userBranchId;
        if (!branchId) continue;

        // Generate product code
        const prefix = 'IMP';
        const random = Math.floor(10000 + Math.random() * 90000);

        const { error } = await supabase.from('products').insert({
          product_code: row.product_code || `${prefix}-${random}`,
          name: row.name,
          category_id: row.category_id || null,
          branch_id: branchId,
          description: row.description || null,
          buy_price: parseFloat(row.buy_price) || 0,
          sell_price: parseFloat(row.sell_price) || 0,
          quantity: parseInt(row.quantity) || 0,
          min_stock: parseInt(row.min_stock) || 5,
          size: row.size || null,
          color: row.color || null,
          status: row.status || 'active',
          created_by: user.id,
        });
        if (!error) imported++;
      }

      toast.success(`${imported}টি প্রোডাক্ট ইমপোর্ট হয়েছে`);
      onImport();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="flex gap-2">
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={importCSV} />
      <Button variant="outline" size="sm" onClick={exportCSV}>
        <Download className="w-3 h-3 mr-1" />CSV এক্সপোর্ট
      </Button>
      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
        {importing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
        CSV ইমপোর্ট
      </Button>
    </div>
  );
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; continue; }
    if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
    current += char;
  }
  result.push(current.trim());
  return result;
}
