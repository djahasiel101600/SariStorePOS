// src/hooks/api.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { 
  Product, 
  Sale, 
  DashboardStats, 
  Payment,
  User,
  Shift,
  EmployeePerformance
} from "@/types";
import type { Customer } from "@/types";

// Dashboard
export const useDashboardStats = () => {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: async (): Promise<DashboardStats> => {
      const { data } = await api.get("/dashboard/stats/");
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

// src/hooks/api.ts
export const useProducts = (page?: number, pageSize?: number) => {
  return useQuery({
    queryKey: page !== undefined ? ["products", page, pageSize] : ["products"],
    queryFn: async (): Promise<
      | {
          results: Product[];
          count: number;
          next: string | null;
          previous: string | null;
        }
      | Product[]
    > => {
      try {
        const params: any = {};
        if (page !== undefined) params.page = page;
        if (pageSize !== undefined) params.page_size = pageSize;

        const { data } = await api.get("/products/", { params });

        // Handle various response formats
        if (data && typeof data === "object") {
          // Django REST Framework pagination
          if (data.results && Array.isArray(data.results)) {
            return {
              results: data.results,
              count: data.count || data.results.length,
              next: data.next || null,
              previous: data.previous || null,
            };
          }
          // Some APIs use 'data' key
          if (data.data && Array.isArray(data.data)) {
            return {
              results: data.data,
              count: data.count || data.data.length,
              next: data.next || null,
              previous: data.previous || null,
            };
          }
          // Direct array response (non-paginated)
          if (Array.isArray(data)) {
            return data;
          }
        }

        return { results: [], count: 0, next: null, previous: null };
      } catch (error) {
        console.error("Error fetching products:", error);
        return { results: [], count: 0, next: null, previous: null };
      }
    },
  });
};

// Add a hook for fetching all products (for search)
export const useAllProducts = () => {
  return useQuery({
    queryKey: ["products", "all"],
    queryFn: async (): Promise<Product[]> => {
      try {
        let allProducts: Product[] = [];
        let page = 1;
        let hasMore = true;
        const pageSize = 100; // Fetch larger pages for efficiency

        while (hasMore) {
          const params = { page, page_size: pageSize };
          const { data } = await api.get("/products/", { params });

          if (data && data.results && Array.isArray(data.results)) {
            allProducts = [...allProducts, ...data.results];
            hasMore = !!data.next; // Check if there's a next page
            page++;
          } else {
            hasMore = false;
          }

          // Safety limit to prevent infinite loops
          if (page > 50) break;
        }

        return allProducts;
      } catch (error) {
        console.error("Error fetching all products:", error);
        return [];
      }
    },
    // Only fetch when explicitly needed
    enabled: false,
  });
};

export const useProductSearch = (query: string) => {
  return useQuery({
    queryKey: ["products", "search", query],
    queryFn: async (): Promise<Product[]> => {
      if (!query.trim()) return [];
      const { data } = await api.get(
        `/products/search/?q=${encodeURIComponent(query)}`
      );
      return data;
    },
    enabled: query.length > 0,
  });
};

export const useLowStockProducts = () => {
  return useQuery({
    queryKey: ["products", "low-stock"],
    queryFn: async (): Promise<Product[]> => {
      const { data } = await api.get("/products/low_stock/");
      return data;
    },
  });
};

// Sales
export const useSales = (startDate?: string, endDate?: string) => {
  return useQuery({
    queryKey: ["sales", startDate, endDate],
    queryFn: async (): Promise<Sale[]> => {
      const params: any = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const { data } = await api.get("/sales/", { params });

      if (Array.isArray(data)) {
        return data;
      } else if (data && data.results) {
        return data.results;
      } else {
        return [];
      }
    },
  });
};

// In src/hooks/api.ts - Update the useCreateSale hook
export const useCreateSale = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (saleData: any) => {
      // Transform string prices to numbers before sending
      const transformedData = {
        ...saleData,
        items: saleData.items.map((item: any) => ({
          ...item,
          unit_price:
            typeof item.unit_price === "string"
              ? parseFloat(item.unit_price)
              : item.unit_price,
        })),
      };

      // Create an idempotency key to protect against duplicate requests
      const idempotencyKey =
        typeof crypto !== 'undefined' && (crypto as any).randomUUID
          ? (crypto as any).randomUUID()
          : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      console.log("Transformed sale data:", transformedData, "idempotencyKey:", idempotencyKey);

      const { data } = await api.post("/sales/", transformedData, {
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      // Also invalidate customer queries to update customer total_purchases
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
};

// Add to src/hooks/api.ts
// Products CRUD operations
export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productData: FormData) => {
      const { data } = await api.post("/products/", productData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
    },
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FormData }) => {
      const { data: response } = await api.patch(`/products/${id}/`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
    },
  });
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/products/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
    },
  });
};

// Bulk import products
export const useBulkImportProducts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await api.post("/bulk-import-products/", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
    },
  });
};

// Purchase orders
export const useCreatePurchase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (purchaseData: any) => {
      const { data } = await api.post("/purchases/", purchaseData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
    },
  });
};

