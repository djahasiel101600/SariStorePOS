// src/hooks/use-pos.ts - COMPLETE FIXED VERSION
import { create } from 'zustand';
import { Product, Customer, type PaymentMethod } from '@/types';

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

interface POSState {
  cart: CartItem[];
  customer: Customer | null;
  searchQuery: string;
  isProcessing: boolean;
  cashTendered: number; // NEW: Amount customer paid
  paymentMethod: PaymentMethod; // NEW: Updated payment method

  // Actions
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  setCustomer: (customer: Customer | null) => void;
  setSearchQuery: (query: string) => void;
  setProcessing: (processing: boolean) => void;
  setCashTendered: (amount: number) => void; // NEW
  setPaymentMethod: (method: PaymentMethod) => void; // NEW

  // Computed values - we'll implement these as functions that return the computed values
  getCartTotal: () => number;
  getCartItemCount: () => number;
  getChangeDue: () => number; // NEW: Calculate change

}

export const usePOS = create<POSState>((set, get) => ({
  cart: [],
  customer: null,
  searchQuery: '',
  isProcessing: false,
  cashTendered: 0, // NEW
  paymentMethod: 'cash', // NEW


  // In src/hooks/use-pos.ts - Fix the addToCart function
  addToCart: (product, quantity = 1) => {
    const state = get();
    const existingItem = state.cart.find(item => item.product.id === product.id);
    
    console.log('Adding to cart:', { 
      product, 
      price: product.price, 
      priceType: typeof product.price 
    });
    
    if (existingItem) {
      set({
        cart: state.cart.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      });
    } else {
      // Ensure unitPrice is stored as a number
      const unitPrice = typeof product.price === 'string' 
        ? parseFloat(product.price) 
        : product.price;
      
      set({
        cart: [...state.cart, { 
          product, 
          quantity, 
          unitPrice: unitPrice
        }]
      });
    }
  },

  removeFromCart: (productId) => {
    const state = get();
    set({
      cart: state.cart.filter(item => item.product.id !== productId)
    });
  },

  updateQuantity: (productId, quantity) => {
    const state = get();
    if (quantity <= 0) {
      get().removeFromCart(productId);
      return;
    }
    
    set({
      cart: state.cart.map(item =>
        item.product.id === productId
          ? { ...item, quantity }
          : item
      )
    });
  },

  clearCart: () => {
    set({ cart: [], customer: null });
  },

  setCustomer: (customer) => {
    set({ customer });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  setProcessing: (processing) => {
    set({ isProcessing: processing });
  },

  setCashTendered: (amount) => {
    set({ cashTendered: amount });
  },

  setPaymentMethod: (method) => {
    set({ paymentMethod: method });
  },


  // Computed values as functions
  getCartTotal: () => {
    const state = get();
    const total = state.cart.reduce((sum, item) => {
      const itemTotal = item.unitPrice * item.quantity;
      console.log(`Calculating: ${item.product.name} - ${item.unitPrice} x ${item.quantity} = ${itemTotal}`);
      return sum + itemTotal;
    }, 0);
    return total;
  },

  getCartItemCount: () => {
    const state = get();
    return state.cart.reduce((count, item) => count + item.quantity, 0);
  },

  getChangeDue: () => {
    const state = get();
    if (state.paymentMethod !== 'cash') return 0;
    return Math.max(0, state.cashTendered - state.getCartTotal());
  },

}));