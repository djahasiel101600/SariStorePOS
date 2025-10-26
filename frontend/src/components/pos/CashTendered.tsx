// src/components/pos/CashTender.tsx
import React from "react";
import { usePOS } from "@/hooks/use-pos";
import { formatCurrency } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CashTender: React.FC = () => {
  const {
    cashTendered,
    setCashTendered,
    getCartTotal,
    getChangeDue,
    paymentMethod,
  } = usePOS();

  const cartTotal = getCartTotal();
  const changeDue = getChangeDue();

  // Quick cash buttons
  const quickAmounts = [cartTotal, 50, 100, 500, 1000];

  if (paymentMethod !== "cash") return null;

  return (
    <div className="space-y-3">
      <Label htmlFor="cashTendered">Cash Tendered</Label>

      {/* Quick Amount Buttons */}
      <div className="grid grid-cols-3 gap-2">
        {quickAmounts.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => setCashTendered(amount)}
            className="text-xs p-2 border rounded hover:bg-gray-50 transition-colors"
          >
            {formatCurrency(amount)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCashTendered(0)}
          className="text-xs p-2 border rounded hover:bg-gray-50 transition-colors col-span-3"
        >
          Clear
        </button>
      </div>

      {/* Manual Input */}
      <Input
        id="cashTendered"
        type="number"
        step="0.01"
        min="0"
        value={cashTendered || ""}
        onChange={(e) => setCashTendered(parseFloat(e.target.value) || 0)}
        placeholder="Enter amount received"
        className="text-lg font-semibold"
      />

      {/* Change Display */}
      {cashTendered > 0 && (
        <div
          className={`p-3 rounded-lg text-center ${
            changeDue >= 0
              ? "bg-green-100 text-green-800 border border-green-200"
              : "bg-red-100 text-red-800 border border-red-200"
          }`}
        >
          <div className="text-sm font-medium">
            {changeDue >= 0 ? "Change Due" : "Insufficient Amount"}
          </div>
          <div className="text-xl font-bold">
            {formatCurrency(Math.abs(changeDue))}
          </div>
          {changeDue < 0 && (
            <div className="text-xs mt-1">
              Need {formatCurrency(Math.abs(changeDue))} more
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CashTender;
