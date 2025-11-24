// /src/pages/Inventory.tsx
import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  useProducts,
  useLowStockProducts,
  useDeleteProduct,
  useAllProducts,
} from "@/hooks/api";
import { useProductApi } from "@/hooks/useProductApi";
import { Product } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  AlertTriangle,
  Package,
  Loader2,
  RefreshCw,
  Barcode,
  Tag,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  BadgeRussianRuble,
  Download,
  ExternalLink,
  Camera,
  Check,
  Upload,
  List,
  Grid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ProductForm from "@/components/inventory/ProductForm";
import BulkImportDialog from "@/components/inventory/BulkImportDialog";
import ScannerDialog from "@/components/pos/ScannerDialog";

// View mode type
type ViewMode = "list" | "card";

const Inventory: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [showQuickAddOptions, setShowQuickAddOptions] = useState(false);
  const [prefillData, setPrefillData] = useState<Partial<Product> | null>(null);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  // View mode state with localStorage persistence
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("inventory-view-mode");
      if (saved === "list" || saved === "card") {
        return saved as ViewMode;
      }
      // Default to card view on mobile, list on desktop
      return window.innerWidth < 768 ? "card" : "list";
    }
    return "list";
  });

  // Save view mode to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("inventory-view-mode", viewMode);
  }, [viewMode]);

  // State for search functionality
  const [searchMode, setSearchMode] = useState(false);
  const [searchTrigger, setSearchTrigger] = useState(0);

  // Barcode API hook
  const {
    productData: barcodeProductData,
    loading: barcodeLoading,
    error: barcodeError,
    fetchProduct: fetchBarcodeProduct,
    clearProduct: clearBarcodeProduct,
  } = useProductApi();

  // Fetch paginated products
  const {
    data: productsResponse,
    isLoading,
    error: productsError,
    refetch: refetchProducts,
  } = useProducts(currentPage, pageSize);

  // Fetch all products for search (only when triggered)
  const {
    data: allProducts = [],
    refetch: fetchAllProducts,
    isLoading: isFetchingAll,
    isFetching: isFetchingAllProducts,
  } = useAllProducts();

  useEffect(() => {
    fetchAllProducts();
  }, [fetchAllProducts]);

  const { data: lowStockProducts } = useLowStockProducts();
  const deleteProduct = useDeleteProduct();

  // Determine data source based on mode
  const productsDataSource = useMemo(() => {
    if (searchMode && searchQuery) {
      return allProducts;
    }

    if (categoryFilter !== "all" || stockFilter !== "all") {
      return allProducts;
    }

    if (
      productsResponse &&
      typeof productsResponse === "object" &&
      "results" in productsResponse
    ) {
      return productsResponse.results;
    }

    return Array.isArray(productsResponse) ? productsResponse : [];
  }, [
    searchMode,
    searchQuery,
    allProducts,
    productsResponse,
    categoryFilter,
    stockFilter,
  ]);

  // Safe data handling
  const productsArray: Product[] = Array.isArray(productsDataSource)
    ? productsDataSource
    : [];

  // Filter products based on search and filters
  const filteredProducts = useMemo(() => {
    return productsArray.filter((product) => {
      const matchesSearch =
        !searchQuery ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.barcode?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        categoryFilter === "all" || product.category === categoryFilter;

      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "low" && product.needs_restock) ||
        (stockFilter === "out" && product.stock_quantity === 0) ||
        (stockFilter === "in" &&
          product.stock_quantity > 0 &&
          !product.needs_restock);

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [productsArray, searchQuery, categoryFilter, stockFilter]);

  // Extract pagination info
  const paginationInfo = useMemo(() => {
    const isFiltering =
      categoryFilter !== "all" ||
      stockFilter !== "all" ||
      (searchMode && searchQuery);

    if (isFiltering) {
      const filteredCount = filteredProducts.length;
      return {
        count: filteredCount,
        next: null,
        previous: null,
        totalPages: Math.ceil(filteredCount / pageSize),
      };
    }

    if (
      productsResponse &&
      typeof productsResponse === "object" &&
      "count" in productsResponse
    ) {
      return {
        count: productsResponse.count,
        next: productsResponse.next,
        previous: productsResponse.previous,
        totalPages: Math.ceil(productsResponse.count / pageSize),
      };
    }

    const count = Array.isArray(productsResponse)
      ? productsResponse.length
      : productsDataSource.length;
    return {
      count,
      next: null,
      previous: null,
      totalPages: Math.ceil(count / pageSize),
    };
  }, [
    productsResponse,
    productsDataSource,
    pageSize,
    categoryFilter,
    stockFilter,
    searchMode,
    searchQuery,
    filteredProducts.length,
  ]);

  // Paginate filtered products client-side when filters are active
  const isFiltering =
    categoryFilter !== "all" ||
    stockFilter !== "all" ||
    (searchMode && searchQuery);
  const displayedProducts = useMemo(() => {
    if (isFiltering) {
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      return filteredProducts.slice(startIndex, endIndex);
    }
    return filteredProducts;
  }, [filteredProducts, currentPage, pageSize, isFiltering]);

  const lowStockArray: Product[] = Array.isArray(lowStockProducts)
    ? lowStockProducts
    : [];

  // Get unique categories safely
  const categories = [
    ...new Set(
      allProducts
        .map((p) => p.category)
        .filter((category): category is string => Boolean(category))
    ),
  ];

  // Handle search with debouncing
  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSearchMode(false);
      clearBarcodeProduct();
      return;
    }

    if (searchQuery.trim().length > 2) {
      const timer = setTimeout(() => {
        setSearchMode(true);
        fetchAllProducts();

        if (isBarcodeSearch && filteredProducts.length === 0) {
          handleBarcodeLookup();
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [searchQuery, searchTrigger]);

  // Check if search query looks like a barcode (numeric)
  const isBarcodeSearch = useMemo(() => {
    return /^\d+$/.test(searchQuery.trim());
  }, [searchQuery]);

  // Check if we should show quick add options
  const shouldShowQuickAdd = useMemo(() => {
    return (
      searchQuery.trim().length > 0 &&
      filteredProducts.length === 0 &&
      !isFetchingAll
    );
  }, [searchQuery, filteredProducts.length, isFetchingAll]);

  // Check if we have barcode data available
  const hasBarcodeData = useMemo(() => {
    return !barcodeLoading && !barcodeError && barcodeProductData !== null;
  }, [barcodeLoading, barcodeError, barcodeProductData]);

  // Handle barcode scan from scanner
  const handleBarcodeScan = useCallback(
    (barcode: string) => {
      console.log("Scanned barcode:", barcode);
      setSearchQuery(barcode);
      setSearchMode(true);
      setSearchTrigger((prev) => prev + 1);
      setShowQuickAddOptions(true);

      fetchBarcodeProduct(barcode).catch((error) => {
        console.log("Barcode API lookup failed:", error);
      });

      toast.success(`Scanned: ${barcode}`);
    },
    [fetchBarcodeProduct]
  );

  // Handle barcode lookup
  const handleBarcodeLookup = async () => {
    if (!isBarcodeSearch) return;

    try {
      await fetchBarcodeProduct(searchQuery);
    } catch (error) {
      console.log("Barcode lookup failed:", error);
    }
  };

  // Count out of stock products safely
  const outOfStockCount = productsArray.filter(
    (p) => p.stock_quantity === 0
  ).length;

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setPrefillData(null);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!productToDelete) return;

    try {
      await deleteProduct.mutateAsync(productToDelete.id);
      toast.success("Product deleted successfully");
      setProductToDelete(null);
      refetchProducts();
    } catch (error) {
      toast.error("Failed to delete product");
    }
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setPrefillData(null);
    setIsFormOpen(true);
  };

  const handleQuickAdd = (useBarcodeData: boolean = false) => {
    let newPrefillData: Partial<Product> = {
      name: searchQuery,
      barcode: isBarcodeSearch ? searchQuery : "",
      price: 0,
      cost_price: 0,
      stock_quantity: 0,
      min_stock_level: 5,
      is_active: true,
    };

    if (useBarcodeData && hasBarcodeData && barcodeProductData) {
      const productInfo = barcodeProductData.product;
      newPrefillData = {
        ...newPrefillData,
        name: productInfo.product_name || searchQuery,
        category: productInfo.product_type || undefined,
        image: productInfo.image_front_small_url || undefined,
      };
    }

    setPrefillData(newPrefillData);
    setEditingProduct(null);
    setIsFormOpen(true);
    setSearchQuery("");
    setShowQuickAddOptions(false);
    setSearchMode(false);
    clearBarcodeProduct();
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingProduct(null);
    setPrefillData(null);
    refetchProducts();
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (value.trim().length > 0) {
      setShowQuickAddOptions(true);
      setSearchTrigger((prev) => prev + 1);
    } else {
      setShowQuickAddOptions(false);
      setSearchMode(false);
      clearBarcodeProduct();
    }
  };

  const handleSearchBlur = () => {
    setTimeout(() => setShowQuickAddOptions(false), 200);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    setSearchMode(false);
    setSearchQuery("");
    clearBarcodeProduct();
  };

  // Clear search mode and reset to page 1 when filters change
  useEffect(() => {
    setSearchMode(false);
    clearBarcodeProduct();
    setCurrentPage(1);
  }, [categoryFilter, stockFilter]);

  // Product Card Component
  const ProductCard = ({ product }: { product: Product }) => (
    <div className="border rounded-lg p-3 hover:shadow-md transition-shadow bg-white h-full flex flex-col">
      {/* Product Image and Basic Info */}
      <div className="flex items-start gap-2 mb-2">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="h-10 w-10 md:h-12 md:w-12 object-cover rounded shrink-0"
          />
        ) : (
          <div className="h-10 w-10 md:h-12 md:w-12 bg-gray-200 rounded flex items-center justify-center shrink-0">
            <Package className="h-5 w-5 md:h-6 md:w-6 text-gray-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-xs md:text-sm leading-tight line-clamp-2">
            {product.name}
          </h3>
          {product.barcode && (
            <div className="text-[10px] md:text-xs text-gray-500 mt-1 truncate">
              📊 {product.barcode}
            </div>
          )}
          {product.category && (
            <div className="text-[10px] md:text-xs text-gray-500 truncate">
              {product.category}
            </div>
          )}
        </div>
      </div>

      {/* Price and Stock */}
      <div className="flex flex-col justify-start items-center mb-2">
        <div className="font-semibold text-green-600 text-xs md:text-sm">
          {formatCurrency(product.price == null ? 0 : product.price)}
        </div>
        <div className="text-xs md:text-sm text-gray-600">
          Stock: <span className="font-medium">{product.stock_quantity}</span>
        </div>
      </div>

      {/* Status Badge */}
      <div className="mb-2">
        {product.stock_quantity === 0 ? (
          <Badge
            variant="destructive"
            className="w-full justify-center text-[10px] md:text-xs py-0.5"
          >
            Out of Stock
          </Badge>
        ) : product.needs_restock ? (
          <Badge
            variant="secondary"
            className="w-full justify-center text-[10px] md:text-xs py-0.5"
          >
            Low Stock
          </Badge>
        ) : (
          <Badge
            variant="default"
            className="w-full justify-center text-[10px] md:text-xs py-0.5"
          >
            In Stock
          </Badge>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mt-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleEdit(product)}
          className="h-7 md:h-8 px-2 text-[10px] md:text-xs flex-1"
        >
          <Edit className="h-3 w-3 mr-1" />
          <span className="hidden sm:inline">Edit</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setProductToDelete(product)}
          className="h-7 md:h-8 px-2 text-red-600 hover:text-red-700 flex-1"
        >
          <Trash2 className="h-3 w-3" />
          <span className="hidden sm:inline ml-1">Delete</span>
        </Button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (productsError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <p className="text-red-600">Failed to load products</p>
        <Button onClick={() => refetchProducts()} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Inventory
          </h1>
          <p className="text-sm md:text-base text-gray-600 mt-1 md:mt-2">
            Manage your products and stock levels
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => setIsBulkImportOpen(true)}
            className="flex-1 sm:flex-none whitespace-nowrap text-sm"
            size="sm"
          >
            <Upload className="h-4 w-4 mr-2" />
            Bulk Import
          </Button>
          <Button
            onClick={handleAddProduct}
            className="flex-1 sm:flex-none whitespace-nowrap text-sm"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-3 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 truncate">
                  Total Products
                </p>
                <p className="text-lg md:text-2xl font-bold text-gray-900 mt-1">
                  {paginationInfo.count}
                </p>
              </div>
              <div className="p-2 md:p-3 bg-blue-100 rounded-full self-start">
                <Package className="h-4 w-4 md:h-6 md:w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 truncate">
                  Low Stock
                </p>
                <p className="text-lg md:text-2xl font-bold text-gray-900 mt-1">
                  {lowStockArray.length}
                </p>
              </div>
              <div className="p-2 md:p-3 bg-orange-100 rounded-full self-start">
                <AlertTriangle className="h-4 w-4 md:h-6 md:w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 truncate">
                  Out of Stock
                </p>
                <p className="text-lg md:text-2xl font-bold text-gray-900 mt-1">
                  {outOfStockCount}
                </p>
              </div>
              <div className="p-2 md:p-3 bg-red-100 rounded-full self-start">
                <AlertTriangle className="h-4 w-4 md:h-6 md:w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 truncate">
                  Categories
                </p>
                <p className="text-lg md:text-2xl font-bold text-gray-900 mt-1">
                  {categories.length}
                </p>
              </div>
              <div className="p-2 md:p-3 bg-green-100 rounded-full self-start">
                <Package className="h-4 w-4 md:h-6 md:w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 truncate">
                  Worth
                </p>
                <p className="text-lg md:text-2xl font-bold text-gray-900 mt-1 truncate">
                  ₱{" "}
                  {allProducts
                    .map(
                      (p) => (p.price == null ? 0 : p.price) * p.stock_quantity
                    )
                    .reduce((a, b) => a + b, 0)
                    .toLocaleString()}
                </p>
                <p className="text-[10px] md:text-xs text-gray-500 mt-1 truncate">
                  Based on {allProducts.length} products
                </p>
              </div>
              <div className="p-2 md:p-3 bg-green-100 rounded-full self-start">
                <BadgeRussianRuble className="h-4 w-4 md:h-6 md:w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-col gap-3 md:gap-4">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onBlur={handleSearchBlur}
                  className="pl-10 text-sm h-10 md:h-9"
                />

                {/* Search status indicators */}
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                  {barcodeLoading && (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  )}

                  {hasBarcodeData && (
                    <Badge
                      variant="default"
                      className="text-xs bg-green-100 text-green-800"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      <Check />
                    </Badge>
                  )}

                  {isFetchingAllProducts && (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  )}

                  {searchMode && !isFetchingAllProducts && (
                    <Badge variant="secondary" className="text-xs">
                      <Search />
                    </Badge>
                  )}
                </div>

                {/* Quick Add Dropdown */}
                {showQuickAddOptions && shouldShowQuickAdd && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                    <div className="p-2">
                      <div className="text-[10px] md:text-xs font-medium text-gray-500 px-2 py-1">
                        Quick Add Options
                      </div>

                      {hasBarcodeData && barcodeProductData && (
                        <button
                          onClick={() => handleQuickAdd(true)}
                          className="flex items-center gap-2 w-full p-2 md:p-3 text-left hover:bg-green-50 rounded-md cursor-pointer transition-colors border border-green-200 mb-2 touch-manipulation"
                          onTouchStart={(e) =>
                            e.currentTarget.classList.add("bg-green-100")
                          }
                          onTouchEnd={(e) =>
                            e.currentTarget.classList.remove("bg-green-100")
                          }
                        >
                          <Download className="h-3 w-3 md:h-4 md:w-4 text-green-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-xs md:text-sm truncate">
                              Use product data from barcode
                            </div>
                            <div className="text-[10px] md:text-xs text-gray-500 truncate">
                              Name: {barcodeProductData.product.product_name}
                            </div>
                            <div className="text-[10px] md:text-xs text-gray-500">
                              Quantity:{" "}
                              {barcodeProductData.product.product_quantity}
                              {barcodeProductData.product.product_quantity_unit}
                            </div>
                          </div>
                          <ExternalLink className="h-3 w-3 text-green-600 shrink-0" />
                        </button>
                      )}

                      <button
                        onClick={() => handleQuickAdd(false)}
                        className="flex items-center gap-2 w-full p-2 md:p-3 text-left hover:bg-gray-100 rounded-md cursor-pointer transition-colors touch-manipulation"
                        onTouchStart={(e) =>
                          e.currentTarget.classList.add("bg-gray-200")
                        }
                        onTouchEnd={(e) =>
                          e.currentTarget.classList.remove("bg-gray-200")
                        }
                      >
                        <Tag className="h-3 w-3 md:h-4 md:w-4 text-blue-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-xs md:text-sm truncate">
                            {isBarcodeSearch
                              ? `Create product with name`
                              : `Create product "${searchQuery}"`}
                          </div>
                          <div className="text-[10px] md:text-xs text-gray-500 truncate">
                            {isBarcodeSearch
                              ? `Name: ${searchQuery}`
                              : "Pre-fills product name"}
                          </div>
                        </div>
                      </button>

                      {isBarcodeSearch && (
                        <button
                          onClick={() => handleQuickAdd(false)}
                          className="flex items-center gap-2 w-full p-2 md:p-3 text-left hover:bg-gray-100 rounded-md cursor-pointer transition-colors touch-manipulation"
                          onTouchStart={(e) =>
                            e.currentTarget.classList.add("bg-gray-200")
                          }
                          onTouchEnd={(e) =>
                            e.currentTarget.classList.remove("bg-gray-200")
                          }
                        >
                          <Barcode className="h-3 w-3 md:h-4 md:w-4 text-green-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-xs md:text-sm truncate">
                              Create product with barcode
                            </div>
                            <div className="text-[10px] md:text-xs text-gray-500 truncate">
                              Sets barcode: {searchQuery}
                            </div>
                          </div>
                        </button>
                      )}

                      {isBarcodeSearch &&
                        !hasBarcodeData &&
                        !barcodeLoading && (
                          <button
                            onClick={handleBarcodeLookup}
                            className="flex items-center gap-2 w-full p-2 md:p-3 text-left hover:bg-blue-50 rounded-md cursor-pointer transition-colors border border-blue-200 touch-manipulation"
                            onTouchStart={(e) =>
                              e.currentTarget.classList.add("bg-blue-100")
                            }
                            onTouchEnd={(e) =>
                              e.currentTarget.classList.remove("bg-blue-100")
                            }
                          >
                            <ExternalLink className="h-3 w-3 md:h-4 md:w-4 text-blue-600 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-xs md:text-sm truncate">
                                Look up product information
                              </div>
                              <div className="text-[10px] md:text-xs text-gray-500 truncate">
                                Fetch product details from barcode database
                              </div>
                            </div>
                          </button>
                        )}
                    </div>
                  </div>
                )}
              </div>

              {/* Scanner Dialog */}
              <ScannerDialog
                onScan={handleBarcodeScan}
                autoCloseAfterScan={true}
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="whitespace-nowrap h-10 md:h-9 px-3"
                  >
                    <Camera className="h-4 w-4 mr-0 md:mr-2" />
                    <span className="hidden sm:inline">Scan</span>
                  </Button>
                }
              />
            </div>

            {/* View Mode Toggle & Filters Row */}
            <div className="flex flex-wrap items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="h-9 px-3 rounded-r-none border-0"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "card" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("card")}
                  className="h-9 px-3 rounded-l-none border-0"
                >
                  <Grid className="h-4 w-4" />
                </Button>
              </div>

              {/* Category Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs md:text-sm"
                  >
                    <Filter className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                    <span className="hidden sm:inline">Category: </span>
                    <span className="truncate max-w-[60px] sm:max-w-none">
                      {categoryFilter === "all" ? "All" : categoryFilter}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setCategoryFilter("all")}>
                    All Categories
                  </DropdownMenuItem>
                  {categories.map((category) => (
                    <DropdownMenuItem
                      key={category}
                      onClick={() => setCategoryFilter(category)}
                    >
                      {category}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Stock Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs md:text-sm"
                  >
                    <Filter className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                    <span className="hidden sm:inline">Stock: </span>
                    <span className="truncate max-w-[60px] sm:max-w-none">
                      {stockFilter === "all"
                        ? "All"
                        : stockFilter === "low"
                          ? "Low"
                          : stockFilter === "out"
                            ? "Out"
                            : "In"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setStockFilter("all")}>
                    All Stock
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStockFilter("in")}>
                    In Stock
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStockFilter("low")}>
                    Low Stock
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStockFilter("out")}>
                    Out of Stock
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Barcode API Status */}
          {barcodeError && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center gap-2 text-red-700 text-xs md:text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  Barcode lookup failed: {barcodeError}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Products Display */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 md:p-6">
          <CardTitle className="text-base md:text-lg">
            Products (
            {searchMode ? filteredProducts.length : paginationInfo.count})
            {searchQuery && (
              <span className="text-xs md:text-sm font-normal text-gray-500 ml-2 block sm:inline mt-1 sm:mt-0">
                for "{searchQuery}"{searchMode && " (searching all products)"}
              </span>
            )}
          </CardTitle>

          {/* Pagination Controls */}
          {paginationInfo.totalPages > 1 && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="text-xs md:text-sm text-gray-600">
                Page {currentPage} of {paginationInfo.totalPages}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronsLeft className="h-3 w-3 md:h-4 md:w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-3 w-3 md:h-4 md:w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === paginationInfo.totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-3 w-3 md:h-4 md:w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(paginationInfo.totalPages)}
                  disabled={currentPage === paginationInfo.totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronsRight className="h-3 w-3 md:h-4 md:w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          {displayedProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              {searchQuery ? (
                <>
                  <p>No products found for "{searchQuery}"</p>
                  <p className="text-sm mt-2">
                    Try a different search or{" "}
                    <Button
                      variant="link"
                      className="p-0 h-auto"
                      onClick={() => handleQuickAdd(false)}
                    >
                      add it as a new product
                    </Button>
                  </p>
                </>
              ) : (
                <>
                  <p>No products found</p>
                  <p className="text-sm">
                    Try adjusting your search or filters
                  </p>
                </>
              )}
            </div>
          ) : viewMode === "list" ? (
            // List View
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm">
                      Product
                    </th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm">
                      Category
                    </th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm">
                      Price
                    </th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm">
                      Cost
                    </th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm">
                      Stock
                    </th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm">
                      Status
                    </th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayedProducts.map((product) => (
                    <tr key={product.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 md:py-3 px-2 md:px-4">
                        <div className="flex items-center gap-2">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="h-8 w-8 md:h-10 md:w-10 object-cover rounded shrink-0"
                            />
                          ) : (
                            <div className="h-8 w-8 md:h-10 md:w-10 bg-gray-200 rounded flex items-center justify-center shrink-0">
                              <Package className="h-4 w-4 md:h-5 md:w-5 text-gray-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-xs md:text-sm truncate">
                              {product.name}
                            </div>
                            {product.barcode && (
                              <div className="text-[10px] md:text-xs text-gray-500 truncate">
                                📊 {product.barcode}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm">
                        {product.category || "-"}
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-4 font-semibold text-green-600 text-xs md:text-sm">
                        {formatCurrency(
                          product.price == null ? 0 : product.price
                        )}
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-4 text-gray-600 text-xs md:text-sm">
                        {formatCurrency(
                          product.cost_price == null ? 0 : product.cost_price
                        )}
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-4">
                        <div className="flex items-center gap-1 md:gap-2">
                          <span className="text-xs md:text-sm">
                            {product.stock_quantity}
                          </span>
                          {product.needs_restock && (
                            <Badge
                              variant="outline"
                              className="text-[10px] md:text-xs"
                            >
                              Min: {product.min_stock_level}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-4">
                        {product.stock_quantity === 0 ? (
                          <Badge
                            variant="destructive"
                            className="text-[10px] md:text-xs"
                          >
                            Out of Stock
                          </Badge>
                        ) : product.needs_restock ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] md:text-xs"
                          >
                            Low Stock
                          </Badge>
                        ) : (
                          <Badge
                            variant="default"
                            className="text-[10px] md:text-xs"
                          >
                            In Stock
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-4">
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(product)}
                            className="h-7 w-7 md:h-8 md:w-8 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setProductToDelete(product)}
                            className="text-red-600 hover:text-red-700 h-7 w-7 md:h-8 md:w-8 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            // Card View
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 md:gap-4">
              {displayedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scanner Dialog */}
      <ScannerDialog onScan={handleBarcodeScan} autoCloseAfterScan={true} />

      {/* Product Form Dialog */}
      <ProductForm
        open={isFormOpen}
        onOpenChange={handleFormClose}
        product={editingProduct}
        prefillData={prefillData}
        categories={categories}
      />

      {/* Bulk Import Dialog */}
      <BulkImportDialog
        open={isBulkImportOpen}
        onOpenChange={setIsBulkImportOpen}
        onImportComplete={() => {
          refetchProducts();
          fetchAllProducts();
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!productToDelete}
        onOpenChange={() => setProductToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{productToDelete?.name}". This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Inventory;
