// src/pages/POS.tsx
import React, { useRef, useState, useMemo } from "react";
import { usePOS } from "@/hooks/use-pos";
import { useProducts } from "@/hooks/api";
import { useProductSearch, useCreateSale, useAllProducts, useLowStockProducts, useDeleteProduct } from "@/hooks/api";
import { useHotkeys } from "react-hotkeys-hook";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { Product } from "@/types";
import CustomerSearch from "@/components/pos/CustomerSearch";
import PaymentMethodSelector from "@/components/pos/PaymentMethodSelector";
import CashTender from "@/components/pos/CashTendered";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  User,
  Barcode,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const POS: React.FC = () => {
  const {
    cart,
    customer,
    searchQuery,
    isProcessing,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    setSearchQuery,
    setProcessing,
    getCartTotal, // Now a function
    getCartItemCount, // Now a function
    paymentMethod,
    cashTendered,
    setCashTendered,
    setPaymentMethod,
  } = usePOS();

  //
  const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(20);
    
    // State for search functionality
    const [searchMode, setSearchMode] = useState(false);

  
    // Fetch paginated products
    const {
      data: productsResponse,
    } = useProducts(currentPage, pageSize);
  
    // Fetch all products for search (only when triggered)
    const {
      data: allProducts = [],
    } = useAllProducts();
    
    // Determine data source based on mode
    const productsDataSource = useMemo(() => {
      if (searchMode && searchQuery) {
        return allProducts;
      }
      
      // Handle paginated response
      if (productsResponse && typeof productsResponse === 'object' && 'results' in productsResponse) {
        return productsResponse.results;
      }
      
      // Handle direct array response (fallback)
      return Array.isArray(productsResponse) ? productsResponse : [];
    }, [searchMode, searchQuery, allProducts, productsResponse]);
  
    // Extract pagination info
    useMemo(() => {
      if (productsResponse && typeof productsResponse === 'object' && 'count' in productsResponse) {
        return {
          count: productsResponse.count,
          next: productsResponse.next,
          previous: productsResponse.previous,
          totalPages: Math.ceil(productsResponse.count / pageSize),
        };
      }
      
      // Fallback for non-paginated responses
      const count = Array.isArray(productsResponse) ? productsResponse.length : productsDataSource.length;
      return {
        count,
        next: null,
        previous: null,
        totalPages: Math.ceil(count / pageSize),
      };
    }, [productsResponse, productsDataSource, pageSize]);
  
    // Safe data handling
    const productsArray: Product[] = Array.isArray(productsDataSource) ? productsDataSource : [];

    // Get unique categories safely
    const categories = [
      ...new Set(
        productsArray
          .map((p) => p.category)
          .filter((category): category is string => Boolean(category))
      ),
    ];
  //

  const cartTotal = getCartTotal();
  const cartItemCount = getCartItemCount();

  const { data: searchResults, isLoading: searching } =
    useProductSearch(searchQuery);
  const createSaleMutation = useCreateSale();

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts
  useHotkeys("ctrl+k", (e) => {
    e.preventDefault();
    searchInputRef.current?.focus();
  });

  useHotkeys("enter", (e) => {
    if (
      searchInputRef.current === document.activeElement &&
      searchResults?.[0]
    ) {
      addToCart(searchResults[0]);
      setSearchQuery("");
      searchInputRef.current?.blur();
    }
  });

  const handleAddToCart = (product: Product) => {
    addToCart(product);
    toast.success(`Added ${product.name} to cart`);
    setSearchQuery("");
  };

  // In your POS.tsx - Use more robust type conversion
  // In your POS.tsx - Update handleCheckout
  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    // Validation
    if (paymentMethod === "cash" && cashTendered < cartTotal) {
      toast.error("Insufficient cash amount");
      return;
    }

    if (paymentMethod === "utang" && !customer) {
      toast.error("Please select a customer for utang transactions");
      return;
    }

    setProcessing(true);

    try {
      const totalAmount = getCartTotal();

      const saleData = {
        customer: customer?.id || null,
        payment_method: paymentMethod, // Now includes 'debt'
        total_amount: totalAmount,
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.unitPrice,
        })),
      };


      await createSaleMutation.mutateAsync(saleData);

      // Success message based on payment method
      if (paymentMethod === "utang") {
        toast.success(
          `Utang recorded for ${customer?.name}! Total: ${formatCurrency(totalAmount)}`
        );
      } else {
        toast.success("Sale completed successfully!");
      }

      // Clear cart and reset payment state
      clearCart();
      setCashTendered(0);
      setPaymentMethod("cash");
    } catch (error: any) {
      console.error("Checkout error details:", error.response?.data);
      toast.error(
        `Failed to process ${paymentMethod === "utang" ? "utang" : "sale"}`
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleBarcodeSearch = () => {
    // Simulate barcode scanning - in real app, this would use device camera
    toast.info("Barcode scanner would activate here");
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6">
      {/* Left Panel - Products Search & Selection */}
      <div className="flex-1 flex flex-col">
        {/* Search Header */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-[18px] transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search products by name or barcode (Ctrl+K)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4"
                />
              </div>
              <Button
                  variant="outline"
                  onClick={handleBarcodeSearch}
                  className="whitespace-nowrap"
                  >
                  <Barcode className="h-4 w-4 mr-2" />
                      Scan
                  </Button>
              {/* Customer Search - Fixed width */}
              <div className="w-full lg:w-80">
                <CustomerSearch />
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-4 mt-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <ShoppingCart className="h-4 w-4" />
                <span>{cartItemCount} items</span>
              </div>
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                <span>{customer?.name || "Walk-in Customer"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search Results / Product Grid */}
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>
              {searchQuery ? "Search Results" : "Quick Products"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {searching ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : searchQuery && searchResults?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No products found for "{searchQuery}"
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(searchResults || []).map((product) => (
                  <button
                    key={product.id}
                    onClick={() => handleAddToCart(product)}
                    className="text-left p-4 border rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-sm flex-1">
                        {product.name}
                      </h3>
                      {product.needs_restock && (
                        <Badge variant="destructive" className="ml-2 text-xs">
                          Low Stock
                        </Badge>
                      )}
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-green-600">
                        {formatCurrency(product.price)}
                      </span>
                      <span className="text-sm text-gray-500">
                        Stock: {product.stock_quantity}
                      </span>
                    </div>

                    {product.barcode && (
                      <div className="text-xs text-gray-400 mt-1">
                        📊 {product.barcode}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Quick Access Categories when no search */}
            {!searchQuery && !searching && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Quick Categories
                </h4>
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <Button
                      key={category}
                      variant="outline"
                      size="sm"
                      onClick={() => setSearchQuery(category)}
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Panel - Cart & Checkout */}
      <div className="w-full lg:w-96 flex flex-col">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              Shopping Cart
              {cart.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearCart}
                  disabled={isProcessing}
                >
                  Clear
                </Button>
              )}
            </CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col h-[calc(100%-80px)]">
            {/* Cart Items */}
            <div className="flex-1 overflow-auto">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>Cart is empty</p>
                  <p className="text-sm">Search and add products to start</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">
                          {item.product.name}
                        </h4>
                        <p className="text-green-600 font-semibold">
                          {formatCurrency(item.unitPrice)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            updateQuantity(item.product.id, item.quantity - 1)
                          }
                          disabled={isProcessing}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>

                        <span className="w-8 text-center font-medium">
                          {item.quantity}
                        </span>

                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            updateQuantity(item.product.id, item.quantity + 1)
                          }
                          disabled={
                            isProcessing ||
                            item.quantity >= item.product.stock_quantity
                          }
                        >
                          <Plus className="h-3 w-3" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-700"
                          onClick={() => removeFromCart(item.product.id)}
                          disabled={isProcessing}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Checkout Section */}
            {cart.length > 0 && (
              <div className="border-t pt-4 mt-4 space-y-4">
                {/* Payment Method */}
                <PaymentMethodSelector />

                {/* Cash Tender (only show for cash payments) */}
                <CashTender />

                {/* Total and Checkout Button */}
                <div className="space-y-3">
                  <div className="flex justify-between text-lg font-semibold border-t pt-3">
                    <span>Total:</span>
                    <span className="text-green-600">
                      {formatCurrency(cartTotal)}
                    </span>
                  </div>

                  {/* Validation Messages */}
                  {paymentMethod === "cash" && cashTendered < cartTotal && (
                    <div className="text-red-500 text-sm text-center">
                      Please enter sufficient cash amount
                    </div>
                  )}

                  {paymentMethod === "utang" && customer === null && (
                    <div className="text-amber-600 text-sm text-center">
                      ⚠️ Please select a customer for utang transactions
                    </div>
                  )}

                  <Button
                    className="w-full h-12 text-lg"
                    onClick={handleCheckout}
                    disabled={
                      isProcessing ||
                      cart.length === 0 ||
                      (paymentMethod === "cash" && cashTendered < cartTotal) ||
                      (paymentMethod === "utang" && customer === null)
                    }
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Processing...
                      </>
                    ) : paymentMethod === "utang" ? (
                      `Record Utang - ${formatCurrency(cartTotal)}`
                    ) : (
                      `Checkout - ${formatCurrency(cartTotal)}`
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default POS;
