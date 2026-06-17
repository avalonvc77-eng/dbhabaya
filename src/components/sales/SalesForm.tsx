import { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import type { Product } from '@/types';
import { useCart } from '@/hooks/useCart';
import { CartManager } from './CartManager';
import { saleSchema, firstZodError } from '@/lib/validation';

interface Props {
  products: Product[];
  isAdmin: boolean;
  userBranchId: string | null;
  onSuccess: () => void;
}

export function SalesForm({ products, isAdmin, userBranchId, onSuccess }: Props) {
  const { cart, addItem, removeItem, clear, subtotal } = useCart();
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const branchProducts = useMemo(
    () => (isAdmin ? products : products.filter(p => p.branch_id === userBranchId)),
    [products, isAdmin, userBranchId]
  );

  const discPct = parseFloat(discountPercent) || 0;
  const discountAmount = subtotal * (discPct / 100);
  const total = subtotal - discountAmount;

  const handleSubmit = async () => {
    const parsed = saleSchema.safeParse({
      customer_name: customerName,
      customer_mobile: customerMobile,
      payment_method: paymentMethod,
      discount_percent: discountPercent,
      notes,
      cart,
    });
    if (!parsed.success) {
      toast.error(firstZodError(parsed.error));
      return;
    }

    const branchId = isAdmin
      ? (cart[0] ? products.find(p => p.id === cart[0].product_id)?.branch_id : userBranchId)
      : userBranchId;
    if (!branchId) { toast.error('শাখা নির্ধারণ করা যায়নি'); return; }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('create_sale', {
        p_branch_id: branchId,
        p_customer_name: parsed.data.customer_name,
        p_customer_mobile: parsed.data.customer_mobile || null,
        p_payment_method: parsed.data.payment_method,
        p_discount_percent: parsed.data.discount_percent,
        p_notes: parsed.data.notes || null,
        p_items: cart.map(c => ({
          product_id: c.product_id,
          product_name: c.product_name,
          quantity: c.quantity,
          unit_price: c.unit_price,
        })),
      });
      if (error) throw error;
      const result = data as { invoice_number: string };
      toast.success(`বিক্রয় সম্পন্ন! ইনভয়েস: ${result.invoice_number}`);
      clear();
      setCustomerName(''); setCustomerMobile(''); setPaymentMethod('cash');
      setDiscountPercent('0'); setNotes('');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'বিক্রয় সম্পন্ন হয়নি');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>গ্রাহকের নাম *</Label><Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="গ্রাহকের নাম" /></div>
        <div><Label>মোবাইল নম্বর</Label><Input value={customerMobile} onChange={e => setCustomerMobile(e.target.value)} placeholder="01XXXXXXXXX" /></div>
      </div>

      <CartManager products={branchProducts} cart={cart} onAdd={addItem} onRemove={removeItem} />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>পেমেন্ট পদ্ধতি</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">নগদ</SelectItem>
              <SelectItem value="bkash">বিকাশ</SelectItem>
              <SelectItem value="nagad">নগদ (ডিজিটাল)</SelectItem>
              <SelectItem value="card">কার্ড</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>ডিসকাউন্ট (%)</Label><Input type="number" value={discountPercent} onChange={e => setDiscountPercent(e.target.value)} min="0" max="100" /></div>
      </div>

      <div><Label>নোট (ঐচ্ছিক)</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="অতিরিক্ত তথ্য..." /></div>

      <div className="bg-muted rounded-lg p-4 space-y-1">
        <div className="flex justify-between"><span>সাবটোটাল:</span><span>৳{subtotal.toLocaleString()}</span></div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-destructive">
            <span>ডিসকাউন্ট ({discPct}%):</span><span>-৳{discountAmount.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-lg border-t pt-2"><span>মোট:</span><span>৳{total.toLocaleString()}</span></div>
      </div>

      <Button onClick={handleSubmit} className="w-full" disabled={submitting || cart.length === 0}>
        {submitting ? 'প্রসেস হচ্ছে...' : 'বিক্রয় সম্পন্ন করুন'}
      </Button>
    </div>
  );
}
