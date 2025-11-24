// src/pages/POS.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePOS } from "@/hooks/use-pos";
import {
  useProductSearch,
  useCreateSale,
  useAllProducts,
  useMyShift,
  useStartShift,
  useEndShift,
} from "@/hooks/api";
import { useHotkeys } from "react-hotkeys-hook";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { Product } from "@/types";
import { api } from "@/lib/api";
import CustomerSearch from "@/components/pos/CustomerSearch";
import PaymentMethodSelector from "@/components/pos/PaymentMethodSelector";
import CashTender from "@/components/pos/CashTendered";
import ScannerDialog from "@/components/pos/ScannerDialog";
import { MobileCartDrawer } from "@/components/pos/MobileCartDrawer";
import { FloatingActionButton } from "@/components/pos/FloatingActionButton";
import { QuickCustomerDialog } from "@/components/pos/QuickCustomerDialog";
import { ReceiptDialog } from "@/components/pos/ReceiptDialog";
import { RecentSalesDialog } from "@/components/pos/RecentSalesDialog";
import {
  StartShiftDialog,
  EndShiftDialog,
} from "@/components/pos/ShiftManagementDialogs";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  User,
  Barcode,
  Loader2,
  Volume2,
  VolumeX,
  History,
  UserPlus,
  ImageIcon,
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
    getCartTotal,
    getCartItemCount,
    paymentMethod,
    cashTendered,
    setCashTendered,
    setPaymentMethod,
  } = usePOS();

  const cartTotal = getCartTotal();
  const cartItemCount = getCartItemCount();
  const { data: searchResults, isLoading: searching } =
    useProductSearch(searchQuery);
  const { data: allProducts = [] } = useAllProducts();
  const createSaleMutation = useCreateSale();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const { data: activeShift } = useMyShift();
  const startShiftMutation = useStartShift();
  const endShiftMutation = useEndShift();
  const [showStartShift, setShowStartShift] = useState(false);
  const [showEndShift, setShowEndShift] = useState(false);
  const [scannedBarcodes, setScannedBarcodes] = useState<string[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem("pos-sound-enabled") !== "false";
  });
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [showRecentSales, setShowRecentSales] = useState(false);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [batchScanMode, setBatchScanMode] = useState(false);
  const [batchScans, setBatchScans] = useState<string[]>([]);

  const categories = useMemo(() => {
    const arr = Array.isArray(allProducts) ? allProducts : [];
    return [
      ...new Set(
        arr.map((p) => p.category).filter((c): c is string => Boolean(c))
      ),
    ];
  }, [allProducts]);

  // Keyboard shortcuts (disabled on mobile)
  useHotkeys("ctrl+k", (e) => {
    e.preventDefault();
    searchInputRef.current?.focus();
  });

  useHotkeys("enter", () => {
    if (
      searchInputRef.current === document.activeElement &&
      searchResults?.[0]
    ) {
      handleAddToCart(searchResults[0]);
    }
  });

  useHotkeys("escape", () => {
    if (searchQuery) {
      setSearchQuery("");
    }
  });

  useHotkeys("ctrl+shift+c", (e) => {
    e.preventDefault();
    if (cart.length > 0 && !showClearConfirm) {
      setShowClearConfirm(true);
    }
  });

  // Auto-add to cart if a scan yields exactly 1 matching product
  useEffect(() => {
    if (!searchQuery) return;
    if (!Array.isArray(searchResults)) return;
    if (searchResults.length !== 1) return;

    const product = searchResults[0];
    const defaultQuantity = product.unit_type === "piece" ? 1 : 0.1;
    addToCart(product, defaultQuantity);

    if (product.pricing_model === "variable") {
      toast.info(
        `Added ${product.name}. Set quantity/price in cart for variable pricing.`
      );
    } else {
      toast.success(`Added ${product.name} to cart`);
    }
    setSearchQuery("");
  }, [searchQuery, searchResults]);

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success("Connection restored");
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.error("Connection lost - working offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Load recent sales
  useEffect(() => {
    const loadRecentSales = async () => {
      try {
        const { data } = await api.get("/sales/", {
          params: { limit: 10, ordering: "-created_at" },
        });
        setRecentSales(Array.isArray(data.results) ? data.results : data);
      } catch (err) {
        console.error("Failed to load recent sales", err);
      }
    };
    if (showRecentSales) {
      loadRecentSales();
    }
  }, [showRecentSales]);

  // Sound persistence
  useEffect(() => {
    localStorage.setItem("pos-sound-enabled", soundEnabled.toString());
  }, [soundEnabled]);

  const handleStartShift = async (data: {
    opening_cash: number;
    notes?: string;
  }) => {
    try {
      await startShiftMutation.mutateAsync({
        ...data,
        terminal_id: "terminal-1",
      });
      toast.success("Shift started successfully");
    } catch (err: any) {
      console.error("Start shift error", err);
      toast.error(err.response?.data?.error || "Failed to start shift");
      throw err;
    }
  };

  const handleEndShift = async (data: {
    closing_cash: number;
    notes?: string;
  }) => {
    if (!activeShift) return;
    try {
      await endShiftMutation.mutateAsync({ shiftId: activeShift.id, ...data });
      toast.success("Shift ended successfully");
    } catch (err: any) {
      console.error("End shift error", err);
      toast.error(err.response?.data?.error || "Failed to end shift");
      throw err;
    }
  };

  const playSound = (type: "success" | "error" | "scan") => {
    if (!soundEnabled) return;
    // Use different frequencies for different sounds
    const freq = type === "success" ? 800 : type === "error" ? 400 : 1000;
    const duration = type === "error" ? 200 : 100;

    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = freq;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + duration / 1000
    );

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration / 1000);
  };

  const handleAddToCart = (product: Product) => {
    const defaultQuantity = product.unit_type === "piece" ? 1 : 0.1;
    addToCart(product, defaultQuantity);
    playSound("success");

    // Track recent products (max 6)
    setRecentProducts((prev) => {
      const filtered = prev.filter((p) => p.id !== product.id);
      return [product, ...filtered].slice(0, 6);
    });

    if (product.pricing_model === "variable") {
      toast.info(
        `Added ${product.name}. Set quantity/price in cart for variable pricing.`
      );
    } else {
      toast.success(`Added ${product.name} to cart`);
    }
    setSearchQuery("");

    // Auto-focus search for quick consecutive additions
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const handleBarcodeSearch = (barcode: string) => {
    console.log("Scanned barcode:", barcode);
    playSound("scan");
    setScannedBarcodes((prev) => [...prev, barcode]);

    if (batchScanMode) {
      setBatchScans((prev) => [...prev, barcode]);
      toast.info(`Batch: ${batchScans.length + 1} items scanned`);
    } else {
      setSearchQuery(barcode);
      setIsScannerOpen(false);
    }
  };

  const processBatchScans = () => {
    batchScans.forEach((barcode) => {
      setSearchQuery(barcode);
    });
    setBatchScans([]);
    setBatchScanMode(false);
    toast.success(`Added ${batchScans.length} items from batch`);
  };

  const handleClearCart = () => {
    if (showClearConfirm) {
      clearCart();
      setShowClearConfirm(false);
      toast.success("Cart cleared");
      searchInputRef.current?.focus();
    } else {
      setShowClearConfirm(true);
      setTimeout(() => setShowClearConfirm(false), 3000);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

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

      const response = await createSaleMutation.mutateAsync(saleData);

      playSound("success");

      // Prepare receipt data
      const receiptData = {
        items: cart,
        total: totalAmount,
        paymentMethod,
        cashTendered: paymentMethod === "cash" ? cashTendered : undefined,
        changeDue:
          paymentMethod === "cash" ? cashTendered - totalAmount : undefined,
        customer,
        timestamp: new Date(),
        receiptNumber: response?.id?.toString() || Date.now().toString(),
      };
      setLastSale(receiptData);
      setShowReceipt(true);

      if (paymentMethod === "utang") {
        toast.success(
          `Utang recorded for ${customer?.name}! Total: ${formatCurrency(totalAmount)}`
        );
      } else {
        toast.success("Sale completed successfully!");
      }

      clearCart();
      setCashTendered(0);
      setPaymentMethod("cash");
      setIsCartOpen(false);
    } catch (error: any) {
      playSound("error");
      console.error("Checkout error details:", error.response?.data);
      toast.error(
        `Failed to process ${paymentMethod === "utang" ? "utang" : "sale"}`
      );
    } finally {
      setProcessing(false);
    }
  };

  // Cart Content Component (reusable for both desktop and mobile)
  const CartContent = ({ isMobile = false }) => (
    <div className={`flex flex-col ${isMobile ? "h-full" : ""}`}>
      {/* Cart Items */}
      <div className={`flex-1 ${isMobile ? "overflow-auto" : ""}`}>
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
                className="flex flex-col gap-3 p-4 border rounded-lg bg-white"
              >
                <div className="flex gap-3">
                  {/* Product Image */}
                  {item.product.image ? (
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="h-16 w-16 object-cover rounded border shrink-0"
                    />
                  ) : (
                    <div className="h-16 w-16 bg-gray-100 rounded border flex items-center justify-center shrink-0">
                      <ImageIcon className="h-8 w-8 text-gray-400" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-base truncate">
                      {item.product.name}
                    </h4>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      <p className="text-green-600 font-semibold">
                        {formatCurrency(item.unitPrice)}/
                        {item.product.unit_type}
                      </p>
                      {item.requestedAmount && (
                        <span className="text-sm text-gray-500">
                          (Requested: {formatCurrency(item.requestedAmount)})
                        </span>
                      )}
                    </div>

                    {item.product.pricing_model === "variable" && (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-600 min-w-20">
                            Unit Price:
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                              Number.isFinite(item.unitPrice)
                                ? item.unitPrice
                                : 0
                            }
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              updateUnitPrice(
                                item.product.id,
                                isNaN(val) ? 0 : val
                              );
                            }}
                            className="flex-1 text-center font-medium border rounded-lg px-3 py-2 text-base"
                            disabled={isProcessing}
                            inputMode="decimal"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-600 min-w-20">
                            Amount:
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.requestedAmount ?? ""}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              updateRequestedAmount(
                                item.product.id,
                                isNaN(val) ? 0 : val
                              );
                            }}
                            placeholder="₱ amount"
                            className="flex-1 text-center font-medium border rounded-lg px-3 py-2 text-base"
                            disabled={isProcessing}
                            inputMode="decimal"
                          />
                        </div>
                      </div>
                    )}

                    <p className="text-sm text-gray-500 mt-2">
                      Total: {formatCurrency(item.unitPrice * item.quantity)}
                    </p>
                  </div>
                </div>

                {/* Quantity Controls - Larger touch targets */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10" // Larger touch target
                        onClick={() => {
                          const newQty = Math.max(
                            0.001,
                            item.quantity -
                              (item.product.unit_type === "piece" ? 1 : 0.1)
                          );
                          updateQuantity(
                            item.product.id,
                            parseFloat(newQty.toFixed(3))
                          );
                        }}
                        disabled={isProcessing}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>

                      <input
                        type="number"
                        step={
                          item.product.unit_type === "piece" ? "1" : "0.001"
                        }
                        min="0.001"
                        value={item.quantity}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0.001;
                          updateQuantity(item.product.id, value);
                        }}
                        className="w-20 text-center font-medium border rounded-lg px-2 py-2 text-base"
                        disabled={isProcessing}
                        inputMode="decimal"
                      />

                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10" // Larger touch target
                        onClick={() => {
                          const newQty =
                            item.quantity +
                            (item.product.unit_type === "piece" ? 1 : 0.1);
                          if (newQty <= item.product.stock_quantity) {
                            updateQuantity(
                              item.product.id,
                              parseFloat(newQty.toFixed(3))
                            );
                          }
                        }}
                        disabled={
                          isProcessing ||
                          item.quantity >= item.product.stock_quantity
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-red-500 hover:text-red-700" // Larger touch target
                      onClick={() => removeFromCart(item.product.id)}
                      disabled={isProcessing}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Quick add buttons for pieces */}
                  {item.product.unit_type === "piece" && (
                    <div className="flex gap-1">
                      {[5, 10, 20].map((qty) => (
                        <Button
                          key={qty}
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs flex-1"
                          onClick={() => {
                            const newQty = item.quantity + qty;
                            if (newQty <= item.product.stock_quantity) {
                              updateQuantity(item.product.id, newQty);
                            } else {
                              toast.warning(
                                `Only ${item.product.stock_quantity} available`
                              );
                            }
                          }}
                          disabled={
                            isProcessing ||
                            item.quantity + qty > item.product.stock_quantity
                          }
                        >
                          +{qty}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Stock warning */}
                {item.product.stock_quantity < 10 && (
                  <div className="text-xs text-amber-600 mt-1">
                    ⚠️ Only {item.product.stock_quantity} left in stock
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Checkout Section */}
      {cart.length > 0 && !isMobile && (
        <div className="border-t pt-4 mt-4 space-y-4">
          <PaymentMethodSelector />
          {paymentMethod === "cash" && <CashTender />}

          <div className="space-y-3">
            <div className="flex justify-between text-lg font-semibold border-t pt-3">
              <span>Total:</span>
              <span className="text-green-600">
                {formatCurrency(cartTotal)}
              </span>
            </div>

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

            {!activeShift && (
              <div className="text-red-600 text-sm text-center">
                ⚠️ No active shift. Please start a shift to enable checkout.
              </div>
            )}

            <Button
              className="w-full h-12 text-lg"
              onClick={handleCheckout}
              disabled={
                isProcessing ||
                !activeShift ||
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
    </div>
  );

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 pb-20 lg:pb-0">
      {" "}
      {/* Added padding for FAB */}
      {/* Left Panel - Products Search & Selection */}
      <div className="flex-1 flex flex-col">
        {/* Search Header */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    ref={searchInputRef}
                    placeholder="Search products (Ctrl+K)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 h-12 text-base" // Larger input
                  />
                </div>

                <ScannerDialog
                  onScan={handleBarcodeSearch}
                  open={isScannerOpen}
                  onOpenChange={setIsScannerOpen}
                  trigger={
                    <Button
                      variant="outline"
                      className="h-12 px-4" // Larger button
                      size="lg"
                    >
                      <Barcode className="h-5 w-5 mr-2" />
                      Scan
                    </Button>
                  }
                />
              </div>

              {/* Customer Search */}
              <div className="w-full">
                <CustomerSearch />
              </div>

              {/* Scanned Items */}
              {/* Offline indicator */}
              {isOffline && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="text-sm text-amber-800 flex items-center gap-2">
                    <span className="animate-pulse">⚠️</span>
                    Working offline - changes will sync when connection is
                    restored
                  </div>
                </div>
              )}

              {/* Batch scan mode */}
              {batchScanMode && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-purple-800">
                      Batch Mode: {batchScans.length} items scanned
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={processBatchScans}
                        disabled={batchScans.length === 0}
                      >
                        Add All
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setBatchScanMode(false);
                          setBatchScans([]);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {scannedBarcodes.length > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm text-blue-800">
                    Recently scanned: {scannedBarcodes.slice(-3).join(", ")}
                    {scannedBarcodes.length > 3 &&
                      ` and ${scannedBarcodes.length - 3} more`}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="flex gap-4 mt-4 text-sm text-gray-600 flex-wrap items-center">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                <span>{cartItemCount} items</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>{customer?.name || "Walk-in Customer"}</span>
              </div>
              {paymentMethod === "utang" && customer && (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-gray-500">Outstanding:</span>
                  <span className="text-sm font-semibold text-amber-700">
                    {formatCurrency(customer.outstanding_balance || 0)}
                  </span>
                </div>
              )}
              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  title={soundEnabled ? "Disable sound" : "Enable sound"}
                >
                  {soundEnabled ? (
                    <Volume2 className="h-4 w-4" />
                  ) : (
                    <VolumeX className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRecentSales(true)}
                  title="View recent sales"
                >
                  <History className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQuickCustomer(true)}
                  title="Quick add customer"
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>

              {/* Shift controls */}
              <div className="flex items-center gap-2">
                {activeShift ? (
                  <>
                    <div className="text-sm text-gray-600">
                      Shift active •{" "}
                      {new Date(activeShift.start_time).toLocaleString()}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowEndShift(true)}
                      disabled={isProcessing}
                    >
                      End Shift
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => setShowStartShift(true)}
                    disabled={startShiftMutation.isPending}
                  >
                    Start Shift
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search Results / Product Grid */}
        <Card className="flex-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {searchQuery ? "Search Results" : "Quick Products"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Quick Categories */}
            {categories.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Quick Categories:
                </h4>
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => {
                    const isActive =
                      category.toLowerCase() ===
                      (searchQuery || "").toLowerCase();
                    return (
                      <Button
                        key={category}
                        variant={isActive ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSearchQuery(category)}
                        className="h-9 px-3" // Larger touch target
                      >
                        {category}
                      </Button>
                    );
                  })}
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 px-3 text-gray-600"
                      onClick={() => setSearchQuery("")}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Recent Products */}
            {!searchQuery && recentProducts.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  🕒 Recent Products:
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {recentProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleAddToCart(product)}
                      className="text-left p-2 border rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 active:bg-gray-100"
                    >
                      <div className="text-sm font-medium truncate">
                        {product.name}
                      </div>
                      <div className="text-xs text-green-600 font-semibold">
                        {formatCurrency(product.price || 0)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {searching ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : searchQuery && searchResults?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No products found for "{searchQuery}"
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(searchResults || []).map((product) => (
                  <button
                    key={product.id}
                    onClick={() => handleAddToCart(product)}
                    className="text-left p-4 border rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 active:bg-gray-100 min-h-[100px]" // Larger touch target
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-base flex-1">
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
                          {product.pricing_model === "variable"
                            ? product.price
                              ? `~${formatCurrency(product.price)}/${product.unit_type}`
                              : "Variable"
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
                      <div className="text-xs text-gray-400 mt-2">
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
      {/* Desktop Cart Panel */}
      <div className="hidden lg:flex w-96 flex-col">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex justify-between items-center text-lg">
              Shopping Cart
              {cart.length > 0 && (
                <Button
                  variant={showClearConfirm ? "destructive" : "outline"}
                  size="sm"
                  onClick={handleClearCart}
                  disabled={isProcessing}
                >
                  {showClearConfirm ? "Confirm Clear?" : "Clear"}
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col h-[calc(100%-80px)]">
            <CartContent />
          </CardContent>
        </Card>
      </div>
      {/* Mobile Cart Drawer */}
      <MobileCartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItemCount={cartItemCount}
        cartTotal={cartTotal}
      >
        <CartContent isMobile={true} />

        {/* Mobile Checkout Section */}
        {cart.length > 0 && (
          <div className="border-t pt-4 mt-4 space-y-4">
            <PaymentMethodSelector />
            {paymentMethod === "cash" && <CashTender />}

            <div className="space-y-3">
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
                className="w-full h-14 text-base font-semibold"
                onClick={handleCheckout}
                disabled={
                  isProcessing ||
                  !activeShift ||
                  cart.length === 0 ||
                  (paymentMethod === "cash" && cashTendered < cartTotal) ||
                  (paymentMethod === "utang" && customer === null)
                }
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
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
      </MobileCartDrawer>
      {/* Floating Action Button */}
      <FloatingActionButton
        cartItemCount={cartItemCount}
        onCartClick={() => setIsCartOpen(true)}
        onScanClick={() => setIsScannerOpen(true)}
      />
      {/* Quick Customer Dialog */}
      <QuickCustomerDialog
        open={showQuickCustomer}
        onOpenChange={setShowQuickCustomer}
        onCustomerCreated={(newCustomer) => {
          // Optionally set as current customer
          toast.success(`Customer ${newCustomer.name} created!`);
        }}
      />
      {/* Receipt Dialog */}
      {lastSale && (
        <ReceiptDialog
          open={showReceipt}
          onOpenChange={setShowReceipt}
          saleData={lastSale}
        />
      )}
      {/* Recent Sales Dialog */}
      <RecentSalesDialog
        open={showRecentSales}
        onOpenChange={setShowRecentSales}
        sales={recentSales}
      />
      {/* Shift Management Dialogs */}
      <StartShiftDialog
        open={showStartShift}
        onClose={() => setShowStartShift(false)}
        onStart={handleStartShift}
        isLoading={startShiftMutation.isPending}
      />
      <EndShiftDialog
        open={showEndShift}
        onClose={() => setShowEndShift(false)}
        onEnd={handleEndShift}
        shift={activeShift || null}
        isLoading={endShiftMutation.isPending}
      />
    </div>
  );
};

export default POS;
