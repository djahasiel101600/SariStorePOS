// src/pages/Dashboard.tsx
import React from "react";
import { useDashboardStats } from "@/hooks/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  TrendingUp,
  AlertTriangle,
  ShoppingCart,
  Loader2,
  DollarSign,
  Users,
  Clock,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const Dashboard: React.FC = () => {
  const { data: stats, isLoading, error } = useDashboardStats();

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
          <AlertTriangle className="h-12 w-12 mx-auto mb-2" />
          <p>Failed to load dashboard data</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          Dashboard
        </h1>
        <p className="text-sm md:text-base text-gray-600 mt-1 md:mt-2">
          Overview of your store performance
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {/* Today's Sales */}
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 truncate">
                  Today's Sales
                </p>
                <p className="text-lg md:text-2xl font-bold text-gray-900 mt-1 truncate">
                  {formatCurrency(stats.sales.today.total)}
                </p>
                <div className="flex gap-2 mt-2 text-xs">
                  <span className="text-green-600">
                    Cash: {formatCurrency(stats.sales.today.cash)}
                  </span>
                  <span className="text-orange-600">
                    Credit: {formatCurrency(stats.sales.today.credit)}
                  </span>
                </div>
              </div>
              <div className="p-2 md:p-3 bg-green-100 rounded-full self-start">
                <TrendingUp className="h-4 w-4 md:h-6 md:w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Sales */}
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 truncate">
                  Monthly Sales
                </p>
                <p className="text-lg md:text-2xl font-bold text-gray-900 mt-1 truncate">
                  {formatCurrency(stats.sales.month.total)}
                </p>
                <div className="flex gap-2 mt-2 text-xs">
                  <span className="text-green-600">
                    Cash: {formatCurrency(stats.sales.month.cash)}
                  </span>
                  <span className="text-orange-600">
                    Credit: {formatCurrency(stats.sales.month.credit)}
                  </span>
                </div>
              </div>
              <div className="p-2 md:p-3 bg-blue-100 rounded-full self-start">
                <ShoppingCart className="h-4 w-4 md:h-6 md:w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profit Margin */}
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 truncate">
                  Profit Margin
                </p>
                <p className="text-lg md:text-2xl font-bold text-gray-900 mt-1">
                  {stats.profit.margin_percent}%
                </p>
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {formatCurrency(stats.profit.gross_profit)} profit
                </p>
              </div>
              <div className="p-2 md:p-3 bg-emerald-100 rounded-full self-start">
                <DollarSign className="h-4 w-4 md:h-6 md:w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 truncate">
                  Low Stock
                </p>
                <p className="text-lg md:text-2xl font-bold text-gray-900 mt-1">
                  {stats.inventory.low_stock}
                </p>
                {stats.inventory.out_of_stock > 0 && (
                  <p className="text-xs md:text-sm text-red-600 mt-1 truncate">
                    {stats.inventory.out_of_stock} out of stock
                  </p>
                )}
              </div>
              <div className="p-2 md:p-3 bg-orange-100 rounded-full self-start">
                <AlertTriangle className="h-4 w-4 md:h-6 md:w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Trend Chart */}
      {stats.sales.trend && stats.sales.trend.length > 0 && (
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <BarChart3 className="h-4 w-4 md:h-5 md:w-5" />
              <span className="truncate">Sales Trend (Last 30 Days)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="h-48 md:h-64 flex items-end justify-between gap-0.5 md:gap-1 overflow-x-auto">
              {stats.sales.trend?.map((day, index) => {
                const maxAmount = Math.max(
                  ...(stats.sales.trend?.map((d) => d.total) || [0])
                );
                const height =
                  maxAmount > 0 ? (day.total / maxAmount) * 100 : 0;
                const isToday = index === (stats.sales.trend?.length || 0) - 1;

                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center group relative"
                  >
                    <div
                      className={`w-full rounded-t transition-all ${
                        isToday
                          ? "bg-blue-500"
                          : "bg-gray-300 group-hover:bg-blue-400"
                      }`}
                      style={{
                        height: `${height}%`,
                        minHeight: day.total > 0 ? "4px" : "0",
                      }}
                    />
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                      {new Date(day.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                      <br />
                      Total: {formatCurrency(day.total)}
                      <br />
                      <span className="text-green-400">
                        Cash: {formatCurrency(day.cash)}
                      </span>
                      <br />
                      <span className="text-orange-400">
                        Credit: {formatCurrency(day.credit)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span className="truncate">
                {new Date(stats.sales.trend[0].date).toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric" }
                )}
              </span>
              <span>Today</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Payment Methods */}
        {stats.payment_methods && stats.payment_methods.length > 0 && (
          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-base md:text-lg">
                Payment Methods (30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="space-y-3 md:space-y-4">
                {stats.payment_methods.map((method) => {
                  const total = stats.payment_methods.reduce(
                    (sum, m) => sum + parseFloat(m.total),
                    0
                  );
                  const percentage = (
                    (parseFloat(method.total) / total) *
                    100
                  ).toFixed(1);

                  return (
                    <div key={method.payment_method}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs md:text-sm font-medium capitalize truncate">
                          {method.payment_method}
                        </span>
                        <span className="text-xs md:text-sm text-gray-600 ml-2">
                          {formatCurrency(parseFloat(method.total))}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            method.payment_method === "cash"
                              ? "bg-green-500"
                              : method.payment_method === "utang"
                                ? "bg-amber-500"
                                : "bg-blue-500"
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {method.count} transactions ({percentage}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Category Performance */}
        {stats.category_performance &&
          stats.category_performance.length > 0 && (
            <Card>
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="text-base md:text-lg">
                  Top Categories
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0">
                <div className="space-y-3">
                  {stats.category_performance.map((cat, index) => (
                    <div
                      key={cat.product__category}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                        <div className="w-7 h-7 md:w-8 md:h-8 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-xs md:text-sm font-medium text-purple-600">
                            {index + 1}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm md:text-base text-gray-900 truncate">
                            {cat.product__category}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {cat.items_sold} items sold
                          </p>
                        </div>
                      </div>
                      <p className="font-semibold text-sm md:text-base text-gray-900 shrink-0">
                        {formatCurrency(parseFloat(cat.total_revenue))}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Recent Sales */}
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-base md:text-lg">
              Recent Transactions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="space-y-2 md:space-y-3">
              {stats.recent_sales.length === 0 ? (
                <p className="text-gray-500 text-center py-4 text-sm">
                  No recent sales
                </p>
              ) : (
                stats.recent_sales.map((sale) => (
                  <div
                    key={sale.id}
                    className="flex items-start md:items-center justify-between gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm md:text-base text-gray-900">
                          Sale #{sale.id}
                        </p>
                        <Badge
                          variant={
                            sale.payment_method === "cash"
                              ? "default"
                              : "secondary"
                          }
                          className="text-xs"
                        >
                          {sale.payment_method}
                        </Badge>
                      </div>
                      <p className="text-xs md:text-sm text-gray-600 truncate">
                        {sale.customer_name || "Walk-in Customer"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(sale.date_created)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-sm md:text-base text-gray-900">
                        {formatCurrency(sale.total_amount)}
                      </p>
                      {sale.cashier_name && (
                        <p className="text-xs text-gray-500 truncate">
                          by {sale.cashier_name}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Best Sellers */}
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-base md:text-lg">
              Best Sellers (30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="space-y-2 md:space-y-3">
              {stats.best_sellers.length === 0 ? (
                <p className="text-gray-500 text-center py-4 text-sm">
                  No sales data
                </p>
              ) : (
                stats.best_sellers.map((product, index) => (
                  <div
                    key={product.product__id}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                      <div className="w-7 h-7 md:w-8 md:h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-xs md:text-sm font-medium text-blue-600">
                          {index + 1}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm md:text-base text-gray-900 truncate">
                          {product.product__name}
                        </p>
                        <p className="text-xs md:text-sm text-gray-600 truncate">
                          {product.total_sold} sold
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold text-sm md:text-base text-gray-900 shrink-0">
                      {formatCurrency(product.total_revenue)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Customers & Shift Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Top Customers */}
        {stats.top_customers && stats.top_customers.length > 0 && (
          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Users className="h-4 w-4 md:h-5 md:w-5" />
                Top Customers (30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="space-y-2 md:space-y-3">
                {stats.top_customers.map((customer, index) => (
                  <div
                    key={customer.customer__id}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                      <div className="w-7 h-7 md:w-8 md:h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-xs md:text-sm font-medium text-green-600">
                          {index + 1}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm md:text-base text-gray-900 truncate">
                          {customer.customer__name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {customer.transaction_count} transactions
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold text-sm md:text-base text-gray-900 shrink-0">
                      {formatCurrency(parseFloat(customer.total_spent))}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Shift/Cashier Performance */}
        {stats.shift_performance && stats.shift_performance.length > 0 && (
          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Clock className="h-4 w-4 md:h-5 md:w-5" />
                Cashier Performance (30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="space-y-2 md:space-y-3">
                {stats.shift_performance.slice(0, 5).map((perf, index) => (
                  <div
                    key={perf.cashier__id}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                      <div className="w-7 h-7 md:w-8 md:h-8 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-xs md:text-sm font-medium text-indigo-600">
                          {index + 1}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm md:text-base text-gray-900 truncate">
                          {perf.cashier__username}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {perf.transaction_count} sales • Avg:{" "}
                          {formatCurrency(parseFloat(perf.avg_transaction))}
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold text-sm md:text-base text-gray-900 shrink-0">
                      {formatCurrency(parseFloat(perf.total_sales))}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Hourly Sales Pattern */}
      {stats.hourly_pattern && stats.hourly_pattern.length > 0 && (
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Clock className="h-4 w-4 md:h-5 md:w-5" />
              Peak Hours (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="h-40 md:h-48 flex items-end justify-between gap-0.5 md:gap-1 overflow-x-auto">
              {Array.from({ length: 24 }, (_, i) => {
                const hourData = stats.hourly_pattern.find((h) => h.hour === i);
                const amount = hourData?.total ? parseFloat(hourData.total) : 0;
                const maxAmount = Math.max(
                  ...stats.hourly_pattern.map((h) => parseFloat(h.total || "0"))
                );
                const height = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;

                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center group relative min-w-5"
                  >
                    <div
                      className={`w-full rounded-t transition-all ${
                        height > 0
                          ? "bg-indigo-400 group-hover:bg-indigo-600"
                          : "bg-gray-200"
                      }`}
                      style={{
                        height: `${height}%`,
                        minHeight: height > 0 ? "4px" : "2px",
                      }}
                    />
                    {height > 0 && (
                      <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10 pointer-events-none">
                        {i}:00 - {(i + 1) % 24}:00
                        <br />
                        {formatCurrency(amount)}
                        <br />
                        {hourData?.count} sales
                      </div>
                    )}
                    {i % 4 === 0 && (
                      <span className="text-[10px] md:text-xs text-gray-400 mt-1">
                        {i}h
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
