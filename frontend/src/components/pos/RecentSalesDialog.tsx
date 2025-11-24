import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Clock, User } from "lucide-react";

interface Sale {
  id: number;
  total_amount: number;
  payment_method: string;
  customer?: { name: string } | null;
  created_at: string;
  items: Array<{
    product: { name: string };
    quantity: number;
    unit_price: number;
  }>;
}

interface RecentSalesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sales: Sale[];
}

export function RecentSalesDialog({
  open,
  onOpenChange,
  sales,
}: RecentSalesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Transactions
          </DialogTitle>
          <DialogDescription>
            Last {sales.length} completed transactions
          </DialogDescription>
        </DialogHeader>
        <div className="h-[500px] overflow-auto pr-4">
          <div className="space-y-4">
            {sales.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No recent transactions
              </div>
            ) : (
              sales.map((sale) => (
                <div
                  key={sale.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">
                          #{sale.id}
                        </span>
                        <Badge
                          variant={
                            sale.payment_method === "cash"
                              ? "default"
                              : sale.payment_method === "utang"
                                ? "destructive"
                                : "secondary"
                          }
                          className="text-xs"
                        >
                          {sale.payment_method}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(sale.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrency(sale.total_amount)}
                      </div>
                      {sale.customer && (
                        <div className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                          <User className="h-3 w-3" />
                          {sale.customer.name}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Items */}
                  <div className="space-y-1 text-sm">
                    {sale.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between text-gray-700"
                      >
                        <span className="truncate flex-1">
                          {item.quantity}x {item.product.name}
                        </span>
                        <span className="ml-2">
                          {formatCurrency(item.quantity * item.unit_price)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
