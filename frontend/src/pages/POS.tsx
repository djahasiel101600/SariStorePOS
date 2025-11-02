// src/pages/POS.tsx
import React, { useEffect, useMemo, useRef } from "react";
import { usePOS } from "@/hooks/use-pos";
import { useProductSearch, useCreateSale, useAllProducts } from "@/hooks/api";
import { useHotkeys } from "react-hotkeys-hook";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { Product } from "@/types";
import CustomerSearch from "@/components/pos/CustomerSearch";
import PaymentMethodSelector from "@/components/pos/PaymentMethodSelector";
import CashTender from "@/components/pos/CashTendered";
import ScannerDialog from "@/components/pos/ScannerDialog";
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
    updateUnitPrice,
    updateRequestedAmount,
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

  // POS page relies on server-side search results; reintroduce dynamic categories for quick filtering

  const cartTotal = getCartTotal();
  const cartItemCount = getCartItemCount();

  const { data: searchResults, isLoading: searching } =
    useProductSearch(searchQuery);
  const { data: allProducts = [] } = useAllProducts();
  const categories = useMemo(() => {
    const arr = Array.isArray(allProducts) ? allProducts : [];
    return [
      ...new Set(
        arr
          .map((p) => p.category)
          .filter((c): c is string => Boolean(c))
      ),
    ];
  }, [allProducts]);
  const createSaleMutation = useCreateSale();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [scannerOpen, setScannerOpen] = React.useState(false);

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

  // Auto-add to cart if a scan yields exactly 1 matching product
  useEffect(() => {
    if (!searchQuery) return;
    if (!Array.isArray(searchResults)) return;
    if (searchResults.length !== 1) return;
    // Add single result and clear search
    const product = searchResults[0];
    const defaultQuantity = product.unit_type === 'piece' ? 1 : 0.1;
    addToCart(product, defaultQuantity);
    if (product.pricing_model === 'variable') {
      toast.info(`Added ${product.name}. Set quantity/price in cart for variable pricing.`);
    } else {
      toast.success(`Added ${product.name} to cart`);
    }
    setSearchQuery("");
  }, [searchQuery, searchResults]);

  const handleAddToCart = (product: Product) => {
    // For variable pricing, we might want to show a dialog for amount
    // For now, just add with default quantity
    const defaultQuantity = product.unit_type === 'piece' ? 1 : 0.1;
    addToCart(product, defaultQuantity);
    
    if (product.pricing_model === 'variable') {
      toast.info(`Added ${product.name}. Set quantity/price in cart for variable pricing.`);
    } else {
      toast.success(`Added ${product.name} to cart`);
    }
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
        payment_method: paymentMethod,
        total_amount: totalAmount,
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          requested_amount: item.requestedAmount || null,
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
    setScannerOpen(true);
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
              <ScannerDialog
                open={scannerOpen}
                onOpenChange={setScannerOpen}
                keepOpenAfterScan={true}
                onScan={(text) => {
                  setSearchQuery(text);
                  // After scan, focus search to allow Enter-to-add behavior
                  setTimeout(() => searchInputRef.current?.focus(), 0);
                }}
              />
              {/* Customer Search - Fixed width */}
              <div className="w-full lg:w-80">
                <CustomerSearch />
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-4 mt-4 text-sm text-gray-600 flex-wrap items-center">
              <div className="flex items-center gap-1">
                <ShoppingCart className="h-4 w-4" />
                <span>{cartItemCount} items</span>
              </div>
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                <span>{customer?.name || "Walk-in Customer"}</span>
              </div>
              {paymentMethod === 'utang' && customer && (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-gray-500">Outstanding:</span>
                  <span className="text-sm font-semibold text-amber-700">
                    {formatCurrency(customer.outstanding_balance || 0)}
                  </span>
                </div>
              )}
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
            {/* Quick Categories - always visible */}
            {categories.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-medium text-gray-700 mr-2">Quick Categories:</h4>
                {categories.map((category) => {
                  const isActive = category.toLowerCase() === (searchQuery || '').toLowerCase();
                  return (
                    <Button
                      key={category}
                      variant={isActive ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSearchQuery(category)}
                    >
                      {category}
                    </Button>
                  );
                })}
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-600"
                    onClick={() => setSearchQuery("")}
                  >
                    Clear
                  </Button>
                )}
              </div>
            )}

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
                      <div className="flex flex-col">
                        <span className="text-lg font-bold text-green-600">
                          {product.pricing_model === 'variable' 
                            ? (product.price ? `~${formatCurrency(product.price)}/${product.unit_type}` : 'Variable')
                            : formatCurrency(product.price || 0)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {product.unit_type_display || product.unit_type}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        Stock: {product.stock_quantity} {product.unit_type}
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
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3 border rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">
                          {item.product.name}
                        </h4>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-green-600 font-semibold">
                            {formatCurrency(item.unitPrice)}/{item.product.unit_type}
                          </p>
                          {item.requestedAmount && (
                            <span className="text-xs text-gray-500">
                              (Requested: {formatCurrency(item.requestedAmount)})
                            </span>
                          )}
                        </div>
                        {item.product.pricing_model === 'variable' && (
                          <div className="mt-1 flex items-center gap-2 flex-wrap">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={Number.isFinite(item.unitPrice) ? item.unitPrice : 0}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                updateUnitPrice(item.product.id, isNaN(val) ? 0 : val);
                              }}
                              className="w-full sm:w-24 text-center font-medium border rounded px-2 py-1 text-sm"
                              disabled={isProcessing}
                            />
                            <span className="text-xs text-gray-500">Unit price</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.requestedAmount ?? ''}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                updateRequestedAmount(item.product.id, isNaN(val) ? 0 : val);
                              }}
                              placeholder="₱ amount"
                              className="w-full sm:w-28 text-center font-medium border rounded px-2 py-1 text-sm"
                              disabled={isProcessing}
                            />
                          </div>
                        )}
                        <p className="text-xs text-gray-500">
                          Total: {formatCurrency(item.unitPrice * item.quantity)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            const newQty = Math.max(0.001, item.quantity - (item.product.unit_type === 'piece' ? 1 : 0.1));
                            updateQuantity(item.product.id, parseFloat(newQty.toFixed(3)));
                          }}
                          disabled={isProcessing}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>

                        <input
                          type="number"
                          step={item.product.unit_type === 'piece' ? '1' : '0.001'}
                          min="0.001"
                          value={item.quantity}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0.001;
                            updateQuantity(item.product.id, value);
                          }}
                          className="w-24 md:w-16 text-center font-medium border rounded px-2 py-1 text-sm"
                          disabled={isProcessing}
                        />

                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            const newQty = item.quantity + (item.product.unit_type === 'piece' ? 1 : 0.1);
                            if (newQty <= item.product.stock_quantity) {
                              updateQuantity(item.product.id, parseFloat(newQty.toFixed(3)));
                            }
                          }}
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
                {paymentMethod === 'cash' && <CashTender />}

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
