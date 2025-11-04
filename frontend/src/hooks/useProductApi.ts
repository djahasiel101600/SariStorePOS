// hooks/useProductApi.ts
import { useState, useCallback } from 'react';
import { productApiService, ProductApiResponse } from '@/services/productApiService';

interface UseProductApiReturn {
  productData: ProductApiResponse | null;
  loading: boolean;
  error: string | null;
  fetchProduct: (barcode: string) => Promise<void>;
  clearProduct: () => void;
}

export const useProductApi = (): UseProductApiReturn => {
  const [productData, setProductData] = useState<ProductApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProduct = useCallback(async (barcode: string) => {
    // Validate barcode
    if (!barcode || barcode.trim() === '') {
      setError('Please enter a valid barcode');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await productApiService.getProductByBarcode(barcode.trim());
      setProductData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setProductData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearProduct = useCallback(() => {
    setProductData(null);
    setError(null);
  }, []);

  return {
    productData,
    loading,
    error,
    fetchProduct,
    clearProduct,
  };
};