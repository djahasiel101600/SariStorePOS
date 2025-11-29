import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Printer, Download, X } from "lucide-react";
import { toast } from "sonner";

interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleData: {
    items: Array<{
      product: { name: string; unit_type: string };
      quantity: number;
      unitPrice: number;
      requestedAmount?: number | null;
    }>;
    total: number;
    paymentMethod: string;
    cashTendered?: number;
    changeDue?: number;
    customer?: { name: string } | null;
    timestamp: Date;
    receiptNumber?: string;
  };
}

export function ReceiptDialog({
  open,
  onOpenChange,
  saleData,
}: ReceiptDialogProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = () => {
    setIsPrinting(true);
    try {
      window.print();
      toast.success("Receipt printed");
    } catch (error) {
      toast.error("Failed to print receipt");
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownload = () => {
    const receiptText = generateReceiptText();
    const blob = new Blob([receiptText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${saleData.receiptNumber || Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Receipt downloaded");
  };

  const generateReceiptText = () => {
    let text = "==========================================\n";
    text += "           SARI STORE POS\n";
    text += "==========================================\n\n";
    text += `Date: ${saleData.timestamp.toLocaleString()}\n`;
    text += `Receipt #: ${saleData.receiptNumber || "N/A"}\n`;
    if (saleData.customer) {
      text += `Customer: ${saleData.customer.name}\n`;
    }
    text += `\n------------------------------------------\n`;
    text += "ITEMS\n";
    text += `------------------------------------------\n\n`;

    saleData.items.forEach((item) => {
      const effectivePrice = item.requestedAmount ?? item.unitPrice;
      const hasOverride =
        item.requestedAmount != null && item.requestedAmount !== item.unitPrice;

      text += `${item.product.name}\n`;
      if (hasOverride) {
        text += `  ${item.quantity} ${item.product.unit_type} x ${formatCurrency(effectivePrice)} *ADJUSTED*\n`;
        text += `  (Original: ${formatCurrency(item.unitPrice)})\n`;
      } else {
        text += `  ${item.quantity} ${item.product.unit_type} x ${formatCurrency(effectivePrice)}\n`;
      }
      text += `  ${formatCurrency(item.quantity * effectivePrice)}\n\n`;
    });

    text += `------------------------------------------\n`;
    text += `TOTAL: ${formatCurrency(saleData.total)}\n`;
    text += `Payment: ${saleData.paymentMethod.toUpperCase()}\n`;
    if (saleData.paymentMethod === "cash" && saleData.cashTendered) {
      text += `Cash: ${formatCurrency(saleData.cashTendered)}\n`;
      text += `Change: ${formatCurrency(saleData.changeDue || 0)}\n`;
    }
    text += `\n==========================================\n`;
    text += "       Thank you for your purchase!\n";
    text += "==========================================\n";

    return text;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-auto print:shadow-none">
        <DialogHeader className="print:hidden">
          <DialogTitle>Receipt</DialogTitle>
          <DialogDescription>
            Transaction completed successfully
          </DialogDescription>
        </DialogHeader>

        {/* Receipt Content */}
        <div className="receipt-content py-6 px-4 font-mono text-sm bg-white">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold">SARI STORE POS</h2>
            <div className="text-xs text-gray-600 mt-2">
              {saleData.timestamp.toLocaleString()}
            </div>
            {saleData.receiptNumber && (
              <div className="text-xs text-gray-600">
                Receipt #: {saleData.receiptNumber}
              </div>
            )}
            {saleData.customer && (
              <div className="text-xs text-gray-600">
                Customer: {saleData.customer.name}
              </div>
            )}
          </div>

          <div className="border-t border-b border-gray-300 py-3 mb-3">
            <div className="font-semibold mb-2">ITEMS</div>
            {saleData.items.map((item, index) => {
              const effectivePrice = item.requestedAmount ?? item.unitPrice;
              const hasOverride =
                item.requestedAmount != null &&
                item.requestedAmount !== item.unitPrice;
              const delta = hasOverride
                ? item.requestedAmount! - item.unitPrice
                : 0;
              const percentage =
                hasOverride && item.unitPrice !== 0
                  ? (delta / item.unitPrice) * 100
                  : 0;

              return (
                <div key={index} className="mb-3">
                  <div className="flex justify-between">
                    <span className="flex-1">{item.product.name}</span>
                    {hasOverride && (
                      <span className="text-xs text-orange-600 font-semibold">
                        ADJUSTED{" "}
                        {percentage > 0
                          ? `+${percentage.toFixed(2)}%`
                          : `${percentage.toFixed(2)}%`}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>
                      {item.quantity} {item.product.unit_type} x{" "}
                      {hasOverride ? (
                        <>
                          <span className="line-through text-gray-400">
                            {formatCurrency(item.unitPrice)}
                          </span>{" "}
                          <span className="text-orange-600 font-semibold">
                            {formatCurrency(effectivePrice)}
                          </span>
                          <span className="text-orange-600 ml-1">
                            ({delta > 0 ? "+" : ""}
                            {formatCurrency(delta)})
                          </span>
                        </>
                      ) : (
                        formatCurrency(effectivePrice)
                      )}
                    </span>
                    <span className="font-semibold">
                      {formatCurrency(item.quantity * effectivePrice)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>TOTAL:</span>
              <span>{formatCurrency(saleData.total)}</span>
            </div>
            <div className="flex justify-between">
              <span>Payment Method:</span>
              <span className="uppercase">{saleData.paymentMethod}</span>
            </div>
            {saleData.paymentMethod === "cash" && saleData.cashTendered && (
              <>
                <div className="flex justify-between">
                  <span>Cash Tendered:</span>
                  <span>{formatCurrency(saleData.cashTendered)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Change:</span>
                  <span>{formatCurrency(saleData.changeDue || 0)}</span>
                </div>
              </>
            )}
          </div>

          <div className="text-center mt-6 text-xs text-gray-600">
            Thank you for your purchase!
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" className="flex-1" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button
            variant="default"
            className="flex-1"
            onClick={handlePrint}
            disabled={isPrinting}
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
