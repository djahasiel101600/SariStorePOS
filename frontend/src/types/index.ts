 
// src/types/index.ts
export type PaymentMethod = 'cash' | 'card' | 'mobile' | 'utang';

export type UnitType = 'piece' | 'kg' | 'g' | 'liter' | 'ml' | 'bundle' | 'pack';
export type PricingModel = 'fixed_per_unit' | 'fixed_per_weight' | 'variable';

export interface Product {
  id: number;
  name: string;
  barcode: string | null;
  unit_type: UnitType;
  unit_type_display?: string;
  pricing_model: PricingModel;
  pricing_model_display?: string;
  price: number | null;
  cost_price: number | null;
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
  outstanding_balance?: number;
  last_utang_date?: string | null;
  created_at: string;
}

export interface SaleItem {
  id: number;
  product: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  requested_amount?: number | null;
  total_price: number;
}

export interface Sale {
  id: number;
  customer: number | null;
  customer_name: string;
  total_amount: number;
  amount_paid?: number;
  is_fully_paid?: boolean;
  due_date?: string | null;
  payment_method: PaymentMethod;
  date_created: string;
  items: SaleItem[];
  payments?: Payment[];
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

export interface Payment {
  id: number;
  customer: number;
  sale?: number | null;
  amount: number;
  method: 'cash' | 'card' | 'mobile';
  notes?: string;
  date_created: string;
}

export interface CustomerUtangSummary {
  customer: Customer;
  unpaid_sales: Sale[];
  total_outstanding: number;
}

export interface CreateSaleData {
  customer: number | null;
  payment_method: string;
  amount_paid?: number;
  due_date?: string | null;
  items: Array<{
    product_id: number;
    quantity: number;
    unit_price: number;
    requested_amount?: number | null;
  }>;
}

// User and Shift types for admin
export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  is_active: boolean;
  date_joined: string;
}

export interface Shift {
  id: number;
  user: number;
  user_name: string;
  start_time: string;
  end_time: string | null;
  opening_cash: number;
  closing_cash: number | null;
  expected_cash: number | null;
  cash_difference: number | null;
  sales_count: number;
  total_sales: number;
  notes: string;
}

export interface EmployeePerformance {
  user_id: number;
  user_name: string;
  total_sales: number;
  total_revenue: number;
  shift_count: number;
  avg_sale: number;
  last_shift: string | null;
}

// Removed duplicate Customer interface