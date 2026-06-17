import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Product } from '@/types';

export interface CartItem {
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  unit_price: number;
  available: number;
}

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addItem = useCallback((product: Product, qty: number) => {
    if (qty <= 0) return;
    setCart(prev => {
      const existing = prev.find(c => c.product_id === product.id);
      const totalRequested = (existing?.quantity ?? 0) + qty;
      if (totalRequested > product.quantity) {
        toast.error(`স্টকে মাত্র ${product.quantity}টি আছে`);
        return prev;
      }
      if (existing) {
        return prev.map(c => c.product_id === product.id ? { ...c, quantity: totalRequested } : c);
      }
      return [...prev, {
        product_id: product.id,
        product_name: product.name,
        product_code: product.product_code,
        quantity: qty,
        unit_price: product.sell_price,
        available: product.quantity,
      }];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setCart(prev => prev.filter(c => c.product_id !== productId));
  }, []);

  const clear = useCallback(() => setCart([]), []);

  const subtotal = useMemo(() => cart.reduce((s, c) => s + c.quantity * c.unit_price, 0), [cart]);

  return { cart, addItem, removeItem, clear, subtotal };
}
