// src/pages/POS.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { getErrorMessage } from "@/lib/errorHandling";
import { Product } from "@/types";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
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
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const POS: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Restrict Inventory Managers from accessing POS
  useEffect(() => {
    if (user?.role === "inventory_manager") {
      toast.error("Access denied. Inventory Managers cannot access POS.");
      navigate("/inventory");
    }
  }, [user, navigate]);

  const {
    cart,
    customer,
    searchQuery,
    isProcessing,
    addToCart,
    removeFromCart,
    updateQuantity,
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

  // Use useMemo to ensure cartTotal recalculates when cart changes
  const cartTotal = useMemo(() => getCartTotal(), [cart]);
  const cartItemCount = useMemo(() => getCartItemCount(), [cart]);

  const { data: searchResults, isLoading: searching } =
    useProductSearch(searchQuery);
  const { data: allProducts = [] } = useAllProducts();
  const createSaleMutation = useCreateSale();

  // Reset selected index when search results change
  useEffect(() => {
    setSelectedResultIndex(0);
  }, [searchResults]);

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
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const cashTenderedRef = useRef<HTMLInputElement>(null);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);

  const categories = useMemo(() => {
    const arr = Array.isArray(allProducts) ? allProducts : [];
    return [
      ...new Set(
        arr.map((p) => p.category).filter((c): c is string => Boolean(c))
      ),
    ];
  }, [allProducts]);

  // Keyboard shortcuts (disabled on mobile)
  // Search & Navigation
  useHotkeys("ctrl+k, /", (e) => {
    e.preventDefault();
    searchInputRef.current?.focus();
  });

  useHotkeys("escape", () => {
    if (searchQuery) {
      setSearchQuery("");
      searchInputRef.current?.blur();
    } else if (showShortcutsHelp) {
      setShowShortcutsHelp(false);
    }
  });

  // Cart Actions
  useHotkeys("ctrl+shift+c", (e) => {
    e.preventDefault();
    if (cart.length > 0 && !showClearConfirm) {
      setShowClearConfirm(true);
    }
  });

  // Checkout
  useHotkeys("ctrl+enter", (e) => {
    e.preventDefault();
    if (
      cart.length > 0 &&
      activeShift &&
      !isProcessing &&
      (paymentMethod !== "cash" || cashTendered >= cartTotal) &&
      (paymentMethod !== "utang" || customer !== null)
    ) {
      handleCheckout();
    }
  });

  // Payment Methods
  useHotkeys("alt+1, f1", (e) => {
    e.preventDefault();
    setPaymentMethod("cash");
    toast.success("Payment method: Cash");
  });

  useHotkeys("alt+2, f2", (e) => {
    e.preventDefault();
    setPaymentMethod("mobile");
    toast.success("Payment method: Mobile");
  });

  useHotkeys("f3", (e) => {
    e.preventDefault();
    setPaymentMethod("card");
    toast.success("Payment method: Card");
  });

  useHotkeys("alt+3, f4", (e) => {
    e.preventDefault();
    setPaymentMethod("utang");
    toast.success("Payment method: Utang");
  });

  // Scanner
  useHotkeys("ctrl+b, f8", (e) => {
    e.preventDefault();
    setIsScannerOpen(!isScannerOpen);
  });

  // Customer
  useHotkeys("ctrl+u, f9", (e) => {
    e.preventDefault();
    setShowQuickCustomer(true);
  });

  // Recent Sales
  useHotkeys("ctrl+h, f10", (e) => {
    e.preventDefault();
    setShowRecentSales(true);
  });

  // Cash Tendered
  useHotkeys("f6", (e) => {
    e.preventDefault();
    if (paymentMethod === "cash" && cashTenderedRef.current) {
      cashTenderedRef.current.focus();
      cashTenderedRef.current.select();
    }
  });

  // Help
  useHotkeys("ctrl+/, ?", (e) => {
    e.preventDefault();
    setShowShortcutsHelp(!showShortcutsHelp);
  });

  // Auto-add to cart if a scan yields exactly 1 matching product
  useEffect(() => {
    if (!searchQuery) return;
    if (!Array.isArray(searchResults)) return;
    if (searchResults.length !== 1) return;

    const product = searchResults[0];
    const defaultQuantity = product.unit_type === "piece" ? 1 : 0.1;
    addToCart(product, defaultQuantity);

    toast.success(`Added ${product.name} to cart`);
    setSearchQuery("");
  }, [searchQuery, searchResults, addToCart, setSearchQuery]);

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
      toast.error(getErrorMessage(err));
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
      toast.error(getErrorMessage(err));
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

    toast.success(`Added ${product.name} to cart`);
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
          requested_amount: item.requestedAmount ?? null,
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
      console.error("Checkout error details:", error);
      toast.error(getErrorMessage(error));
    } finally {
      setProcessing(false);
    }
  };

  // Cart Content Component (reusable for both desktop and mobile)
  const CartContent = ({ isMobile = false }) => {
    // Local state for price input to avoid losing focus on every keystroke
    const [localPriceInputs, setLocalPriceInputs] = React.useState<
      Record<number, string>
    >({});

    return (
      <div className={`flex flex-col ${isMobile ? "h-full" : ""}`}>
        {/* Cart Items */}
        <div className={`flex-1 ${isMobile ? "overflow-auto" : ""}`}>
          {cart.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>Cart is empty: {}</p>
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
                        {item.requestedAmount != null && (
                          <span className="text-sm text-gray-500">
                            {"(Price override: "}
                            {formatCurrency(item.requestedAmount)}
                            {" • "}
                            {(() => {
                              const base = Number(item.unitPrice || 0);
                              const over = Number(item.requestedAmount ?? 0);
                              const delta = over - base;
                              const sign = delta >= 0 ? "+" : "-";
                              const pct =
                                base > 0 ? (delta / base) * 100 : null;
                              return (
                                <>
                                  {sign}
                                  {formatCurrency(Math.abs(delta))}
                                  {pct !== null && (
                                    <>
                                      {" / "}
                                      {sign}
                                      {Math.abs(pct).toFixed(1)}%
                                    </>
                                  )}
                                </>
                              );
                            })()}
                            {")"}
                          </span>
                        )}
                      </div>

                      {/* Price override controls - Only for variable pricing products */}
                      {item.product.pricing_model === "variable" && (
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <label className="text-sm text-gray-600 w-24 shrink-0">
                              Set Price (₱):
                            </label>
                            <div className="flex-1 min-w-0 flex items-center gap-1">
                              <input
                                type="number"
                                step={
                                  item.product.unit_type === "piece"
                                    ? "1"
                                    : "0.01"
                                }
                                min={item.unitPrice}
                                value={
                                  localPriceInputs[item.product.id] !==
                                  undefined
                                    ? localPriceInputs[item.product.id]
                                    : item.requestedAmount != null
                                      ? String(item.requestedAmount)
                                      : ""
                                }
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  // Update local state only, don't update cart yet
                                  setLocalPriceInputs((prev) => ({
                                    ...prev,
                                    [item.product.id]: raw,
                                  }));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.currentTarget.blur();
                                  }
                                }}
                                onBlur={(e) => {
                                  const raw = e.target.value;
                                  // Clear local state
                                  setLocalPriceInputs((prev) => {
                                    const newState = { ...prev };
                                    delete newState[item.product.id];
                                    return newState;
                                  });

                                  // Update cart state
                                  if (raw === "") {
                                    updateRequestedAmount(
                                      item.product.id,
                                      null
                                    );
                                    return;
                                  }
                                  const parsed = parseFloat(raw);
                                  if (isNaN(parsed)) {
                                    return;
                                  }

                                  // Enforce minimum price (cannot be less than original)
                                  if (parsed < item.unitPrice) {
                                    toast.error(
                                      `Price cannot be less than ${formatCurrency(item.unitPrice)}`
                                    );
                                    return;
                                  }

                                  const normalized =
                                    item.product.unit_type === "piece"
                                      ? Math.round(parsed)
                                      : Math.round(parsed * 100) / 100;
                                  updateRequestedAmount(
                                    item.product.id,
                                    normalized
                                  );
                                }}
                                className="flex-1 min-w-0 max-w-full text-center font-medium border rounded-lg px-3 py-2 text-base overflow-hidden"
                                disabled={isProcessing}
                                inputMode="decimal"
                                title={`Enter a custom per-unit price (Min: ${formatCurrency(item.unitPrice)}, Press Enter to confirm)`}
                                placeholder={item.unitPrice.toString()}
                              />

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  // Clear local state
                                  setLocalPriceInputs((prev) => {
                                    const newState = { ...prev };
                                    delete newState[item.product.id];
                                    return newState;
                                  });
                                  // Clear cart state
                                  updateRequestedAmount(item.product.id, null);
                                }}
                                disabled={isProcessing}
                                className="shrink-0 w-12"
                              >
                                <RotateCcw />
                              </Button>
                            </div>
                          </div>

                          <p className="text-sm text-gray-500 mt-2">
                            Total:{" "}
                            {formatCurrency(
                              (item.requestedAmount ?? item.unitPrice) *
                                item.quantity
                            )}
                          </p>
                        </div>
                      )}

                      {/* Display total for non-variable pricing products */}
                      {item.product.pricing_model !== "variable" && (
                        <p className="text-sm text-gray-500 mt-2">
                          Total:{" "}
                          {formatCurrency(item.unitPrice * item.quantity)}
                        </p>
                      )}
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
                            const value = parseFloat(e.target.value);
                            if (!isNaN(value) && value > 0) {
                              const clamped = Math.min(
                                value,
                                item.product.stock_quantity
                              );
                              updateQuantity(item.product.id, clamped);
                            }
                          }}
                          onBlur={(e) => {
                            const value = parseFloat(e.target.value);
                            if (isNaN(value) || value <= 0) {
                              updateQuantity(item.product.id, 0.001);
                            }
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
                                toast.success(`Added ${qty} more`);
                              } else {
                                const available =
                                  item.product.stock_quantity - item.quantity;
                                if (available > 0) {
                                  updateQuantity(
                                    item.product.id,
                                    item.product.stock_quantity
                                  );
                                  toast.warning(
                                    `Only ${available.toFixed(item.product.unit_type === "piece" ? 0 : 1)} more available - added maximum`
                                  );
                                } else {
                                  toast.error(`Maximum stock reached`);
                                }
                              }
                            }}
                            disabled={
                              isProcessing ||
                              item.quantity >= item.product.stock_quantity
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
            {paymentMethod === "cash" && <CashTender ref={cashTenderedRef} />}

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
                title="Checkout (Ctrl+Enter)"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : paymentMethod === "utang" ? (
                  <>
                    {`Record Utang - ${formatCurrency(cartTotal)}`}
                    <span className="ml-2 text-xs opacity-75">(Ctrl+↵)</span>
                  </>
                ) : (
                  <>
                    {`Checkout - ${formatCurrency(cartTotal)}`}
                    <span className="ml-2 text-xs opacity-75">(Ctrl+↵)</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

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
                    onKeyDown={(e) => {
                      if (
                        e.key === "ArrowDown" &&
                        searchResults &&
                        searchResults.length > 0
                      ) {
                        e.preventDefault();
                        setSelectedResultIndex((prev) =>
                          prev < searchResults.length - 1 ? prev + 1 : 0
                        );
                      } else if (
                        e.key === "ArrowUp" &&
                        searchResults &&
                        searchResults.length > 0
                      ) {
                        e.preventDefault();
                        setSelectedResultIndex((prev) =>
                          prev > 0 ? prev - 1 : searchResults.length - 1
                        );
                      } else if (
                        e.key === "Enter" &&
                        searchResults?.[selectedResultIndex]
                      ) {
                        e.preventDefault();
                        handleAddToCart(searchResults[selectedResultIndex]);
                      }
                    }}
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
                      title="Open barcode scanner (Ctrl+B)"
                    >
                      <Barcode className="h-5 w-5 mr-2" />
                      Scan
                    </Button>
                  }
                />

                <Button
                  variant="outline"
                  className="h-12 px-3"
                  size="lg"
                  onClick={() => setShowShortcutsHelp(true)}
                  title="Keyboard shortcuts (Ctrl+/)"
                >
                  <span className="text-lg font-bold">?</span>
                </Button>
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
                {(searchResults || []).map((product, index) => (
                  <button
                    key={product.id}
                    onClick={() => handleAddToCart(product)}
                    className={`text-left p-4 border rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 active:bg-gray-100 min-h-[100px] ${
                      index === selectedResultIndex &&
                      searchInputRef.current === document.activeElement
                        ? "ring-2 ring-blue-500 bg-blue-50"
                        : ""
                    }`}
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
            {paymentMethod === "cash" && <CashTender ref={cashTenderedRef} />}

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
                title="Checkout (Ctrl+Enter)"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Processing...
                  </>
                ) : paymentMethod === "utang" ? (
                  <>
                    {`Record Utang - ${formatCurrency(cartTotal)}`}
                    <span className="ml-2 text-xs opacity-75">(Ctrl+↵)</span>
                  </>
                ) : (
                  <>
                    {`Checkout - ${formatCurrency(cartTotal)}`}
                    <span className="ml-2 text-xs opacity-75">(Ctrl+↵)</span>
                  </>
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
      {/* Keyboard Shortcuts Help Dialog */}
      <Dialog open={showShortcutsHelp} onOpenChange={setShowShortcutsHelp}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
            <DialogDescription>
              Navigate the POS system efficiently without using a mouse
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <h3 className="font-semibold mb-2 text-sm text-muted-foreground">
                Search & Navigation
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                  <span className="text-sm">Focus search</span>
                  <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">
                    Ctrl + K
                  </kbd>
                </div>
                <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                  <span className="text-sm">Focus search (alt)</span>
                  <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">
                    /
                  </kbd>
                </div>
                <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                  <span className="text-sm">Add first result to cart</span>
                  <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">
                    Enter
                  </kbd>
                </div>
                <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                  <span className="text-sm">Clear search / Close dialogs</span>
                  <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">
                    Esc
                  </kbd>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2 text-sm text-muted-foreground">
                Payment Methods
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                  <span className="text-sm">Cash payment</span>
                  <div className="flex gap-1">
                    <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">
                      F1
                    </kbd>
                    <span className="text-xs text-muted-foreground">or</span>
                    <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">
                      Alt+1
                    </kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                  <span className="text-sm">Mobile payment (GCash)</span>
                  <div className="flex gap-1">
                    <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">
                      F2
                    </kbd>
                    <span className="text-xs text-muted-foreground">or</span>
                    <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">
                      Alt+2
                    </kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                  <span className="text-sm">Card payment</span>
                  <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">
                    F3
                  </kbd>
                </div>
                <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                  <span className="text-sm">Utang (Credit)</span>
                  <div className="flex gap-1">
                    <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">
                      F4
                    </kbd>
                    <span className="text-xs text-muted-foreground">or</span>
                    <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">
                      Alt+3
                    </kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                  <span className="text-sm">
                    Focus cash tendered (Cash only)
                  </span>
                  <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">
                    F6
                  </kbd>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2 text-sm text-muted-foreground">
                Cart Actions
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                  <span className="text-sm">Clear cart</span>
                  <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">
                    Ctrl + Shift + C
                  </kbd>
                </div>
                <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                  <span className="text-sm">Checkout</span>
                  <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">
                    Ctrl + Enter
                  </kbd>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2 text-sm text-muted-foreground">
                Tools
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                  <span className="text-sm">Open barcode scanner</span>
                  <div className="flex gap-1">
                    <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">
                      F8
                    </kbd>
                    <span className="text-xs text-muted-foreground">or</span>
                    <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">
                      Ctrl+B
                    </kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                  <span className="text-sm">Add customer (Utang)</span>
                  <div className="flex gap-1">
                    <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">
                      F9
                    </kbd>
                    <span className="text-xs text-muted-foreground">or</span>
                    <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">
                      Ctrl+U
                    </kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                  <span className="text-sm">Recent sales history</span>
                  <div className="flex gap-1">
                    <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">
                      F10
                    </kbd>
                    <span className="text-xs text-muted-foreground">or</span>
                    <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">
                      Ctrl+H
                    </kbd>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2 text-sm text-muted-foreground">
                Help
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                  <span className="text-sm">Toggle this help</span>
                  <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">
                    Ctrl + /
                  </kbd>
                </div>
                <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                  <span className="text-sm">Toggle this help (alt)</span>
                  <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">
                    ?
                  </kbd>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default POS;
