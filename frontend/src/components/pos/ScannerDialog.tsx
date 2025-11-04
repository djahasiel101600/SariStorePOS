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
  Smartphone,
} from "lucide-react";

// Type assertion for the library
import BarcodeScannerComponent from "react-qr-barcode-scanner";

interface ScannerDialogProps {
  onScan?: (result: string) => void;
  trigger?: React.ReactNode;
  onScannedItems?: (items: string[]) => void;
  autoCloseAfterScan?: boolean;
  /** If true, open the dialog as soon as the component mounts */
  openOnMount?: boolean;
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
  openOnMount = false,
}: ScannerDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedItems, setScannedItems] = useState<ScanResult[]>([]);
  const [lastScanTime, setLastScanTime] = useState<number>(0);
  const [isMobile, setIsMobile] = useState(false);

  const scanTimeoutRef = useRef<NodeJS.Timeout>(null);
  const lastScanRef = useRef<string>("");
  const beepAudioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [trackCapabilities, setTrackCapabilities] = useState<any | null>(null);
  const [trackSettings, setTrackSettings] = useState<any | null>(null);
  const [zoomValue, setZoomValue] = useState<number | null>(null);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [focusModes, setFocusModes] = useState<string[] | null>(null);
  const [focusDistanceValue, setFocusDistanceValue] = useState<number | null>(
    null
  );

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  // Initialize beep sound
  useEffect(() => {
    beepAudioRef.current = new Audio("/beep.mp3");
    beepAudioRef.current.volume = 0.3;
    beepAudioRef.current.load();

    return () => {
      if (beepAudioRef.current) {
        beepAudioRef.current.pause();
        beepAudioRef.current = null;
      }
    };
  }, []);

  // Enumerate video input devices on mount
  useEffect(() => {
    let mounted = true;
    async function getDevices() {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        const list = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = list.filter((d) => d.kind === "videoinput");
        if (!mounted) return;
        setDevices(videoInputs);
        const rear = videoInputs.find((d) =>
          /back|rear|environment/i.test(d.label)
        );
        if (rear) setSelectedDeviceId(rear.deviceId);
      } catch (e) {
        // ignore
      }
    }

    getDevices();

    return () => {
      mounted = false;
    };
  }, []);

  const playBeepSound = useCallback(() => {
    if (beepAudioRef.current) {
      beepAudioRef.current.currentTime = 0;
      beepAudioRef.current.play().catch((error) => {
        console.warn("Could not play beep sound:", error);
      });
    }
  }, []);

  // Debounced scan handler for POS usage
  const handleUpdate = useCallback(
    (err: any, result: any) => {
      if (err) {
        if (!err.message?.includes("No MultiFormat Readers")) {
          console.error("Scan error:", err);
          setError(err.message || "Scanning error occurred");
        }
        return;
      }

      if (result) {
        const scannedText = result.text?.trim();
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
        playBeepSound();

        const scanResult: ScanResult = {
          text: scannedText,
          timestamp: now,
        };

        setScannedItems((prev) => {
          const newItems = [...prev, scanResult].slice(-10);
          return newItems;
        });

        onScan?.(scannedText);

        if (navigator.vibrate) {
          navigator.vibrate(50);
        }

        if (autoCloseAfterScan) {
          setTimeout(() => {
            setIsOpen(false);
          }, 500);
        }
      }
    },
    [onScan, lastScanTime, autoCloseAfterScan, playBeepSound]
  );

  // Mobile-optimized video constraints
  const buildVideoConstraints = useCallback(() => {
    if (isMobile) {
      return {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        aspectRatio: { ideal: 16 / 9 },
      };
    }

    return selectedDeviceId
      ? {
          deviceId: { exact: selectedDeviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        }
      : {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        };
  }, [selectedDeviceId, isMobile]);

  const captureAndDecode = useCallback(async () => {
    try {
      const container = containerRef.current;
      if (!container) return;
      const video = container.querySelector("video") as HTMLVideoElement | null;
      if (!video) {
        setError("No video found to capture from.");
        return;
      }

      const vw = video.videoWidth || 1280;
      const vh = video.videoHeight || 720;

      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(vw);
      canvas.height = Math.floor(vh);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setError("Could not create canvas context.");
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const BarcodeDetectorCtor: any = (window as any).BarcodeDetector;
      if (BarcodeDetectorCtor) {
        const formats = [
          "ean_13",
          "ean_8",
          "upc_e",
          "upc_a",
          "code_128",
          "code_39",
          "qr_code",
        ];
        const detector = new BarcodeDetectorCtor({ formats });
        const bitmap = await createImageBitmap(canvas);
        const results = await detector.detect(bitmap as any);
        if (results && results.length > 0) {
          const raw =
            (results[0] as any).rawValue ||
            (results[0] as any).raw_value ||
            null;
          if (raw) {
            playBeepSound();
            onScan?.(raw);
            setScannedItems((prev) =>
              [...prev, { text: raw, timestamp: Date.now() }].slice(-10)
            );
            if (navigator.vibrate) navigator.vibrate(50);
            return;
          }
        }
        setError("No barcode detected in the captured image.");
        return;
      }

      setError(
        "Barcode Detector API not available in this browser. Try Chrome or use the live scanner."
      );
    } catch (e: any) {
      console.error("captureAndDecode error:", e);
      setError(e?.message || String(e));
    }
  }, [onScan, playBeepSound]);

  // Capture multiple frames and try to decode each one (helpful for close / transient focus)
  const captureMultipleAndDecode = useCallback(
    async (
      attempts = 5,
      intervalMs = 150,
      upscale = 1.5
    ): Promise<string | null> => {
      try {
        const container = containerRef.current;
        if (!container) return null;
        const video = container.querySelector(
          "video"
        ) as HTMLVideoElement | null;
        if (!video) {
          setError("No video found to capture from.");
          return null;
        }

        const vw = video.videoWidth || 1280;
        const vh = video.videoHeight || 720;

        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(vw * upscale);
        canvas.height = Math.floor(vh * upscale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setError("Could not create canvas context.");
          return null;
        }

        const BarcodeDetectorCtor: any = (window as any).BarcodeDetector;

        // Prepare a zxing-js reader lazily if needed
        let zxingReader: any = null;
        let triedLoadZxing = false;

        for (let i = 0; i < attempts; i++) {
          // draw current frame (upscaled)
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          } catch (e) {
            console.warn("drawImage failed", e);
          }

          try {
            // First try native BarcodeDetector if available
            if (BarcodeDetectorCtor) {
              const detector = new BarcodeDetectorCtor({
                formats: [
                  "ean_13",
                  "ean_8",
                  "upc_e",
                  "upc_a",
                  "code_128",
                  "code_39",
                  "qr_code",
                ],
              });

              const bitmap = await createImageBitmap(canvas);
              const results = await detector.detect(bitmap as any);
              bitmap.close?.();
              if (results && results.length > 0) {
                const raw =
                  (results[0] as any).rawValue ||
                  (results[0] as any).raw_value ||
                  null;
                if (raw) {
                  const now = Date.now();
                  playBeepSound();
                  onScan?.(raw);
                  setScannedItems((prev) =>
                    [...prev, { text: raw, timestamp: now }].slice(-10)
                  );
                  setLastScanTime(now);
                  lastScanRef.current = raw;
                  if (navigator.vibrate) navigator.vibrate(50);
                  if (autoCloseAfterScan)
                    setTimeout(() => setIsOpen(false), 500);
                  return raw;
                }
              }
            }

            // If native detector not available or didn't find anything, try zxing-js fallback
            if (!triedLoadZxing) {
              triedLoadZxing = true;
              try {
                const zxing = await import("@zxing/library");
                const ReaderCtor =
                  zxing.BrowserMultiFormatReader ||
                  zxing.BrowserBarcodeReader ||
                  zxing.BrowserCodeReader ||
                  zxing.BrowserCodeReader;
                if (ReaderCtor) {
                  zxingReader = new ReaderCtor();
                } else if (zxing.MultiFormatReader) {
                  zxingReader = new zxing.MultiFormatReader();
                }
              } catch (e) {
                console.warn("Could not load @zxing/library", e);
              }
            }

            if (zxingReader) {
              try {
                if (typeof zxingReader.decodeFromCanvas === "function") {
                  const res = await zxingReader.decodeFromCanvas(canvas as any);
                  const text =
                    res?.text || res?.getText?.() || res?.result?.text || null;
                  if (text) {
                    const now = Date.now();
                    playBeepSound();
                    onScan?.(text);
                    setScannedItems((prev) =>
                      [...prev, { text, timestamp: now }].slice(-10)
                    );
                    setLastScanTime(now);
                    lastScanRef.current = text;
                    if (navigator.vibrate) navigator.vibrate(50);
                    if (autoCloseAfterScan)
                      setTimeout(() => setIsOpen(false), 500);
                    try {
                      zxingReader.reset?.();
                    } catch {}
                    return text;
                  }
                }

                if (typeof zxingReader.decodeFromImage === "function") {
                  const img = new Image();
                  img.src = canvas.toDataURL();
                  await new Promise((r, rej) => {
                    img.onload = r;
                    img.onerror = rej;
                  });
                  const res = await zxingReader.decodeFromImage(img);
                  const text =
                    res?.text || res?.getText?.() || res?.result?.text || null;
                  if (text) {
                    const now = Date.now();
                    playBeepSound();
                    onScan?.(text);
                    setScannedItems((prev) =>
                      [...prev, { text, timestamp: now }].slice(-10)
                    );
                    setLastScanTime(now);
                    lastScanRef.current = text;
                    if (navigator.vibrate) navigator.vibrate(50);
                    if (autoCloseAfterScan)
                      setTimeout(() => setIsOpen(false), 500);
                    try {
                      zxingReader.reset?.();
                    } catch {}
                    return text;
                  }
                }
              } catch (e) {
                console.warn("zxing decode failed", e);
              }
            }
          } catch (e: any) {
            console.warn("decode attempt failed", e);
          }

          // wait before next attempt (allow focus/AE to settle)
          if (i < attempts - 1) {
            await new Promise((res) => setTimeout(res, intervalMs));
          }
        }

        setError("No barcode detected after multiple attempts.");
        return null;
      } catch (e: any) {
        console.error("captureMultipleAndDecode error", e);
        setError(e?.message || String(e));
        return null;
      }
    },
    [onScan, playBeepSound, autoCloseAfterScan]
  );

  // Read the underlying video track capabilities/settings (best-effort)
  const refreshTrackInfo = useCallback(async () => {
    try {
      const container = containerRef.current;
      if (!container) return;
      const video = container.querySelector("video") as HTMLVideoElement | null;
      if (!video) return;
      const stream = (video.srcObject ||
        (video as any).captureStream?.()) as MediaStream | null;
      const track = stream?.getVideoTracks()[0];
      if (!track) return;

      const caps = (track as any).getCapabilities?.() ?? null;
      const sets = (track as any).getSettings?.() ?? null;
      setTrackCapabilities(caps);
      setTrackSettings(sets);

      if (caps?.zoom) {
        setZoomValue(sets?.zoom ?? caps.zoom?.min ?? null);
      }
      if (caps?.torch) {
        setTorchOn(!!sets?.torch);
      }
      if (caps?.focusMode) {
        setFocusModes(caps.focusMode as string[]);
      }
      if (caps?.focusDistance) {
        setFocusDistanceValue(
          sets?.focusDistance ?? caps.focusDistance?.min ?? null
        );
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const applyTrackConstraint = useCallback(
    async (constraints: any) => {
      try {
        const container = containerRef.current;
        if (!container) return false;
        const video = container.querySelector(
          "video"
        ) as HTMLVideoElement | null;
        if (!video) return false;
        const stream = (video.srcObject ||
          (video as any).captureStream?.()) as MediaStream | null;
        const track = stream?.getVideoTracks()[0] as any | undefined;
        if (!track || !track.applyConstraints) return false;
        await track.applyConstraints({ advanced: [constraints] });
        // Refresh info after applying
        await refreshTrackInfo();
        return true;
      } catch (e: any) {
        console.warn("applyTrackConstraint failed", constraints, e);
        setError(e?.message || String(e));
        return false;
      }
    },
    [refreshTrackInfo]
  );

  const setZoom = useCallback(
    async (value: number) => {
      const ok = await applyTrackConstraint({ zoom: value });
      if (ok) setZoomValue(value);
    },
    [applyTrackConstraint]
  );

  const toggleTorch = useCallback(
    async (on: boolean) => {
      const ok = await applyTrackConstraint({ torch: on });
      if (ok) setTorchOn(on);
    },
    [applyTrackConstraint]
  );

  const setFocusMode = useCallback(
    async (mode: string) => {
      const ok = await applyTrackConstraint({ focusMode: mode });
      if (ok) setFocusModes((prev) => (prev ? prev : [mode]));
    },
    [applyTrackConstraint]
  );

  const setFocusDistance = useCallback(
    async (value: number) => {
      const ok = await applyTrackConstraint({ focusDistance: value });
      if (ok) setFocusDistanceValue(value);
    },
    [applyTrackConstraint]
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (!open) {
        if (onScannedItems && scannedItems.length > 0) {
          onScannedItems(scannedItems.map((item) => item.text));
        }
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
    lastScanRef.current = "";
    // Delay reading track info briefly to allow the scanner's video to start
    setTimeout(() => {
      refreshTrackInfo().catch(() => {});
    }, 700);
  }, [refreshTrackInfo]);

  const stopScanning = useCallback(() => {
    setIsScanning(false);
    setError(null);
  }, []);

  const clearScannedItems = useCallback(() => {
    setScannedItems([]);
  }, []);

  const useScannedItemsAndClose = useCallback(() => {
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

  // Optionally open dialog on mount (useful when the parent mounts the component
  // to show scanner immediately, e.g. from a product form)
  useEffect(() => {
    if (openOnMount) setIsOpen(true);
  }, [openOnMount]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {trigger && (
        <Button
          onClick={() => setIsOpen(true)}
          variant="outline"
          className="whitespace-nowrap"
          size={isMobile ? "default" : "sm"}
        >
          <Barcode className="h-4 w-4 mr-2" />
          Scan
        </Button>
      )}

      <DialogContent className="sm:max-w-md w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0 px-1 sm:px-0">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Barcode className="h-5 w-5" />
            Product Scanner
            {scannedItems.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {scannedItems.length}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            Scan product barcodes to quickly add to cart
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 sm:space-y-4 px-1 sm:px-0">
          {/* Error Display */}
          {error && (
            <Alert variant="destructive" className="py-2 sm:py-3">
              <AlertDescription className="text-xs sm:text-sm">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Success Feedback */}
          {lastScanTime > 0 && Date.now() - lastScanTime < 1000 && (
            <Alert className="bg-green-50 border-green-200 py-2 sm:py-3">
              <AlertDescription className="text-green-800 flex items-center gap-2 text-xs sm:text-sm">
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
                  className="h-7 px-2 text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>
              <div className="max-h-24 sm:max-h-32 overflow-y-auto space-y-1">
                {scannedItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs sm:text-sm"
                  >
                    <code className="font-mono text-xs flex-1 truncate mr-2">
                      {item.text}
                    </code>
                    <Badge variant="outline" className="text-xs shrink-0">
                      #{index + 1}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scanner Preview */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              {devices.length > 0 ? (
                <select
                  className="text-xs sm:text-sm p-1.5 rounded border bg-background flex-1 max-w-[180px] sm:max-w-none"
                  value={selectedDeviceId ?? ""}
                  onChange={(e) => setSelectedDeviceId(e.target.value || null)}
                >
                  <option value="">Auto (Rear camera)</option>
                  {devices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Camera ${d.deviceId.slice(0, 8)}...`}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Detecting cameras…
                </div>
              )}
            </div>
            <div className="text-xs text-muted-foreground text-right shrink-0">
              Hold ~10–20cm from barcode
            </div>
          </div>

          {/* Camera Preview Container */}
          <div
            ref={containerRef}
            className="relative bg-black rounded-lg overflow-hidden border-2 border-border aspect-4/3"
          >
            {isScanning ? (
              <BarcodeScannerComponent
                width={"100%"}
                height={"100%"}
                onUpdate={handleUpdate}
                delay={250}
                videoConstraints={buildVideoConstraints()}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-900">
                <Camera className="h-8 w-8 sm:h-12 sm:w-12 mb-2 opacity-50" />
                <p className="text-sm sm:text-base">Ready to scan</p>
                <p className="text-xs mt-1 text-center px-2">
                  Click Start Scanner below
                </p>
              </div>
            )}

            {/* Scanning Overlay */}
            {isScanning && (
              <>
                <div className="absolute inset-0 border-2 border-dashed border-green-400 pointer-events-none animate-pulse" />
                <div className="absolute top-2 left-2 bg-black/80 text-white px-2 py-1 rounded text-xs">
                  🔍 Scanning...
                </div>
                <div className="absolute bottom-2 left-2 bg-black/80 text-green-400 px-2 py-1 rounded text-xs">
                  {scannedItems.length} scanned
                </div>
              </>
            )}
          </div>

          {/* Camera controls (zoom/torch/focus) - best-effort, shown when available */}
          {(trackCapabilities || trackSettings) && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
                {/* Zoom slider */}
                {trackCapabilities?.zoom && (
                  <div className="col-span-1 sm:col-span-2 flex items-center gap-2">
                    <label className="text-xs w-20">Zoom</label>
                    <input
                      type="range"
                      min={trackCapabilities.zoom.min ?? 1}
                      max={trackCapabilities.zoom.max ?? 1}
                      step={trackCapabilities.zoom.step ?? 0.1}
                      value={
                        zoomValue ??
                        trackSettings?.zoom ??
                        trackCapabilities.zoom.min ??
                        1
                      }
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="flex-1"
                    />
                    <div className="text-xs w-12 text-right">
                      {(zoomValue ?? trackSettings?.zoom ?? 1).toFixed(1)}x
                    </div>
                  </div>
                )}

                {/* Torch toggle */}
                {trackCapabilities?.torch && (
                  <div className="col-span-1 flex items-center gap-2">
                    <label className="text-xs">Torch</label>
                    <Button
                      size="sm"
                      variant={torchOn ? "default" : "outline"}
                      onClick={() => toggleTorch(!torchOn)}
                    >
                      {torchOn ? "On" : "Off"}
                    </Button>
                  </div>
                )}

                {/* Focus mode */}
                {focusModes && focusModes.length > 0 && (
                  <div className="col-span-1 flex items-center gap-2">
                    <label className="text-xs">Focus</label>
                    <select
                      className="text-xs p-1 rounded bg-background"
                      value={trackSettings?.focusMode ?? focusModes[0]}
                      onChange={(e) => setFocusMode(e.target.value)}
                    >
                      {focusModes.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Focus distance */}
                {trackCapabilities?.focusDistance && (
                  <div className="col-span-1 sm:col-span-3 flex items-center gap-2">
                    <label className="text-xs w-20">Focus dist</label>
                    <input
                      type="range"
                      min={trackCapabilities.focusDistance.min ?? 0}
                      max={trackCapabilities.focusDistance.max ?? 0}
                      step={trackCapabilities.focusDistance.step ?? 0.1}
                      value={
                        focusDistanceValue ??
                        trackSettings?.focusDistance ??
                        trackCapabilities.focusDistance.min ??
                        0
                      }
                      onChange={(e) => setFocusDistance(Number(e.target.value))}
                      className="flex-1"
                    />
                    <div className="text-xs w-12 text-right">
                      {(
                        focusDistanceValue ??
                        trackSettings?.focusDistance ??
                        0
                      ).toFixed(1)}
                    </div>
                  </div>
                )}
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => refreshTrackInfo()}
                >
                  Refresh
                </Button>
                <div className="text-xs text-muted-foreground">
                  {trackCapabilities
                    ? "Controls available"
                    : "No advanced controls"}
                </div>
              </div>
            </div>
          )}

          {/* Mobile Tips */}
          {isMobile && (
            <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 p-2 rounded-lg flex items-start gap-2">
              <Smartphone className="h-3 w-3 mt-0.5 shrink-0" />
              <div>
                <strong>Tip:</strong> Hold steady and ensure good lighting for
                better scanning
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 flex-col sm:flex-row">
            {!isScanning ? (
              <Button
                onClick={startScanning}
                className="flex-1"
                size={isMobile ? "default" : "lg"}
              >
                <Camera className="h-4 w-4 mr-2" />
                Start Scanner
              </Button>
            ) : (
              <Button
                onClick={stopScanning}
                variant="outline"
                className="flex-1"
                size={isMobile ? "default" : "lg"}
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
              size={isMobile ? "default" : "lg"}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              {scannedItems.length > 0
                ? `Add ${scannedItems.length} to Cart`
                : "Close"}
            </Button>
          </div>

          {/* Fallback Capture Button for Mobile */}
          {isMobile && isScanning && (
            <Button
              onClick={() => captureMultipleAndDecode(5, 150, 1.5)}
              variant="outline"
              size="sm"
              className="w-full text-xs"
            >
              <Camera className="h-3 w-3 mr-1" />
              Capture Still Image (Fallback)
            </Button>
          )}

          {/* POS-Specific Tips */}
          <div className="text-xs text-muted-foreground bg-muted/30 p-2 sm:p-3 rounded-lg">
            <div className="font-medium mb-1">POS Scanning Tips:</div>
            <ul className="space-y-1">
              <li>• Products are automatically added to cart when scanned</li>
              <li>• Scan multiple items quickly without closing</li>
              <li>• Use "Add to Cart" when done scanning multiple items</li>
              {!isMobile && (
                <li>
                  • "No barcode detected" messages are normal between scans
                </li>
              )}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ScannerDialog;
