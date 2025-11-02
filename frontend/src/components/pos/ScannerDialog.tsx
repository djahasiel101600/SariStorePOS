import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { BrowserMultiFormatReader, Result, DecodeHintType } from '@zxing/library';

interface ScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (decodedText: string) => void;
  keepOpenAfterScan?: boolean;
}

interface CameraDevice {
  deviceId: string;
  label: string;
  isBackFacing: boolean;
}

interface ScanResult {
  text: string;
  format: string;
  timestamp: number;
}

const ScannerDialog: React.FC<ScannerDialogProps> = ({ 
  open, 
  onOpenChange, 
  onScan, 
  keepOpenAfterScan = false 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const lastScanRef = useRef<string>('');
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const lastResultTimeRef = useRef<number>(0);

  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'scanning' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string>('');
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [scanCount, setScanCount] = useState<number>(0);

  // Enhanced cleanup function
  const cleanup = useCallback(() => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }

    try {
      codeReaderRef.current?.reset();
      codeReaderRef.current = null;
    } catch (e) {
      console.warn('Error resetting code reader:', e);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    retryCountRef.current = 0;
  }, []);

  // Check if error is a normal "no barcode found" exception
  const isNotFoundException = (error: any): boolean => {
    return error && 
      (error.name === 'NotFoundException' || 
       error.message?.includes('NotFoundException') ||
       error.message?.includes('No MultiFormat Readers') ||
       error.message?.includes('detect the code'));
  };

  // Process scan result with validation and debouncing
  const processScanResult = useCallback((result: Result) => {
    const now = Date.now();
    const text = result.getText().trim();
    
    // Validate result
    if (!text) {
      console.debug('Empty scan result');
      return false;
    }

    // Debounce: prevent multiple scans of the same code within 1 second
    if (now - lastResultTimeRef.current < 1000 && lastScanRef.current === text) {
      console.debug('Duplicate scan ignored');
      return false;
    }

    // Update refs and state
    lastScanRef.current = text;
    lastResultTimeRef.current = now;

    const scanResult: ScanResult = {
      text,
      format: result.getBarcodeFormat().toString(),
      timestamp: now
    };

    setLastResult(scanResult);
    setScanCount(prev => prev + 1);
    setStatus('success');

    console.log('✅ Barcode scanned:', { text, format: scanResult.format });

    // Call the parent's onScan callback
    onScan(text);

    // Auto-close if not in continuous mode
    if (!keepOpenAfterScan) {
      setTimeout(() => {
        onOpenChange(false);
      }, 500);
    }

    return true;
  }, [onScan, onOpenChange, keepOpenAfterScan]);

  // Request camera permissions and list devices
  const initializeDevices = useCallback(async () => {
    if (!open) return;

    setStatus('loading');
    setError('');
    setLastResult(null);

    try {
      const permissionPromise = navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: 60
        },
      });
      
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Camera permission timeout')), 10000)
      );

      const stream = await Promise.race([permissionPromise, timeoutPromise]);
      stream.getTracks().forEach(track => track.stop());

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
          isBackFacing: /back|rear|environment/gi.test(device.label || '')
        }));

      if (videoDevices.length === 0) {
        throw new Error('No cameras found on this device');
      }

      setDevices(videoDevices);

      const backCamera = videoDevices.find(d => d.isBackFacing);
      const initialDeviceId = backCamera?.deviceId || videoDevices[0].deviceId;
      setSelectedDeviceId(initialDeviceId);

    } catch (err: any) {
      console.error('Device initialization error:', err);
      setStatus('error');
      setError(
        err?.message?.includes('Permission') || err?.name === 'NotAllowedError'
          ? 'Camera access denied. Please allow camera permissions in your browser settings and refresh the page.'
          : err?.message?.includes('timeout')
          ? 'Camera is taking too long to respond. Please check if another app is using the camera.'
          : 'Cannot access camera. Please ensure your device has a working camera and try again.'
      );
    }
  }, [open]);

  // Initialize ZXing reader with optimized settings
  const initializeReader = useCallback(() => {
    const hints = new Map<DecodeHintType, any>();
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      'EAN_8', 'EAN_13', 'UPC_A', 'UPC_E'
    ]);

    const reader = new BrowserMultiFormatReader(hints);
    codeReaderRef.current = reader;
    return reader;
  }, []);

  // Start scanning with selected device
  const startScanning = useCallback(async () => {
    if (!open || !selectedDeviceId || !videoRef.current) {
      return;
    }

    cleanup();
    setStatus('loading');
    setError('');
    setLastResult(null);

    try {
      const reader = initializeReader();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: selectedDeviceId },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 60, min: 24 },
          aspectRatio: { ideal: 1.7777777778 },
          // focusMode: 'continuous'
        }
      });

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Wait for video to be ready
      await new Promise<void>((resolve) => {
        if (!videoRef.current) {
          resolve();
          return;
        }

        if (videoRef.current.readyState >= 3) {
          resolve();
        } else {
          const onLoaded = () => {
            videoRef.current?.removeEventListener('loadeddata', onLoaded);
            resolve();
          };
          videoRef.current.addEventListener('loadeddata', onLoaded);
          
          setTimeout(() => {
            videoRef.current?.removeEventListener('loadeddata', onLoaded);
            resolve();
          }, 2000);
        }
      });

      setStatus('scanning');
      console.log('🎥 Camera started, ready for scanning...');

      // Start decoding with PROPER error handling
      await reader.decodeFromVideoDevice(
        selectedDeviceId,
        videoRef.current,
        (result: Result | undefined, error: Error | undefined) => {
          if (result) {
            console.log('📷 Barcode detected, processing...');
            const success = processScanResult(result);
            if (success && !keepOpenAfterScan) {
              setTimeout(() => {
                cleanup();
              }, 1000);
            }
          }
          console.log("Frame checked", { result, error });
          

          // This is the key fix: Only log real errors, not NotFoundException
          if (error && !isNotFoundException(error)) {
            console.warn('Real scan error (not NotFoundException):', error);
            setError(`Scanning error: ${error.message}`);
          }
          
          // Normal NotFoundException - just ignore it, don't log as error
          if (error && isNotFoundException(error)) {
            // This is normal - no barcode detected in current frame
            // Don't log this to avoid console spam
            return;
          }
        }
      );

    } catch (err: any) {
      console.error('Real scanning error (not NotFoundException):', err);
      setStatus('error');
      setError(
        err?.message?.includes('NotReadableError') || err?.message?.includes('NotFoundError')
          ? `Camera "${devices.find(d => d.deviceId === selectedDeviceId)?.label || selectedDeviceId}" is not available. It might be in use by another application.`
          : 'Failed to start camera. Please try selecting a different camera or check camera permissions.'
      );

      if (retryCountRef.current < 3) {
        retryCountRef.current++;
        scanTimeoutRef.current = setTimeout(() => {
          startScanning();
        }, 1000 * retryCountRef.current);
      }
    }
  }, [open, selectedDeviceId, devices, keepOpenAfterScan, cleanup, initializeReader, processScanResult]);

  // Effect for device initialization
  useEffect(() => {
    if (open) {
      initializeDevices();
    } else {
      cleanup();
      setStatus('idle');
      setLastResult(null);
    }
  }, [open, initializeDevices, cleanup]);

  // Effect for starting/stopping scanning when device changes
  useEffect(() => {
    if (open && selectedDeviceId) {
      startScanning();
    }

    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, [open, selectedDeviceId, startScanning]);

  // Manual retry function
  const handleRetry = useCallback(() => {
    retryCountRef.current = 0;
    setLastResult(null);
    if (selectedDeviceId) {
      startScanning();
    } else {
      initializeDevices();
    }
  }, [selectedDeviceId, startScanning, initializeDevices]);

  // Continue scanning after successful scan (for keepOpenAfterScan mode)
  const handleContinueScanning = useCallback(() => {
    setStatus('scanning');
    setLastResult(null);
  }, []);

  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDeviceId = e.target.value;
    setSelectedDeviceId(newDeviceId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px]">
        <DialogHeader>
          <DialogTitle>Scan Barcode</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Camera Selection */}
          <div className="space-y-2">
            <Label htmlFor="camera-select">Camera</Label>
            <select
              id="camera-select"
              className="w-full border rounded-lg h-10 px-3 disabled:opacity-50 bg-background"
              value={selectedDeviceId}
              onChange={handleDeviceChange}
              disabled={status === 'loading' || devices.length === 0}
            >
              {devices.length === 0 && (
                <option value="">No cameras available</option>
              )}
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label} {device.isBackFacing ? '(Rear)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Scanner View */}
          <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border-2 border-border">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted
              playsInline
              autoPlay
            />
            
            {/* Scanning Overlay */}
            {status === 'scanning' && (
              <div className="absolute inset-0 flex flex-col items-center justify-between p-4">
                <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                  🔍 Scanning... ({scanCount} found)
                </div>
                <div className="border-2 border-blue-400 border-dashed rounded-lg w-48 h-32 opacity-80"></div>
                <div className="text-white text-center text-sm bg-black/60 px-3 py-2 rounded-lg">
                  Point camera at barcode
                  <div className="text-xs opacity-80 mt-1">No barcode detected yet - this is normal</div>
                </div>
              </div>
            )}

            {/* Success Overlay */}
            {status === 'success' && lastResult && (
              <div className="absolute inset-0 flex items-center justify-center bg-green-500/90">
                <div className="text-center text-white p-6">
                  <div className="text-2xl mb-2">✅</div>
                  <div className="text-lg font-semibold mb-2">Barcode Scanned!</div>
                  <div className="font-mono text-lg mb-2 bg-white/20 px-3 py-2 rounded">
                    {lastResult.text}
                  </div>
                  <div className="text-sm opacity-90 mb-4">
                    Format: {lastResult.format}
                  </div>
                  {keepOpenAfterScan && (
                    <Button 
                      onClick={handleContinueScanning}
                      variant="outline"
                      className="text-green-600 border-white text-white hover:bg-white/20"
                    >
                      Scan Another
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Loading State */}
            {status === 'loading' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-center text-white">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-3"></div>
                  <p>Initializing camera...</p>
                </div>
              </div>
            )}

            {/* Error State */}
            {status === 'error' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-center text-white p-4">
                  <div className="text-red-400 text-lg mb-2">⚠️</div>
                  <p className="mb-3">{error}</p>
                  <Button onClick={handleRetry} variant="outline" size="sm">
                    Try Again
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Status Information */}
          <div className="text-sm text-muted-foreground">
            {status === 'scanning' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span>Scanning for barcodes... Move camera closer to barcode if having trouble.</span>
                </div>
              </div>
            )}
            {status === 'success' && lastResult && !keepOpenAfterScan && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="text-green-500">✓</div>
                  <span>Barcode scanned successfully! Dialog will close automatically.</span>
                </div>
              </div>
            )}
          </div>

          {/* Last Result Display (when not in success overlay) */}
          {status !== 'success' && lastResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm text-green-800 font-medium">Last Scan:</div>
                  <div className="font-mono text-lg">{lastResult.text}</div>
                  <div className="text-xs text-green-600">Format: {lastResult.format}</div>
                </div>
                <div className="text-2xl text-green-500">✓</div>
              </div>
            </div>
          )}

          {/* Help Text */}
          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <strong>Tips for better scanning:</strong>
            <ul className="mt-1 space-y-1">
              <li>• Ensure good lighting on the barcode</li>
              <li>• Hold device steady 10-20cm from barcode</li>
              <li>• "No barcode detected" messages are normal while scanning</li>
              <li>• Try different camera if scanning fails consistently</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {scanCount > 0 && (
              <span>Scanned: {scanCount}</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRetry} disabled={status === 'loading'}>
              Restart Scanner
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ScannerDialog;