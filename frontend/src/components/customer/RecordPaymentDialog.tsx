import React, { useState } from 'react';
import { useRecordPayment } from '@/hooks/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: number;
  onSuccess?: () => void;
}

const RecordPaymentDialog: React.FC<RecordPaymentDialogProps> = ({ open, onOpenChange, customerId, onSuccess }) => {
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<'cash' | 'card' | 'mobile'>('cash');
  const [notes, setNotes] = useState<string>('');

  const recordPayment = useRecordPayment();

  const onSubmit = async () => {
    const parsed = parseFloat(amount);
    if (!isFinite(parsed) || parsed <= 0) return;
    try {
      await recordPayment.mutateAsync({ customer: customerId, amount: parsed, method, notes: notes || undefined });
      onSuccess?.();
      onOpenChange(false);
      setAmount('');
      setNotes('');
      setMethod('cash');
    } catch (e) {
      // handled by hook caller invalidations; could add toast here if using one globally
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="method">Method</Label>
            <select
              id="method"
              className="border rounded h-10 px-3"
              value={method}
              onChange={(e) => setMethod(e.target.value as 'cash' | 'card' | 'mobile')}
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="mobile">Mobile</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <textarea
              id="notes"
              className="w-full border rounded px-3 py-2"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reference, remarks, etc."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={recordPayment.isPending}>Cancel</Button>
          <Button onClick={onSubmit} disabled={recordPayment.isPending || !amount}>Record Payment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecordPaymentDialog;
