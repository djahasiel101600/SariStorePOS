// src/components/pos/FloatingActionButton.tsx
import React from "react";
import { Button } from "@/components/ui/button";
import { ShoppingCart, ScanBarcode, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FloatingActionButtonProps {
  cartItemCount: number;
  onCartClick: () => void;
  onScanClick: () => void;
  onQuickAdd?: () => void;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  cartItemCount,
  onCartClick,
  onScanClick,
  onQuickAdd,
}) => {
  return (
    <div className="fixed bottom-6 right-6 z-50 lg:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="lg"
            className="rounded-full w-14 h-14 shadow-lg relative"
          >
            <Plus className="h-6 w-6" />
            {cartItemCount > 0 && (
              <Badge
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs"
                variant="destructive"
              >
                {cartItemCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={onCartClick}
            className="flex items-center gap-3 py-3"
          >
            <ShoppingCart className="h-4 w-4" />
            <span>View Cart ({cartItemCount})</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onScanClick}
            className="flex items-center gap-3 py-3"
          >
            <ScanBarcode className="h-4 w-4" />
            <span>Scan Barcode</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
