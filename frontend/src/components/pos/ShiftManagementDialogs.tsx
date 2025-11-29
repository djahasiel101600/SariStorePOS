// src/components/pos/ShiftManagementDialogs.tsx
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { Loader2, DollarSign, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Shift } from "@/types";

interface StartShiftDialogProps {
  open: boolean;
  onClose: () => void;
  onStart: (data: { opening_cash: number; notes?: string }) => Promise<void>;
  isLoading: boolean;
}

export const StartShiftDialog: React.FC<StartShiftDialogProps> = ({
  open,
  onClose,
  onStart,
  isLoading,
}) => {
  const [openingCash, setOpeningCash] = useState("100.00");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(openingCash);
    if (isNaN(amount) || amount < 0) {
      return;
    }
    await onStart({ opening_cash: amount, notes });
    setOpeningCash("100.00");
    setNotes("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Start Shift</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Alert>
            <DollarSign className="h-4 w-4" />
            <AlertDescription>
              Count the cash in your drawer and enter the opening amount
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="opening-cash">Opening Cash Amount *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                ₱
              </span>
              <Input
                id="opening-cash"
                type="number"
                step="0.01"
                min="0"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                className="pl-7"
                required
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about starting the shift..."
              rows={3}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                "Start Shift"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

interface EndShiftDialogProps {
  open: boolean;
  onClose: () => void;
  onEnd: (data: { closing_cash: number; notes?: string }) => Promise<void>;
  shift: Shift | null;
  isLoading: boolean;
}

export const EndShiftDialog: React.FC<EndShiftDialogProps> = ({
  open,
  onClose,
  onEnd,
  shift,
  isLoading,
}) => {
  const [closingCash, setClosingCash] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(closingCash);
    if (isNaN(amount) || amount < 0) {
      return;
    }
    await onEnd({ closing_cash: amount, notes });
    setClosingCash("");
    setNotes("");
    onClose();
  };

  const openingCash = shift?.opening_cash || 0;
  const expectedCash = shift?.expected_cash || openingCash;
  const closingAmount = parseFloat(closingCash) || 0;
  const difference = closingAmount - expectedCash;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">End Shift</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Count the cash in your drawer to reconcile the shift
            </AlertDescription>
          </Alert>

          {/* Shift Summary */}
          <div className="rounded-lg border bg-gray-50 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Opening Cash:</span>
              <span className="font-medium">{formatCurrency(openingCash)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Cash Sales:</span>
              <span className="font-medium">
                {formatCurrency(expectedCash - openingCash)}
              </span>
            </div>
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="text-gray-600 font-medium">Expected Cash:</span>
              <span className="font-bold">{formatCurrency(expectedCash)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Sales:</span>
              <span className="font-medium">{shift?.sales_count || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Revenue:</span>
              <span className="font-medium">
                {formatCurrency(shift?.total_sales || 0)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="closing-cash">Actual Closing Cash *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                $
              </span>
              <Input
                id="closing-cash"
                type="number"
                step="0.01"
                min="0"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                className="pl-7"
                required
                autoFocus
              />
            </div>
          </div>

          {/* Cash Difference */}
          {closingCash && (
            <div
              className={`rounded-lg border p-3 ${
                difference === 0
                  ? "bg-green-50 border-green-200"
                  : difference > 0
                    ? "bg-blue-50 border-blue-200"
                    : "bg-red-50 border-red-200"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Cash Difference:</span>
                <span
                  className={`text-lg font-bold ${
                    difference === 0
                      ? "text-green-700"
                      : difference > 0
                        ? "text-blue-700"
                        : "text-red-700"
                  }`}
                >
                  {difference >= 0 ? "+" : ""}
                  {formatCurrency(Math.abs(difference))}
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {difference === 0
                  ? "Perfect! Cash drawer balances."
                  : difference > 0
                    ? "Cash drawer is over."
                    : "Cash drawer is short."}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="end-notes">Notes (optional)</Label>
            <Textarea
              id="end-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about ending the shift..."
              rows={3}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ending...
                </>
              ) : (
                "End Shift"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
