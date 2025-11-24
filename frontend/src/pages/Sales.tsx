// src/pages/Sales.tsx
import React, { useState } from "react";
import { useSales } from "@/hooks/api";
import { Sale } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Calendar,
  Filter,
  Download,
  Eye,
  Loader2,
  Search,
  CreditCard,
  Wallet,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const Sales: React.FC = () => {
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all"); // For Utang: all, paid, unpaid
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);

  const { data: sales, isLoading, error } = useSales(startDate, endDate);

  // Filter sales by multiple criteria
  const filteredSales =
    sales?.filter((sale) => {
      // Search filter
      const matchesSearch =
        !searchQuery ||
        sale.id.toString().includes(searchQuery) ||
        sale.customer_name?.toLowerCase().includes(searchQuery.toLowerCase());

      // Payment method filter
      const matchesPaymentMethod =
        paymentMethodFilter === "all" ||
        sale.payment_method === paymentMethodFilter;

      // Payment status filter (for Utang sales)
      let matchesPaymentStatus = true;
      if (paymentMethodFilter === "utang" || paymentStatusFilter !== "all") {
        if (paymentStatusFilter === "paid") {
          matchesPaymentStatus = sale.is_fully_paid === true;
        } else if (paymentStatusFilter === "unpaid") {
          matchesPaymentStatus = sale.is_fully_paid === false;
        } else if (paymentStatusFilter === "all") {
          matchesPaymentStatus = true;
        }
      }

      return matchesSearch && matchesPaymentMethod && matchesPaymentStatus;
    }) || [];

  // Calculate statistics
  const totalSales = filteredSales.reduce(
    (sum, sale) => sum + Number(sale.total_amount),
    0
  );
  const averageSale = filteredSales.length
    ? totalSales / filteredSales.length
    : 0;
  const totalTransactions = filteredSales.length;

  // Utang-specific statistics
  const utangSales = filteredSales.filter(
    (sale) => sale.payment_method === "utang"
  );
  const totalUtang = utangSales.reduce(
    (sum, sale) => sum + Number(sale.total_amount),
    0
  );
  const unpaidUtang = utangSales
    .filter((sale) => !sale.is_fully_paid)
    .reduce((sum, sale) => {
      const outstanding =
        Number(sale.total_amount) - (Number(sale.amount_paid) || 0);
      return sum + outstanding;
    }, 0);
  const paidUtang = utangSales.filter((sale) => sale.is_fully_paid).length;

  const handleViewDetails = (sale: Sale) => {
    setSelectedSale(sale);
    setIsDialogOpen(true);
  };

  const handleExport = () => {
    // In a real app, this would generate a CSV or PDF
    toast.info("Export functionality would be implemented here");
  };

  const handleDateFilter = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);

    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600 text-center">
          <p>Failed to load sales data</p>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Sales History
          </h1>
          <p className="text-sm md:text-base text-gray-600 mt-1 md:mt-2">
            View and manage your sales transactions
          </p>
        </div>
        <Button
          onClick={handleExport}
          variant="outline"
          size="sm"
          className="whitespace-nowrap w-full sm:w-auto"
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-3 md:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs md:text-sm font-medium text-gray-600 truncate">
                  Total Sales
                </p>
                <p className="text-lg md:text-2xl font-bold text-gray-900 mt-1 truncate">
                  {formatCurrency(totalSales)}
                </p>
              </div>
              <div className="p-2 md:p-3 bg-green-100 rounded-full shrink-0">
                <Calendar className="h-4 w-4 md:h-6 md:w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 md:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs md:text-sm font-medium text-gray-600 truncate">
                  Average Sale
                </p>
                <p className="text-lg md:text-2xl font-bold text-gray-900 mt-1 truncate">
                  {formatCurrency(averageSale)}
                </p>
              </div>
              <div className="p-2 md:p-3 bg-blue-100 rounded-full shrink-0">
                <Filter className="h-4 w-4 md:h-6 md:w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 md:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs md:text-sm font-medium text-gray-600 truncate">
                  Transactions
                </p>
                <p className="text-lg md:text-2xl font-bold text-gray-900 mt-1">
                  {totalTransactions}
                </p>
              </div>
              <div className="p-2 md:p-3 bg-purple-100 rounded-full shrink-0">
                <Eye className="h-4 w-4 md:h-6 md:w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={utangSales.length > 0 ? "border-amber-200" : ""}>
          <CardContent className="p-3 md:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs md:text-sm font-medium text-gray-600 truncate">
                  Utang Sales
                </p>
                <p className="text-lg md:text-2xl font-bold text-gray-900 mt-1">
                  {utangSales.length}
                </p>
                <p className="text-[10px] md:text-xs text-gray-500 mt-1 truncate">
                  {formatCurrency(totalUtang)}
                </p>
                {utangSales.length > 0 && (
                  <p className="text-[10px] md:text-xs text-gray-400 mt-1">
                    {paidUtang} paid, {utangSales.length - paidUtang} unpaid
                  </p>
                )}
              </div>
              <div className="p-2 md:p-3 bg-amber-100 rounded-full shrink-0">
                <CreditCard className="h-4 w-4 md:h-6 md:w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={unpaidUtang > 0 ? "border-red-200" : ""}>
          <CardContent className="p-3 md:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs md:text-sm font-medium text-gray-600 truncate">
                  Unpaid Utang
                </p>
                <p className="text-lg md:text-2xl font-bold text-red-600 mt-1 truncate">
                  {formatCurrency(unpaidUtang)}
                </p>
                <p className="text-[10px] md:text-xs text-gray-500 mt-1">
                  {utangSales.filter((s) => !s.is_fully_paid).length} unpaid
                </p>
              </div>
              <div className="p-2 md:p-3 bg-red-100 rounded-full shrink-0">
                <AlertCircle className="h-4 w-4 md:h-6 md:w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-col gap-3 md:gap-4">
            {/* First Row: Search and Date Filters */}
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by sale ID or customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 md:h-9 text-sm"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 sm:w-32 h-10 md:h-9 text-sm"
                />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1 sm:w-32 h-10 md:h-9 text-sm"
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-10 md:h-9">
                      <Calendar className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Quick Date</span>
                      <span className="sm:hidden">Date</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleDateFilter(1)}>
                      Today
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDateFilter(7)}>
                      Last 7 Days
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDateFilter(30)}>
                      Last 30 Days
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setStartDate("");
                        setEndDate("");
                      }}
                    >
                      All Time
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Second Row: Payment Method and Status Filters */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-xs md:text-sm font-medium text-gray-700">
                  Payment:
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={
                    paymentMethodFilter === "all" ? "default" : "outline"
                  }
                  size="sm"
                  className="h-8 px-2 text-xs md:text-sm"
                  onClick={() => {
                    setPaymentMethodFilter("all");
                    setPaymentStatusFilter("all");
                  }}
                >
                  All
                </Button>
                <Button
                  variant={
                    paymentMethodFilter === "cash" ? "default" : "outline"
                  }
                  size="sm"
                  className="h-8 px-2 text-xs md:text-sm"
                  onClick={() => {
                    setPaymentMethodFilter("cash");
                    setPaymentStatusFilter("all");
                  }}
                >
                  <Wallet className="h-3 w-3 mr-1" />
                  Cash
                </Button>
                <Button
                  variant={
                    paymentMethodFilter === "card" ? "default" : "outline"
                  }
                  size="sm"
                  className="h-8 px-2 text-xs md:text-sm"
                  onClick={() => {
                    setPaymentMethodFilter("card");
                    setPaymentStatusFilter("all");
                  }}
                >
                  <CreditCard className="h-3 w-3 mr-1" />
                  Card
                </Button>
                <Button
                  variant={
                    paymentMethodFilter === "mobile" ? "default" : "outline"
                  }
                  size="sm"
                  className="h-8 px-2 text-xs md:text-sm"
                  onClick={() => {
                    setPaymentMethodFilter("mobile");
                    setPaymentStatusFilter("all");
                  }}
                >
                  <Wallet className="h-3 w-3 mr-1" />
                  <span className="hidden sm:inline">Mobile</span>
                  <span className="sm:hidden">Mob</span>
                </Button>
                <Button
                  variant={
                    paymentMethodFilter === "utang" ? "default" : "outline"
                  }
                  size="sm"
                  className={
                    paymentMethodFilter === "utang"
                      ? "bg-amber-600 hover:bg-amber-700 h-8 px-2 text-xs md:text-sm"
                      : "h-8 px-2 text-xs md:text-sm"
                  }
                  onClick={() => {
                    setPaymentMethodFilter("utang");
                    setPaymentStatusFilter("all");
                  }}
                >
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Utang
                </Button>
              </div>

              {/* Payment Status Filter (only show for Utang) */}
              {(paymentMethodFilter === "utang" ||
                paymentStatusFilter !== "all") && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:ml-4 sm:pl-4 sm:border-l">
                  <span className="text-xs md:text-sm font-medium text-gray-700">
                    Status:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={
                        paymentStatusFilter === "all" ? "default" : "outline"
                      }
                      size="sm"
                      className="h-8 px-2 text-xs md:text-sm"
                      onClick={() => setPaymentStatusFilter("all")}
                    >
                      All
                    </Button>
                    <Button
                      variant={
                        paymentStatusFilter === "paid" ? "default" : "outline"
                      }
                      size="sm"
                      className={
                        paymentStatusFilter === "paid"
                          ? "bg-green-600 hover:bg-green-700 h-8 px-2 text-xs md:text-sm"
                          : "h-8 px-2 text-xs md:text-sm"
                      }
                      onClick={() => setPaymentStatusFilter("paid")}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Paid
                    </Button>
                    <Button
                      variant={
                        paymentStatusFilter === "unpaid" ? "default" : "outline"
                      }
                      size="sm"
                      className={
                        paymentStatusFilter === "unpaid"
                          ? "bg-red-600 hover:bg-red-700 h-8 px-2 text-xs md:text-sm"
                          : "h-8 px-2 text-xs md:text-sm"
                      }
                      onClick={() => setPaymentStatusFilter("unpaid")}
                    >
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Unpaid
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales Table */}
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-base md:text-lg">
            Sales Transactions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-6">
          {filteredSales.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm md:text-base">No sales found</p>
              <p className="text-xs md:text-sm">
                Try adjusting your filters or search
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm">
                      Sale ID
                    </th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm">
                      Customer
                    </th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm">
                      Date
                    </th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm">
                      Payment
                    </th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm">
                      Amount
                    </th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 md:py-3 px-2 md:px-4 font-medium text-xs md:text-sm">
                        #{sale.id}
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm truncate max-w-[100px] md:max-w-none">
                        {sale.customer_name || "Walk-in"}
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm whitespace-nowrap">
                        {formatDate(sale.date_created)}
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-4">
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant={
                              sale.payment_method === "utang"
                                ? "destructive"
                                : "outline"
                            }
                            className="capitalize w-fit text-[10px] md:text-xs"
                          >
                            {sale.payment_method === "utang" ? (
                              <>
                                <AlertCircle className="h-2 w-2 md:h-3 md:w-3 mr-1" />
                                Utang
                              </>
                            ) : (
                              sale.payment_method
                            )}
                          </Badge>
                          {sale.payment_method === "utang" && (
                            <div className="text-[10px] md:text-xs text-gray-500">
                              {sale.is_fully_paid ? (
                                <span className="text-green-600 flex items-center gap-1">
                                  <CheckCircle2 className="h-2 w-2 md:h-3 md:w-3" />
                                  Paid
                                </span>
                              ) : (
                                <span className="text-red-600 flex items-center gap-1">
                                  <AlertCircle className="h-2 w-2 md:h-3 md:w-3" />
                                  <span className="hidden md:inline">
                                    Unpaid:{" "}
                                  </span>
                                  {formatCurrency(
                                    Number(sale.total_amount) -
                                      (Number(sale.amount_paid) || 0)
                                  )}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-green-600 text-xs md:text-sm">
                            {formatCurrency(sale.total_amount)}
                          </span>
                          {sale.payment_method === "utang" &&
                            !sale.is_fully_paid && (
                              <span className="text-[10px] md:text-xs text-gray-500">
                                Paid: {formatCurrency(sale.amount_paid || 0)}
                              </span>
                            )}
                        </div>
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 md:h-8 px-2 text-xs"
                          onClick={() => handleViewDetails(sale)}
                        >
                          <Eye className="h-3 w-3 md:mr-1" />
                          <span className="hidden md:inline">Details</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sale Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">
              Sale Details #{selectedSale?.id}
            </DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Customer</p>
                  <p>{selectedSale.customer_name || "Walk-in Customer"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Date</p>
                  <p>{formatDate(selectedSale.date_created)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Payment Method
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        selectedSale.payment_method === "utang"
                          ? "destructive"
                          : "outline"
                      }
                      className="capitalize"
                    >
                      {selectedSale.payment_method === "utang" ? (
                        <>
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Utang
                        </>
                      ) : (
                        selectedSale.payment_method
                      )}
                    </Badge>
                    {selectedSale.payment_method === "utang" && (
                      <Badge
                        variant={
                          selectedSale.is_fully_paid ? "default" : "destructive"
                        }
                        className="text-xs"
                      >
                        {selectedSale.is_fully_paid ? "Paid" : "Unpaid"}
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Total Amount
                  </p>
                  <p className="font-semibold text-green-600">
                    {formatCurrency(selectedSale.total_amount)}
                  </p>
                  {selectedSale.payment_method === "utang" && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-gray-500">
                        Amount Paid:{" "}
                        {formatCurrency(selectedSale.amount_paid || 0)}
                      </p>
                      {!selectedSale.is_fully_paid && (
                        <p className="text-xs font-medium text-red-600">
                          Outstanding:{" "}
                          {formatCurrency(
                            Number(selectedSale.total_amount) -
                              (Number(selectedSale.amount_paid) || 0)
                          )}
                        </p>
                      )}
                      {selectedSale.due_date && (
                        <p className="text-xs text-gray-500">
                          Due Date: {formatDate(selectedSale.due_date)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">Items</p>
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full min-w-[400px]">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left py-2 px-2 md:px-4 text-xs md:text-sm">
                          Product
                        </th>
                        <th className="text-left py-2 px-2 md:px-4 text-xs md:text-sm">
                          Qty
                        </th>
                        <th className="text-left py-2 px-2 md:px-4 text-xs md:text-sm">
                          Price
                        </th>
                        <th className="text-left py-2 px-2 md:px-4 text-xs md:text-sm">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSale.items.map((item) => (
                        <tr key={item.id} className="border-b">
                          <td className="py-2 px-2 md:px-4 text-xs md:text-sm">
                            {item.product_name}
                          </td>
                          <td className="py-2 px-2 md:px-4 text-xs md:text-sm">
                            {item.quantity}
                          </td>
                          <td className="py-2 px-2 md:px-4 text-xs md:text-sm">
                            {formatCurrency(item.unit_price)}
                          </td>
                          <td className="py-2 px-2 md:px-4 font-medium text-xs md:text-sm">
                            {formatCurrency(item.total_price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment History - Show for Utang sales */}
              {selectedSale.payment_method === "utang" && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">
                    Payment History
                  </p>
                  {selectedSale.payments && selectedSale.payments.length > 0 ? (
                    <div className="border rounded-lg overflow-x-auto">
                      <table className="w-full min-w-[400px]">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="text-left py-2 px-2 md:px-4 text-xs md:text-sm">
                              Date
                            </th>
                            <th className="text-left py-2 px-2 md:px-4 text-xs md:text-sm">
                              Amount
                            </th>
                            <th className="text-left py-2 px-2 md:px-4 text-xs md:text-sm">
                              Method
                            </th>
                            <th className="text-left py-2 px-2 md:px-4 text-xs md:text-sm">
                              Notes
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSale.payments
                            .sort(
                              (a, b) =>
                                new Date(b.date_created).getTime() -
                                new Date(a.date_created).getTime()
                            )
                            .map((payment) => (
                              <tr key={payment.id} className="border-b">
                                <td className="py-2 px-2 md:px-4 text-xs md:text-sm whitespace-nowrap">
                                  {formatDate(payment.date_created)}
                                </td>
                                <td className="py-2 px-2 md:px-4 font-medium text-green-600 text-xs md:text-sm">
                                  {formatCurrency(payment.amount)}
                                </td>
                                <td className="py-2 px-2 md:px-4">
                                  <Badge
                                    variant="outline"
                                    className="capitalize text-[10px] md:text-xs"
                                  >
                                    {payment.method}
                                  </Badge>
                                </td>
                                <td className="py-2 px-2 md:px-4 text-xs md:text-sm text-gray-500 truncate max-w-[100px]">
                                  {payment.notes || "-"}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-50 font-semibold">
                            <td
                              className="py-2 px-2 md:px-4 text-xs md:text-sm"
                              colSpan={3}
                            >
                              Total Paid:
                            </td>
                            <td className="py-2 px-2 md:px-4 text-green-600 text-xs md:text-sm">
                              {formatCurrency(
                                selectedSale.payments.reduce(
                                  (sum, p) => sum + Number(p.amount),
                                  0
                                )
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="border rounded-lg p-4 text-center text-gray-500 text-xs md:text-sm">
                      No payments recorded yet
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Sales;
