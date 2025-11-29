// src/components/pos/CashTender.tsx
import { forwardRef, useMemo, useState, memo } from "react";
import { usePOS } from "@/hooks/use-pos";
import { formatCurrency } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CashTenderInner = forwardRef<HTMLInputElement>((_props, ref) => {
  const {
    cashTendered,
    setCashTendered,
    getCartTotal,
    getChangeDue,
    paymentMethod,
  } = usePOS();

  // Local state to control the input - prevents parent re-renders from affecting typing
  const [inputValue, setInputValue] = useState("");

  const cartTotal = getCartTotal();
  const changeDue = getChangeDue();

  // Memoize quick amounts to prevent unnecessary re-renders
  const quickAmounts = useMemo(
    () => [cartTotal, 50, 100, 500, 1000],
    [cartTotal]
  );

  if (paymentMethod !== "cash") return null;

  const handleInputChange = (value: string) => {
    setInputValue(value);
  };

  const handleInputBlur = () => {
    if (inputValue === "" || inputValue === "0") {
      setCashTendered(0);
      setInputValue("");
      return;
    }

    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed) && parsed >= 0) {
      setCashTendered(parsed);
    } else {
      // Invalid input, reset to current value
      setInputValue(cashTendered > 0 ? cashTendered.toString() : "");
    }
  };

  const handleQuickAmount = (amount: number) => {
    setCashTendered(amount);
    setInputValue(amount.toString());
  };

  const handleClear = () => {
    setCashTendered(0);
    setInputValue("");
  };

  return (
    <div className="space-y-3">
      <Label htmlFor="cashTendered">Cash Tendered</Label>

      {/* Quick Amount Buttons */}
      <div className="grid grid-cols-3 gap-2">
        {quickAmounts.map((amount, index) => (
          <button
            key={`${amount}-${index}`}
            type="button"
            onClick={() => handleQuickAmount(amount)}
            className="text-xs p-2 border rounded hover:bg-gray-50 transition-colors"
          >
            {formatCurrency(amount)}
          </button>
        ))}
        <button
          type="button"
          onClick={handleClear}
          className="text-xs p-2 border rounded hover:bg-gray-50 transition-colors col-span-3"
        >
          Clear
        </button>
      </div>

      {/* Manual Input */}
      <Input
        ref={ref}
        id="cashTendered"
        type="number"
        step="0.01"
        min="0"
        value={inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        onBlur={handleInputBlur}
        placeholder="Enter amount received (F6)"
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
});

CashTenderInner.displayName = "CashTenderInner";

// Wrap with memo to prevent unnecessary re-renders
const CashTender = memo(CashTenderInner);

export default CashTender;
