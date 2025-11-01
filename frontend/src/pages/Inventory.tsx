import React, { useState, useMemo, useEffect } from "react";
import {
  useProducts,
  useLowStockProducts,
  useDeleteProduct,
  useAllProducts,
} from "@/hooks/api";
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
  
  // State for search functionality
  const [searchMode, setSearchMode] = useState(false);
  const [searchTrigger, setSearchTrigger] = useState(0);

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

  const { data: lowStockProducts } = useLowStockProducts();
  const deleteProduct = useDeleteProduct();

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
  const paginationInfo = useMemo(() => {
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
  const lowStockArray: Product[] = Array.isArray(lowStockProducts) ? lowStockProducts : [];

  // Get unique categories safely
  const categories = [
    ...new Set(
      productsArray
        .map((p) => p.category)
        .filter((category): category is string => Boolean(category))
    ),
  ];

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

  // Handle search with debouncing
  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSearchMode(false);
      return;
    }

    // Only trigger search for queries longer than 2 characters
    if (searchQuery.trim().length > 2) {
      const timer = setTimeout(() => {
        setSearchMode(true);
        fetchAllProducts();
      }, 500); // 500ms debounce

      return () => clearTimeout(timer);
    }
  }, [searchQuery, searchTrigger]);

  // Check if search query looks like a barcode (numeric)
  const isBarcodeSearch = useMemo(() => {
    return /^\d+$/.test(searchQuery.trim());
  }, [searchQuery]);

  // Check if we should show quick add options
  const shouldShowQuickAdd = useMemo(() => {
    return searchQuery.trim().length > 0 && filteredProducts.length === 0 && !isFetchingAll;
  }, [searchQuery, filteredProducts.length, isFetchingAll]);

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

  const handleQuickAdd = (prefillBarcode: boolean = false) => {
    const newPrefillData: Partial<Product> = {
      name: prefillBarcode && isBarcodeSearch ? "" : searchQuery,
      barcode: prefillBarcode || isBarcodeSearch ? searchQuery : "",
      price: 0,
      cost_price: 0,
      stock_quantity: 0,
      min_stock_level: 5,
      is_active: true,
    };

    setPrefillData(newPrefillData);
    setEditingProduct(null);
    setIsFormOpen(true);
    setSearchQuery("");
    setShowQuickAddOptions(false);
    setSearchMode(false);
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
      setSearchTrigger(prev => prev + 1); // Trigger search
    } else {
      setShowQuickAddOptions(false);
      setSearchMode(false);
    }
  };

  const handleSearchBlur = () => {
    setTimeout(() => setShowQuickAddOptions(false), 200);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    setSearchMode(false);
    setSearchQuery("");
  };

  // Clear search mode when filters change
  useEffect(() => {
    setSearchMode(false);
  }, [categoryFilter, stockFilter]);

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-600 mt-2">
            Manage your products and stock levels
          </p>
        </div>
        <Button onClick={handleAddProduct} className="whitespace-nowrap">
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Products
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {paginationInfo.count}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Low Stock</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {lowStockArray.length}
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Out of Stock
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {outOfStockCount}
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Worth (to do)</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {categories.length}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Package className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Categories</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {categories.length}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Package className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search products by name or barcode..."
                value={searchQuery}
                onChange={handleSearchChange}
                onBlur={handleSearchBlur}
                className="pl-10"
              />
              
              {/* Search status indicator */}
              {isFetchingAllProducts && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                </div>
              )}
              
              {searchMode && !isFetchingAllProducts && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <Badge variant="secondary" className="text-xs">
                    Searching all products
                  </Badge>
                </div>
              )}
              
              {/* Quick Add Dropdown */}
              {showQuickAddOptions && shouldShowQuickAdd && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  <div className="p-2">
                    <div className="text-xs font-medium text-gray-500 px-2 py-1">
                      Quick Add Options
                    </div>
                    
                    <button
                      onClick={() => handleQuickAdd(false)}
                      className="flex items-center gap-2 w-full p-2 text-left hover:bg-gray-100 rounded-md cursor-pointer transition-colors"
                    >
                      <Tag className="h-4 w-4 text-blue-600" />
                      <div className="flex-1">
                        <div className="font-medium text-sm">
                          {isBarcodeSearch ? `Create product with name` : `Create product "${searchQuery}"`}
                        </div>
                        <div className="text-xs text-gray-500">
                          {isBarcodeSearch 
                            ? `Name: ${searchQuery}`
                            : "Pre-fills product name"
                          }
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleQuickAdd(true)}
                      className="flex items-center gap-2 w-full p-2 text-left hover:bg-gray-100 rounded-md cursor-pointer transition-colors"
                    >
                      <Barcode className="h-4 w-4 text-green-600" />
                      <div className="flex-1">
                        <div className="font-medium text-sm">
                          Create product with barcode
                        </div>
                        <div className="text-xs text-gray-500">
                          Sets barcode: {searchQuery}
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  Category: {categoryFilter === "all" ? "All" : categoryFilter}
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  Stock:{" "}
                  {stockFilter === "all"
                    ? "All"
                    : stockFilter === "low"
                      ? "Low Stock"
                      : stockFilter === "out"
                        ? "Out of Stock"
                        : "In Stock"}
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
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            Products ({searchMode ? filteredProducts.length : paginationInfo.count})
            {searchQuery && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                for "{searchQuery}"
                {searchMode && " (searching all products)"}
              </span>
            )}
          </CardTitle>
          
          {/* Pagination Controls - Only show when not searching */}
          {!searchMode && paginationInfo.totalPages > 1 && (
            <div className="flex items-center gap-2">
              <div className="text-sm text-gray-600">
                Page {currentPage} of {paginationInfo.totalPages}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === paginationInfo.totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(paginationInfo.totalPages)}
                  disabled={currentPage === paginationInfo.totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              {searchQuery ? (
                <>
                  <p>No products found for "{searchQuery}"</p>
                  <p className="text-sm mt-2">
                    Try a different search or{' '}
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
                  <p className="text-sm">Try adjusting your search or filters</p>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Product</th>
                    <th className="text-left py-3 px-4">Category</th>
                    <th className="text-left py-3 px-4">Price</th>
                    <th className="text-left py-3 px-4">Cost</th>
                    <th className="text-left py-3 px-4">Stock</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="h-10 w-10 object-cover rounded"
                            />
                          ) : (
                            <div className="h-10 w-10 bg-gray-200 rounded flex items-center justify-center">
                              <Package className="h-5 w-5 text-gray-400" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium">{product.name}</div>
                            {product.barcode && (
                              <div className="text-sm text-gray-500">
                                📊 {product.barcode}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">{product.category || "-"}</td>
                      <td className="py-3 px-4 font-semibold text-green-600">
                        {formatCurrency(product.price)}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {formatCurrency(product.cost_price)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span>{product.stock_quantity}</span>
                          {product.needs_restock && (
                            <Badge variant="outline" className="text-xs">
                              Min: {product.min_stock_level}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {product.stock_quantity === 0 ? (
                          <Badge variant="destructive">Out of Stock</Badge>
                        ) : product.needs_restock ? (
                          <Badge variant="secondary">Low Stock</Badge>
                        ) : (
                          <Badge variant="default">In Stock</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(product)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setProductToDelete(product)}
                            className="text-red-600 hover:text-red-700"
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
          )}
        </CardContent>
      </Card>

      {/* Product Form Dialog */}
      <ProductForm
        open={isFormOpen}
        onOpenChange={handleFormClose}
        product={editingProduct}
        prefillData={prefillData}
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