 
// src/types/index.ts
export type PaymentMethod = 'cash' | 'card' | 'mobile' | 'utang';

export interface Product {
  id: number;
  name: string;
  barcode: string | null;
  price: number;
  cost_price: number;
  stock_quantity: number;
  min_stock_level: number;
  category: string;
  image: string | null;
  is_active: boolean;
  needs_restock: boolean;
  profit_margin: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  total_purchases: number;
  created_at: string;
}

export interface SaleItem {
  id: number;
  product: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Sale {
  id: number;
  customer: number | null;
  customer_name: string;
  total_amount: number;
  payment_method: PaymentMethod;
  date_created: string;
  items: SaleItem[];
}

export interface DashboardStats {
  sales: {
    today: number;
    week: number;
    month: number;
  };
  inventory: {
    total_products: number;
    low_stock: number;
    out_of_stock: number;
  };
  recent_sales: Sale[];
  best_sellers: Array<{
    product__name: string;
    product__id: number;
    total_sold: number;
    total_revenue: number;
  }>;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// Add to src/types/index.ts
export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

export interface CreateSaleData {
  customer: number | null;
  payment_method: string;
  items: Array<{
    product_id: number;
    quantity: number;
    unit_price: number;
  }>;
}

// In src/types/index.ts
export interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  total_purchases: number;
  created_at: string;
}