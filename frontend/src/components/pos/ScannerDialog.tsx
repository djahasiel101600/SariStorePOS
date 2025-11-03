// components/pos/ScannerDialog.tsx
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  X,
  Check,
  RotateCcw,
  Barcode,
  ShoppingCart,
} from "lucide-react";

// Type assertion for the library
import BarcodeScannerComponent from "react-qr-barcode-scanner";

interface ScannerDialogProps {
  onScan?: (result: string) => void;
  trigger?: React.ReactNode;
  onScannedItems?: (items: string[]) => void; // New prop for multiple items
  autoCloseAfterScan?: boolean;
}

interface ScanResult {
  text: string;
  timestamp: number;
}

export function ScannerDialog({
  onScan,
  trigger,
  onScannedItems,
  autoCloseAfterScan = false,
}: ScannerDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedItems, setScannedItems] = useState<ScanResult[]>([]);
  const [lastScanTime, setLastScanTime] = useState<number>(0);

  const scanTimeoutRef = useRef<NodeJS.Timeout>(null);
  const lastScanRef = useRef<string>("");
  const beepAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize beep sound
  useEffect(() => {
    beepAudioRef.current = new Audio("/beep.mp3"); // Path to your beep sound
    beepAudioRef.current.volume = 0.3; // Set appropriate volume
    beepAudioRef.current.load(); // Preload the audio

    return () => {
      // Cleanup
      if (beepAudioRef.current) {
        beepAudioRef.current.pause();
        beepAudioRef.current = null;
      }
    };
  }, []);

  const playBeepSound = useCallback(() => {
    if (beepAudioRef.current) {
      // Reset audio to start and play
      beepAudioRef.current.currentTime = 0;
      beepAudioRef.current.play().catch((error) => {
        console.warn("Could not play beep sound:", error);
        // Silent fail - don't show error to user
      });
    }
  }, []);

  // Debounced scan handler for POS usage
  const handleUpdate = useCallback(
    (err: any, result: any) => {
      if (err) {
        // Ignore "no barcode found" errors as they're normal during scanning
        if (!err.message?.includes("No MultiFormat Readers")) {
          console.error("Scan error:", err);
          setError(err.message || "Scanning error occurred");
        }
        return;
      }

      if (result) {
        const scannedText = result.text?.trim();

        // Prevent duplicate scans within 1 second and empty scans
        const now = Date.now();
        if (
          !scannedText ||
          scannedText === lastScanRef.current ||
          now - lastScanTime < 800
        ) {
          return;
        }

        lastScanRef.current = scannedText;
        setLastScanTime(now);

        // Play beep sound on successful scan
        playBeepSound();

        // Create new scan result
        const scanResult: ScanResult = {
          text: scannedText,
          timestamp: now,
        };

        // Update local state
        setScannedItems((prev) => {
          const newItems = [...prev, scanResult].slice(-10); // Keep last 10
          return newItems;
        });

        // Call the parent handler immediately
        onScan?.(scannedText);

        // Provide haptic feedback (if available) and visual confirmation
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }

        // Auto-close if configured (for single scans)
        if (autoCloseAfterScan) {
          setTimeout(() => {
            setIsOpen(false);
          }, 500);
        }
      }
    },
    [onScan, lastScanTime, autoCloseAfterScan]
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (!open) {
        // Notify parent of all scanned items before closing
        if (onScannedItems && scannedItems.length > 0) {
          onScannedItems(scannedItems.map((item) => item.text));
        }

        // Cleanup when dialog closes
        setIsScanning(false);
        setScannedItems([]);
        setError(null);
        lastScanRef.current = "";
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
        }
      }
    },
    [scannedItems, onScannedItems]
  );

  const startScanning = useCallback(() => {
    setError(null);
    setIsScanning(true);
    lastScanRef.current = ""; // Reset last scan
  }, []);

  const stopScanning = useCallback(() => {
    setIsScanning(false);
    setError(null);
  }, []);

  const clearScannedItems = useCallback(() => {
    setScannedItems([]);
  }, []);

  const useScannedItemsAndClose = useCallback(() => {
    // Pass all scanned items to parent
    if (onScannedItems && scannedItems.length > 0) {
      onScannedItems(scannedItems.map((item) => item.text));
    }
    setIsOpen(false);
  }, [scannedItems, onScannedItems]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {trigger && (
        <Button
          onClick={() => setIsOpen(true)}
          variant="outline"
          className="whitespace-nowrap"
        >
          <Barcode className="h-4 w-4 mr-2" />
          Scan
        </Button>
      )}

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Barcode className="h-5 w-5" />
            Product Scanner
            {scannedItems.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {scannedItems.length}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Scan product barcodes to quickly add to cart
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Feedback */}
          {lastScanTime > 0 && Date.now() - lastScanTime < 1000 && (
            <Alert className="bg-green-50 border-green-200">
              <AlertDescription className="text-green-800 flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span>Product scanned!</span>
              </AlertDescription>
            </Alert>
          )}

          {/* Scanned Items List */}
          {scannedItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Scanned Products:</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearScannedItems}
                  className="h-8 px-2"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {scannedItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                  >
                    <code className="font-mono text-xs flex-1">
                      {item.text}
                    </code>
                    <Badge variant="outline" className="text-xs">
                      #{index + 1}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scanner Preview */}
          <div className="relative bg-black rounded-lg overflow-hidden border-2 border-border">
            {isScanning ? (
              <BarcodeScannerComponent
                width={"100%"}
                height={250}
                onUpdate={handleUpdate}
                delay={300}
                videoConstraints={{
                  facingMode: "environment",
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                }}
              />
            ) : (
              <div className="w-full h-64 flex flex-col items-center justify-center text-gray-400 bg-gray-900">
                <Camera className="h-12 w-12 mb-2 opacity-50" />
                <p>Ready to scan</p>
                <p className="text-xs mt-1">Click Start Scanner below</p>
              </div>
            )}

            {/* Scanning Overlay */}
            {isScanning && (
              <>
                <div className="absolute inset-0 border-2 border-dashed border-green-400 pointer-events-none animate-pulse" />
                <div className="absolute top-3 left-3 bg-black/80 text-white px-2 py-1 rounded text-xs">
                  🔍 Scanning...
                </div>
                <div className="absolute bottom-3 left-3 bg-black/80 text-green-400 px-2 py-1 rounded text-xs">
                  {scannedItems.length} products scanned
                </div>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {!isScanning ? (
              <Button onClick={startScanning} className="flex-1" size="lg">
                <Camera className="h-4 w-4 mr-2" />
                Start Scanner
              </Button>
            ) : (
              <Button
                onClick={stopScanning}
                variant="outline"
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                Stop Scanner
              </Button>
            )}

            {/* Close/Finish Button */}
            <Button
              onClick={useScannedItemsAndClose}
              variant={scannedItems.length > 0 ? "default" : "outline"}
              className="flex-1"
              disabled={isScanning && scannedItems.length === 0}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              {scannedItems.length > 0
                ? `Add ${scannedItems.length} to Cart`
                : "Close"}
            </Button>
          </div>

          {/* POS-Specific Tips */}
          <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
            <div className="font-medium mb-1">POS Scanning Tips:</div>
            <ul className="space-y-1">
              <li>• Products are automatically added to cart when scanned</li>
              <li>• Scan multiple items quickly without closing</li>
              <li>• Use "Add to Cart" when done scanning multiple items</li>
              <li>• "No barcode detected" messages are normal between scans</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ScannerDialog;
