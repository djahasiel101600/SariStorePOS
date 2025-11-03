// components/SimpleScannerDialog.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Scan, Camera, X, Check } from "lucide-react";
import BarcodeScannerComponent from "react-qr-barcode-scanner";

interface SimpleScannerDialogProps {
  onScan?: (result: string) => void;
  trigger?: React.ReactNode;
}

export function ScannerDialog({ onScan, trigger }: SimpleScannerDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const handleUpdate = (err: any, result: any) => {
    if (err) {
      console.error("Scan error:", err);
      if (err.name === "NotAllowedError") {
        setError("Camera access was denied. Please allow permissions.");
        setIsScanning(false);
      } else if (err.name === "NotFoundError") {
        setError("No camera device found.");
        setIsScanning(false);
      }
      return;
    }

    if (result) {
      const scannedValue = result.text.trim();
      if (scannedValue && scannedValue !== result) {
        setResult(scannedValue);
        setIsScanning(false);
        onScan?.(scannedValue);
      }
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setIsScanning(false);
      setResult(null);
      setError(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Scan className="h-4 w-4 mr-2" />
            Scan
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Barcode Scanner</DialogTitle>
          <DialogDescription>
            Point your camera at a barcode or QR code
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <Alert>
              <AlertDescription>
                Scanned: <strong>{result}</strong>
              </AlertDescription>
            </Alert>
          )}

          <div className="relative bg-black rounded-lg overflow-hidden">
            {isScanning ? (
              <BarcodeScannerComponent
                width={"100%"}
                height={250}
                onUpdate={handleUpdate}
                onError={(err) => {
                  console.error(err);
                  setError(
                    "Unable to access camera. Please check permissions."
                  );
                  setIsScanning(false);
                }}
              />
            ) : (
              <div className="w-full h-64 flex items-center justify-center text-gray-500 bg-gray-900">
                Camera preview will appear here
              </div>
            )}

            {isScanning && (
              <div className="absolute inset-0 border-2 border-dashed border-yellow-400 pointer-events-none" />
            )}
          </div>

          <div className="flex gap-2">
            {!isScanning ? (
              <Button
                onClick={() => {
                  setError(null);
                  setIsScanning(true);
                }}
                className="flex-1"
              >
                <Camera className="h-4 w-4 mr-2" />
                Start Camera
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setIsScanning(false);
                  setResult(null);
                }}
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                Stop
              </Button>
            )}

            {result && (
              <Button
                onClick={() => {
                  setIsOpen(false);
                }}
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-2" />
                Done
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ScannerDialog;
