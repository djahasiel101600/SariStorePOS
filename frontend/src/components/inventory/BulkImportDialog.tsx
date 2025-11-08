// src/components/inventory/BulkImportDialog.tsx
import React, { useState, useRef } from "react";
import { useBulkImportProducts } from "@/hooks/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  AlertCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

interface PreviewRow {
  row: number;
  data: {
    name: string;
    price: number;
    stock_quantity: number;
    barcode?: string | null;
    category?: string;
    unit_type?: string;
    pricing_model?: string;
    cost_price?: number | null;
    min_stock_level?: number;
    image_url?: string | null;
  };
}

interface PreviewResponse {
  valid: boolean;
  preview?: PreviewRow[];
  total_rows?: number;
  download_images?: boolean;
  errors?: Array<{
    row: number;
    errors: string[];
    data: any;
  }>;
  error_rows?: number;
  valid_rows?: number;
}

interface ImportResponse {
  success: boolean;
  imported: number;
  skipped: number;
  total_rows: number;
  imported_products?: Array<{
    row: number;
    id: number;
    name: string;
  }>;
  skipped_products?: Array<{
    row: number;
    name: string;
    reason: string;
  }>;
}

const BulkImportDialog: React.FC<BulkImportDialogProps> = ({
  open,
  onOpenChange,
  onImportComplete,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [downloadImages, setDownloadImages] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bulkImportMutation = useBulkImportProducts();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
        toast.error("Please select a CSV file");
        return;
      }

      // Validate file size (5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (selectedFile.size > maxSize) {
        toast.error("File size must be less than 5MB");
        return;
      }

      setFile(selectedFile);
      setPreview(null);
      setImportResult(null);
    }
  };

  const handlePreview = async () => {
    if (!file) {
      toast.error("Please select a CSV file first");
      return;
    }

    setIsPreviewing(true);
    setPreview(null);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("download_images", downloadImages.toString());
      formData.append("preview_only", "true");

      const response = await fetch("/api/bulk-import-products/", {
        method: "POST",
        body: formData,
      });

      const data: PreviewResponse = await response.json();

      if (!response.ok) {
        if (data.errors && data.errors.length > 0) {
          // Show validation errors
          const errorMessages = data.errors
            .slice(0, 5)
            .map((err) => `Row ${err.row}: ${err.errors.join(", ")}`)
            .join("\n");
          toast.error(
            `Validation failed:\n${errorMessages}${
              data.errors.length > 5
                ? `\n... and ${data.errors.length - 5} more errors`
                : ""
            }`,
            { duration: 10000 }
          );
        } else {
          toast.error(data.error || "Failed to preview CSV file");
        }
        setPreview(data);
        return;
      }

      setPreview(data);
      toast.success(
        `Preview ready: ${data.total_rows} products will be imported`
      );
    } catch (error: any) {
      console.error("Preview error:", error);
      toast.error("Failed to preview CSV file");
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleImport = async () => {
    if (!file || !preview || !preview.valid) {
      toast.error("Please preview the CSV file first");
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("download_images", downloadImages.toString());
      formData.append("preview_only", "false");

      const response = await fetch("/api/bulk-import-products/", {
        method: "POST",
        body: formData,
      });

      const data: ImportResponse = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to import products");
        return;
      }

      setImportResult(data);
      toast.success(
        `Successfully imported ${data.imported} products${
          data.skipped > 0 ? ` (${data.skipped} skipped)` : ""
        }`
      );

      // Call completion callback
      if (onImportComplete) {
        onImportComplete();
      }

      // Close dialog after a short delay
      setTimeout(() => {
        handleReset();
        onOpenChange(false);
      }, 2000);
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error("Failed to import products");
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setImportResult(null);
    setDownloadImages(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDownloadTemplate = () => {
    // Create CSV template
    const headers = [
      "name",
      "price",
      "stock_quantity",
      "barcode",
      "category",
      "unit_type",
      "pricing_model",
      "cost_price",
      "min_stock_level",
      "image_url",
    ];
    const sampleRow = [
      "Sample Product",
      "100.00",
      "50",
      "1234567890123",
      "Electronics",
      "piece",
      "fixed_per_unit",
      "80.00",
      "10",
      "https://example.com/image.jpg",
    ];

    const csvContent = [
      headers.join(","),
      sampleRow.join(","),
      "", // Empty row for clarity
      "# Required fields: name, price, stock_quantity",
      "# Optional fields: barcode, category, unit_type, pricing_model, cost_price, min_stock_level, image_url",
      "# unit_type options: piece, kg, g, liter, ml, bundle, pack",
      "# pricing_model options: fixed_per_unit, fixed_per_weight, variable",
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "product_import_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Products</DialogTitle>
          <DialogDescription>
            Import multiple products from a CSV file. Maximum file size: 5MB,
            Maximum rows: 1000
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload Section */}
          {!preview && !importResult && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label htmlFor="csv-file" className="text-base font-medium">
                      Select CSV File
                    </Label>
                    <p className="text-sm text-gray-500 mt-1">
                      Required columns: name, price, stock_quantity
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadTemplate}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Template
                  </Button>
                </div>

                <div className="flex items-center gap-4">
                  <Input
                    ref={fileInputRef}
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="flex-1"
                  />
                  {file && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>{file.name}</span>
                      <span className="text-gray-400">
                        ({(file.size / 1024).toFixed(2)} KB)
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="download-images"
                    checked={downloadImages}
                    onCheckedChange={setDownloadImages}
                  />
                  <Label htmlFor="download-images" className="cursor-pointer">
                    Download images from URLs (if provided in CSV)
                  </Label>
                </div>

                {file && (
                  <Button
                    onClick={handlePreview}
                    disabled={isPreviewing}
                    className="w-full"
                  >
                    {isPreviewing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Previewing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Preview CSV
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Validation Errors */}
          {preview && !preview.valid && preview.errors && (
            <Card className="border-red-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <h3 className="font-semibold text-red-600">
                    Validation Failed
                  </h3>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {preview.errors.slice(0, 10).map((error, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-red-50 border border-red-200 rounded text-sm"
                    >
                      <div className="font-medium text-red-800">
                        Row {error.row}:
                      </div>
                      <ul className="list-disc list-inside text-red-700 mt-1">
                        {error.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {preview.errors.length > 10 && (
                    <div className="text-sm text-gray-600 text-center">
                      ... and {preview.errors.length - 10} more errors
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Preview Section */}
          {preview && preview.valid && !importResult && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold">
                      Preview ({preview.total_rows} products)
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-green-600">
                    Ready to Import
                  </Badge>
                </div>

                <div className="max-h-96 overflow-y-auto border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Row</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Unit Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.preview?.slice(0, 50).map((row) => (
                        <TableRow key={row.row}>
                          <TableCell className="font-medium">
                            {row.row}
                          </TableCell>
                          <TableCell>{row.data.name}</TableCell>
                          <TableCell>
                            {formatCurrency(row.data.price)}
                          </TableCell>
                          <TableCell>{row.data.stock_quantity}</TableCell>
                          <TableCell>{row.data.category || "-"}</TableCell>
                          <TableCell>
                            {row.data.unit_type || "piece"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {preview.preview && preview.preview.length > 50 && (
                    <div className="p-4 text-center text-sm text-gray-500">
                      Showing first 50 of {preview.preview.length} products
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleImport}
                  disabled={isImporting}
                  className="w-full"
                  size="lg"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Confirm & Import {preview.total_rows} Products
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Import Results */}
          {importResult && (
            <Card className="border-green-200">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-green-600">
                    Import Complete
                  </h3>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded">
                    <div className="text-2xl font-bold text-green-600">
                      {importResult.imported}
                    </div>
                    <div className="text-sm text-gray-600">Imported</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded">
                    <div className="text-2xl font-bold text-yellow-600">
                      {importResult.skipped}
                    </div>
                    <div className="text-sm text-gray-600">Skipped</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded">
                    <div className="text-2xl font-bold text-blue-600">
                      {importResult.total_rows}
                    </div>
                    <div className="text-sm text-gray-600">Total</div>
                  </div>
                </div>

                {importResult.skipped_products &&
                  importResult.skipped_products.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Skipped Products:</h4>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {importResult.skipped_products.map((item, idx) => (
                          <div
                            key={idx}
                            className="text-sm p-2 bg-yellow-50 rounded border border-yellow-200"
                          >
                            <span className="font-medium">Row {item.row}:</span>{" "}
                            {item.name} - {item.reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              handleReset();
              onOpenChange(false);
            }}
            disabled={isImporting}
          >
            {importResult ? "Close" : "Cancel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkImportDialog;

