import { z } from 'zod';

// Reusable primitives
export const nonEmptyText = (max = 255, label = 'এই ফিল্ড') =>
  z.string().trim().min(1, `${label} প্রয়োজন`).max(max, `${label} সর্বোচ্চ ${max} অক্ষর`);

export const optionalText = (max = 500) =>
  z.string().trim().max(max).optional().or(z.literal(''));

export const positiveInt = (label = 'মান') =>
  z.coerce.number().int(`${label} পূর্ণ সংখ্যা হতে হবে`).positive(`${label} ০ এর বেশি হতে হবে`);

export const nonNegativeNumber = (label = 'মান') =>
  z.coerce.number().min(0, `${label} ০ এর কম হতে পারবে না`);

export const bdMobile = z
  .string()
  .trim()
  .regex(/^(01)[3-9]\d{8}$/, 'বৈধ বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)')
  .optional()
  .or(z.literal(''));

// Domain schemas
export const saleSchema = z.object({
  customer_name: nonEmptyText(100, 'গ্রাহকের নাম'),
  customer_mobile: bdMobile,
  payment_method: z.enum(['cash', 'bkash', 'nagad', 'card']),
  discount_percent: z.coerce.number().min(0).max(100),
  notes: optionalText(1000),
  cart: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        product_name: z.string(),
        quantity: positiveInt('পরিমাণ'),
        unit_price: nonNegativeNumber('মূল্য'),
      })
    )
    .min(1, 'কমপক্ষে একটি প্রোডাক্ট যুক্ত করুন'),
});

export const salesReturnSchema = z.object({
  sale_id: z.string().uuid(),
  reason: optionalText(500),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        product_name: z.string(),
        quantity: positiveInt('পরিমাণ'),
        unit_price: nonNegativeNumber('মূল্য'),
      })
    )
    .min(1, 'কমপক্ষে একটি আইটেম নির্বাচন করুন'),
});

export const customerSchema = z.object({
  name: nonEmptyText(100, 'নাম'),
  mobile: bdMobile,
  email: z.string().trim().email('বৈধ ইমেইল দিন').max(255).optional().or(z.literal('')),
  address: optionalText(500),
});

export const productSchema = z.object({
  name: nonEmptyText(200, 'প্রোডাক্টের নাম'),
  buy_price: nonNegativeNumber('ক্রয়মূল্য'),
  sell_price: nonNegativeNumber('বিক্রয়মূল্য'),
  quantity: z.coerce.number().int().min(0, 'পরিমাণ ০ এর কম হতে পারবে না'),
  min_stock: z.coerce.number().int().min(0),
});

// Helper for friendly error messages
export function firstZodError(err: z.ZodError): string {
  return err.issues[0]?.message ?? 'অবৈধ ইনপুট';
}
