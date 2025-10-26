// src/components/pos/PaymentMethodSelector.tsx
import React from "react";
import { usePOS } from "@/hooks/use-pos";
import { PaymentMethod } from "@/types";
import { CreditCard, Smartphone, Wallet, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const paymentMethods: {
  value: PaymentMethod;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "cash", label: "Cash", icon: <Wallet className="h-4 w-4" /> },
  { value: "card", label: "Card", icon: <CreditCard className="h-4 w-4" /> },
  {
    value: "mobile",
    label: "Mobile",
    icon: <Smartphone className="h-4 w-4" />,
  },
  { value: "utang", label: "Utang", icon: <Clock className="h-4 w-4" /> },
];

const PaymentMethodSelector: React.FC = () => {
  const { paymentMethod, setPaymentMethod } = usePOS();

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700">
        Payment Method
      </label>
      <div className="grid grid-cols-2 gap-2">
        {paymentMethods.map((method) => (
          <Button
            key={method.value}
            variant={paymentMethod === method.value ? "default" : "outline"}
            onClick={() => setPaymentMethod(method.value)}
            className="h-12 flex flex-col gap-1"
          >
            {method.icon}
            <span className="text-xs">{method.label}</span>
          </Button>
        ))}
      </div>

      {paymentMethod === "utang" && (
        <Badge variant="secondary" className="w-full justify-center py-2">
          💡 Customer will pay later
        </Badge>
      )}
    </div>
  );
};

export default PaymentMethodSelector;