// In src/hooks/api.ts - Add customer hooks
export const useCustomerSearch = (query: string) => {
  return useQuery({
    queryKey: ["customers", "search", query],
    queryFn: async (): Promise<Customer[]> => {
      if (!query.trim()) return [];

      const { data: allCustomers } = await api.get("/customers/");
      // Explicitly type the customers array as Customer[]
      const customers: Customer[] = Array.isArray(allCustomers)
        ? allCustomers
        : allCustomers?.results || [];

      return customers
        .filter(
          (customer: Customer) =>
            customer.name.toLowerCase().includes(query.toLowerCase()) ||
            customer.phone?.toLowerCase().includes(query.toLowerCase()) ||
            customer.email?.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 10);
    },
    enabled: query.length > 0,
  });
};

// Add this to your src/hooks/api.ts file - Place it with the other customer hooks
export const useCustomers = () => {
  return useQuery({
    queryKey: ["customers"],
    queryFn: async (): Promise<Customer[]> => {
      const { data } = await api.get("/customers/");

      // Handle Django REST Framework pagination
      if (data && data.results && Array.isArray(data.results)) {
        return data.results;
      } else if (Array.isArray(data)) {
        return data;
      } else {
        return [];
      }
    },
  });
};

export const useCreateCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (customerData: any) => {
      const { data } = await api.post("/customers/", customerData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
};

export const useUpdateCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const { data: response } = await api.patch(`/customers/${id}/`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
};

export const useDeleteCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/customers/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
};

// Payments
export const useRecordPayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      customer: number;
      sale?: number | null;
      amount: number;
      method: "cash" | "card" | "mobile";
      notes?: string;
    }) => {
      const { data } = await api.post("/payments/", payload);
      return data as Payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
    },
  });
};

export const useCustomerById = (id?: number) => {
  return useQuery({
    queryKey: ["customers", id],
    queryFn: async (): Promise<Customer | null> => {
      if (!id) return null;
      const { data } = await api.get(`/customers/${id}/`);
      return data;
    },
    enabled: !!id,
  });
};

// Admin - Users
export const useUsers = () => {
  return useQuery({
    queryKey: ["users"],
    queryFn: async (): Promise<User[]> => {
      const { data } = await api.get("/users/");
      // Handle both array and paginated response
      return Array.isArray(data) ? data : data.results || [];
    },
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userData: {
      username: string;
      password: string;
      email: string;
      first_name: string;
      last_name: string;
      is_staff?: boolean;
    }) => {
      const { data } = await api.post("/users/", userData);
      return data as User;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...userData
    }: {
      id: number;
      username?: string;
      email?: string;
      first_name?: string;
      last_name?: string;
      is_staff?: boolean;
      is_active?: boolean;
    }) => {
      const { data } = await api.patch(`/users/${id}/`, userData);
      return data as User;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
};

// Admin - Shifts
export const useShifts = (startDate?: string, endDate?: string) => {
  return useQuery({
    queryKey: ["shifts", startDate, endDate],
    queryFn: async (): Promise<Shift[]> => {
      const params: any = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const { data } = await api.get("/shifts/", { params });
      // Handle both array and paginated response
      return Array.isArray(data) ? data : data.results || [];
    },
  });
};

export const useActiveShifts = () => {
  return useQuery({
    queryKey: ["shifts", "active"],
    queryFn: async (): Promise<Shift[]> => {
      const { data } = await api.get("/shifts/active/");
      // Handle both array and paginated response
      return Array.isArray(data) ? data : data.results || [];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

export const useShiftById = (id: number) => {
  return useQuery({
    queryKey: ["shifts", id],
    queryFn: async (): Promise<Shift> => {
      const { data } = await api.get(`/shifts/${id}/`);
      return data;
    },
    enabled: !!id,
  });
};

// Admin - Employee Performance
export const useEmployeePerformance = (startDate?: string, endDate?: string) => {
  return useQuery({
    queryKey: ["employee-performance", startDate, endDate],
    queryFn: async (): Promise<EmployeePerformance[]> => {
      const params: any = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const { data } = await api.get("/shifts/employee-performance/", { params });
      return data;
    },
  });
};

// Shift Management - Get current user's active shift
export const useMyShift = () => {
  return useQuery<Shift | null>({
    queryKey: ["my-shift"],
    queryFn: async () => {
      try {
        const { data } = await api.get("/shifts/my-shift/");
        return data;
      } catch (error: any) {
        if (error.response?.status === 204) return null;
        throw error;
      }
    },
    refetchInterval: 60000, // Refetch every minute
  });
};

// Start a new shift
export const useStartShift = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { opening_cash: number; notes?: string; terminal_id?: string }) => {
      const response = await api.post("/shifts/start/", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-shift"] });
      queryClient.invalidateQueries({ queryKey: ["active-shifts"] });
    },
  });
};

// End an active shift
export const useEndShift = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { shiftId: number; closing_cash: number; notes?: string }) => {
      const { shiftId, ...payload } = data;
      const response = await api.post(`/shifts/${shiftId}/end/`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-shift"] });
      queryClient.invalidateQueries({ queryKey: ["active-shifts"] });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
  });
};

