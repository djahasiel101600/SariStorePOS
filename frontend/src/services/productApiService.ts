// services/productApiService.ts
import axios, { AxiosResponse } from 'axios';

// Define the interface for the product data
export interface Product {
  product_name: string;
  product_quantity: string;
  product_quantity_unit: string;
  product_type: string;
}

// Define the interface for the API response
export interface ProductApiResponse {
  code: string;
  product: Product;
  status: number;
  status_verbose: string;
}

// Create axios instance with common configuration
const apiClient = axios.create({
  baseURL: 'https://world.openfoodfacts.net/api/v2',
  timeout: 10000, // 10 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// API service function
export const productApiService = {
  /**
   * Fetch product information by barcode
   * @param barcode - The product barcode to search for
   * @returns Promise with product data
   */
  getProductByBarcode: async (barcode: string): Promise<ProductApiResponse> => {
    try {
      const response: AxiosResponse<ProductApiResponse> = await apiClient.get(
        `/product/${barcode}`,
        {
          params: {
            fields: 'product_name,product_quantity,product_quantity_unit,product_type',
          },
        }
      );

      // Check if product was found
      if (response.data.status !== 1) {
        throw new Error('Product not found');
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Handle different types of axios errors
        if (error.response) {
          // Server responded with error status
          throw new Error(`API Error: ${error.response.status} - ${error.response.statusText}`);
        } else if (error.request) {
          // Request was made but no response received
          throw new Error('Network error: Unable to reach the server');
        }
      }
      
      // Re-throw other errors
      throw error;
    }
  },
};