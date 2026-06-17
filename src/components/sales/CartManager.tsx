import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2 } from 'lucide-react';
import type { Product } from '@/types';
import type { CartItem } from '@/hooks/useCart';

interface Props {
  products: Product[];
  cart: CartItem[];
  onAdd: (product: Product, qty: number) => void;
  onRemove: (productId: string) => void;
}

export function CartManager({ products, cart, onAdd, onRemove }: Props) {
  const [selectedProduct, setSelectedProduct] = useState('');
  const [qty, setQty] = useState('1');

  const handleAdd = () => {
    const p = products.find(pr => pr.id === selectedProduct);
    if (!p) return;
    onAdd(p, parseInt(qty) || 1);
    setSelectedProduct('');
    setQty('1');
  };

  return (
    <div className="border rounded-lg p-3 space-y-3">
      <Label className="font-medium">প্রোডাক্ট যুক্ত করুন</Label>
      <div className="flex gap-2">
        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="প্রোডাক্ট নির্বাচন" /></SelectTrigger>
          <SelectContent>
            {products.filter(p => p.quantity > 0).map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.product_code} - {p.name} (৳{p.sell_price}, স্টক: {p.quantity})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="number" value={qty} onChange={e => setQty(e.target.value)} className="w-20" min="1" />
        <Button type="button" onClick={handleAdd} size="sm">যুক্ত</Button>
      </div>

      {cart.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>প্রোডাক্ট</TableHead>
              <TableHead className="text-right">পরিমাণ</TableHead>
              <TableHead className="text-right">দর (৳)</TableHead>
              <TableHead className="text-right">মোট (৳)</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cart.map(c => (
              <TableRow key={c.product_id}>
                <TableCell className="text-sm">
                  {c.product_name}<br />
                  <span className="text-xs text-primary font-mono">{c.product_code}</span>
                </TableCell>
                <TableCell className="text-right">{c.quantity}</TableCell>
                <TableCell className="text-right">৳{c.unit_price}</TableCell>
                <TableCell className="text-right font-medium">৳{(c.quantity * c.unit_price).toLocaleString()}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => onRemove(c.product_id)}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
