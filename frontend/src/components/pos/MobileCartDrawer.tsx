// src/components/pos/MobileCartDrawer.tsx
import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface MobileCartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItemCount: number;
  cartTotal: number;
  children: React.ReactNode;
}

export const MobileCartDrawer: React.FC<MobileCartDrawerProps> = ({
  isOpen,
  onClose,
  cartItemCount,
  children,
}) => {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="bottom"
        className="h-[85vh] rounded-t-2xl p-2 overflow-auto"
      >
        <SheetHeader className="flex-row items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-3">
            <SheetTitle className="text-lg">Shopping Cart</SheetTitle>
            {cartItemCount > 0 && (
              <Badge variant="secondary" className="h-6 px-2">
                {cartItemCount} items
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            {/* <X className="h-4 w-4" /> */}
          </Button>
        </SheetHeader>

        <div className="h-full flex flex-col pt-4">{children}</div>

        {/* Cart Summary Bar */}
      </SheetContent>
    </Sheet>
  );
};
