export interface Branch {
  id: string;
  name: string;
  shop_code: string;
  address: string | null;
  phone: string | null;
  is_main: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  product_code: string;
  name: string;
  category_id: string | null;
  branch_id: string;
  description: string | null;
  buy_price: number;
  sell_price: number;
  quantity: number;
  min_stock: number;
  size: string | null;
  color: string | null;
  image_url: string | null;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // joined
  branch?: Branch;
  category?: Category;
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  display_order: number;
  created_at: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  branch_id: string;
  movement_type: 'in' | 'out' | 'transfer' | 'adjustment';
  quantity: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  product?: Product;
  branch?: Branch;
}

export interface Sale {
  id: string;
  invoice_number: string;
  branch_id: string;
  customer_name: string;
  customer_mobile: string | null;
  subtotal: number;
  discount_amount: number;
  discount_percent: number;
  total_amount: number;
  payment_method: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  branch?: Branch;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
  product?: Product;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  branch_id: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
  branch?: Branch;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'branch_manager';
}
