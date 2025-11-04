// src/components/inventory/ProductForm.tsx
import React, { useState, useEffect, useCallback, Suspense } from "react";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Product } from "@/types";
import { useCreateProduct, useUpdateProduct } from "@/hooks/api";
import { toast } from "sonner";
import { Loader2, X, Upload, Barcode } from "lucide-react";
// Lazy load ScannerDialog for client-side only
const ScannerDialog = React.lazy(() => import("../pos/ScannerDialog"));
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Enhanced schema with better validation
const productSchema = z.object({
  name: z
    .string()
    .min(1, "Product name is required")
    .max(100, "Product name is too long"),
  barcode: z
    .union([z.string().max(50, "Barcode is too long"), z.literal(""), z.null()])
    .transform((val) => (val === "" ? null : val)),
  unit_type: z.enum(["piece", "kg", "g", "liter", "ml", "bundle", "pack"]),
  pricing_model: z.enum(["fixed_per_unit", "fixed_per_weight", "variable"]),
  price: z
    .union([
      z
        .number()
        .min(0.01, "Price must be at least ₱0.01")
        .max(999999.99, "Price is too high"),
      z.null(),
      z.undefined(),
    ])
    .optional(),
  cost_price: z
    .number()
    .min(0, "Cost price must be positive")
    .max(999999.99, "Cost price is too high")
    .nullable()
    .optional(),
  stock_quantity: z
    .number()
    .min(0, "Stock must be positive")
    .max(999999.999, "Stock quantity is too high"),
  min_stock_level: z
    .number()
    .min(0, "Minimum stock level must be positive")
    .max(9999.999, "Minimum stock level is too high"),
  category: z.string().max(50, "Category name is too long").optional(),
  is_active: z.boolean(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  prefillData?: Partial<Product> | null;
  categories?: string[];
}

// Default form values
const defaultFormValues: Partial<ProductFormData> = {
  stock_quantity: 0,
  min_stock_level: 5,
  price: 0,
  cost_price: 0,
  unit_type: "piece",
  pricing_model: "fixed_per_unit",
  is_active: true,
};

const ProductForm: React.FC<ProductFormProps> = ({
  open,
  onOpenChange,
  product,
  prefillData,
  categories = [],
}) => {
  // State for scanner dialog
  const [showScanner, setShowScanner] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [imageSource, setImageSource] = useState<"blob" | "server" | "none">("none");
  const [existingImagePath, setExistingImagePath] = useState<string | null>(null);
  const [isDownloadingImage, setIsDownloadingImage] = useState<boolean>(false);


  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const isEditing = !!product;

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
    setValue,
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: defaultFormValues,
    mode: "onChange",
  });

  // Calculate profit margin from watched values
  const price = watch("price") || 0;
  const costPrice = watch("cost_price") || 0;
  const pricingModel = watch("pricing_model");
  const unitType = watch("unit_type");
  const profitMargin =
    price > 0 && costPrice >= 0 ? ((price - costPrice) / price) * 100 : 0;

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (product) {
        // Editing existing product
        reset({
          name: product.name || "",
          barcode: product.barcode || "",
          category: product.category || "",
          price: product.price ?? null,
          cost_price: product.cost_price ?? null,
          stock_quantity: product.stock_quantity || 0,
          min_stock_level: product.min_stock_level || 5,
          unit_type: product.unit_type || "piece",
          pricing_model: product.pricing_model || "fixed_per_unit",
          is_active: product.is_active ?? true,
        });
        setImagePreview(product.image || "");
      } else if (prefillData) {
        // Creating new product with prefill data
        reset({
          name: prefillData.name || "",
          barcode: prefillData.barcode || "",
          category: prefillData.category || "",
          price: prefillData.price ?? null,
          cost_price: prefillData.cost_price ?? null,
          stock_quantity: prefillData.stock_quantity || 0,
          min_stock_level: prefillData.min_stock_level || 5,
          unit_type: prefillData.unit_type || "piece",
          pricing_model: prefillData.pricing_model || "fixed_per_unit",
          is_active: prefillData.is_active ?? true,
        });
        setImagePreview(prefillData.image || ""); //newly added: the image comes from the internet which means it is a url address

        // If prefillData includes a remote image URL (handle Open Food Facts shape), try to download it via backend
        const anyPrefill = prefillData as any;
        const remoteUrl = anyPrefill?.image
        
          console.log('Attempting to download remote image via backend:', prefillData.image);
          if (remoteUrl && typeof remoteUrl === 'string') {
          // set preview to remote url immediately
          setImagePreview(remoteUrl);
          setImageSource('server');

          // Call backend to download and save image, only if not already processed
          (async () => {
            setIsDownloadingImage(true);
            try {
              // Determine good name for saved file (handle product_name from Open Food Facts)
              const givenName = anyPrefill?.name || anyPrefill?.product_name || anyPrefill?.product?.product_name || anyPrefill?.product?.name || 'product';
              const resp = await fetch('/api/download-image/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: remoteUrl, name: givenName }),
              });

              if (!resp.ok) {
                // leave preview as remote URL; backend download may fail due to remote restrictions
                const text = await resp.text();
                console.warn('Backend image download failed', text);
                toast.error('Failed to download image from remote service');
                setIsDownloadingImage(false);
                return;
              }

              const data = await resp.json();
              if (data.image_url) {
                // Use the public URL returned by storage for preview
                setImagePreview(data.image_url);
                setImageSource('server');
                toast.success('Image downloaded and attached');
              }
              if (data.image_path) {
                // Save relative storage path to include in form submission when no file is selected
                setExistingImagePath(data.image_path);
              }
            } catch (err) {
              console.warn('Failed to download remote image via backend', err);
              toast.error('Error downloading image from remote service');
            } finally {
              setIsDownloadingImage(false);
            }
          })();
        }
      } else {
        // Adding new product
        reset(defaultFormValues);
        setImagePreview("");
      }
      setImage(null);
    }
  }, [open, product, reset]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    // Clean up previous blob URL
    if (imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setImage(file);
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
  };

  const removeImage = useCallback(() => {
    if (imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
    setImage(null);
    setImagePreview("");
  }, [imagePreview]);

  const prepareFormData = useCallback(
    (data: ProductFormData): FormData => {
      const formData = new FormData();

      // Append form data with proper type handling
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (typeof value === "boolean") {
            formData.append(key, value.toString());
          } else if (typeof value === "number") {
            formData.append(key, value.toString());
          } else {
            formData.append(key, value);
          }
        }
      });

      // Append image if selected
      if (image) {
        formData.append("image", image);
      } else if (existingImagePath) {
        // If backend already downloaded the image, attach the saved path so server can link it
  console.debug('Appending existing_image_path to FormData:', existingImagePath);
        formData.append('existing_image_path', existingImagePath);
      }

      return formData;
    },
  [image, existingImagePath]
  );

  const onSubmit = async (data: ProductFormData) => {
    try {
      const formData = prepareFormData(data);

      if (isEditing && product) {
        await updateProduct.mutateAsync({
          id: product.id,
          data: formData,
        });
        toast.success("Product updated successfully");
      } else {
        await createProduct.mutateAsync(formData);
        toast.success("Product created successfully");
      }

      handleClose();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : `Failed to ${isEditing ? "update" : "create"} product`;

      toast.error(errorMessage);
    }
  };

  const handleClose = useCallback(() => {
    reset();
    removeImage();
    onOpenChange(false);
  }, [reset, removeImage, onOpenChange]);

  const isLoading = createProduct.isPending || updateProduct.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Product" : "Add New Product"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Image Upload Section */}
          <div>
            <Label htmlFor="image-upload">Product Image</Label>
            <div className="mt-2">
              {imagePreview ? (
                <div className="relative inline-block w-32 h-32 sm:w-40 sm:h-40">
                  <img
                    src={imagePreview}
                    alt="Product preview"
                    className="h-full w-full object-cover rounded-lg border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={removeImage}
                    disabled={isLoading || isDownloadingImage}
                  >
                    <X className="h-3 w-3" />
                  </Button>

                  {isDownloadingImage && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-lg">
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    </div>
                  )}
                </div>
              ) : (
                <label
                  htmlFor="image-upload"
                  className="flex flex-col items-center justify-center w-32 h-32 sm:w-40 sm:h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors"
                >
                  <Upload className="h-8 w-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500">Upload Image</span>
                </label>
              )}
              {imageSource === 'server' && (
                <p className="text-xs text-gray-500 mt-2">
                  Remote image detected. It will be downloaded to the server and attached when you save.
                </p>
              )}
              <input
                id="image-upload"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                disabled={isLoading || isDownloadingImage}
              />
              <p className="text-xs text-gray-500 mt-1">
                Supports JPG, PNG, WEBP. Max 5MB.
              </p>
            </div>
          </div>

          {/* Basic Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Product Name */}
            <div className="md:col-span-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="Enter product name"
                disabled={isLoading}
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.name.message}
                </p>
              )}
            </div>
            {/* Barcode */}
            <div>
              <Label htmlFor="barcode">Barcode</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="barcode"
                  {...register("barcode")}
                  placeholder="Optional barcode"
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={isLoading}
                  onClick={() => setShowScanner(true)}
                  title="Scan barcode"
                >
                  <Barcode className="h-5 w-5" />
                </Button>
              </div>
              {errors.barcode && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.barcode.message}
                </p>
              )}
              {/* Scanner Dialog */}
              {typeof window !== "undefined" && showScanner && (
                <Suspense fallback={<div>Loading scanner...</div>}>
                  <ScannerDialog
                    openOnMount
                    onScan={(result: string) => {
                      setValue("barcode", result, { shouldDirty: true });
                      setShowScanner(false);
                    }}
                    autoCloseAfterScan
                    trigger={null}
                  />
                </Suspense>
              )}
            </div>
            {/* Category */}
            <div>
              <Label htmlFor="category">Category</Label>
              {categories.length > 0 ? (
                <Combobox
                  options={categories}
                  value={watch("category") || ""}
                  onChange={(val) =>
                    setValue("category", val, { shouldDirty: true })
                  }
                  placeholder="e.g., Snacks, Drinks"
                  disabled={isLoading}
                />
              ) : (
                <Input
                  id="category"
                  {...register("category")}
                  placeholder="e.g., Snacks, Drinks"
                  disabled={isLoading}
                />
              )}
              {errors.category && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.category.message}
                </p>
              )}
            </div>
            {/* Unit Type */}
            <div>
              <Label htmlFor="unit_type">Unit Type *</Label>
              <select
                id="unit_type"
                {...register("unit_type")}
                disabled={isLoading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="piece">Piece</option>
                <option value="kg">Kilogram (kg)</option>
                <option value="g">Gram (g)</option>
                <option value="liter">Liter (L)</option>
                <option value="ml">Milliliter (ml)</option>
                <option value="bundle">Bundle</option>
                <option value="pack">Pack</option>
              </select>
              {errors.unit_type && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.unit_type.message}
                </p>
              )}
            </div>
            {/* Pricing Model */}
            <div>
              <Label htmlFor="pricing_model">Pricing Model *</Label>
              <select
                id="pricing_model"
                {...register("pricing_model")}
                disabled={isLoading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="fixed_per_unit">Fixed Price Per Unit</option>
                <option value="fixed_per_weight">
                  Fixed Price Per Weight/Volume
                </option>
                <option value="variable">Variable Pricing</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {pricingModel === "variable"
                  ? "Price determined at sale time"
                  : pricingModel === "fixed_per_weight"
                    ? "Price per " +
                      (unitType === "kg"
                        ? "kilogram"
                        : unitType === "g"
                          ? "gram"
                          : unitType)
                    : "Fixed price per unit"}
              </p>
              {errors.pricing_model && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.pricing_model.message}
                </p>
              )}
            </div>
            {/* Selling Price */}
            <div>
              <Label htmlFor="price">
                {pricingModel === "variable"
                  ? "Suggested Price (₱)"
                  : "Selling Price (₱)"}
                {pricingModel !== "variable" && " *"}
              </Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                {...register("price", {
                  valueAsNumber: true,
                  setValueAs: (value) =>
                    value === "" ? null : parseFloat(value),
                })}
                placeholder={pricingModel === "variable" ? "Optional" : "0.00"}
                disabled={isLoading || pricingModel === "variable"}
                className={errors.price ? "border-red-500" : ""}
              />
              {errors.price && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.price.message}
                </p>
              )}
            </div>
            {/* Cost Price */}
            <div>
              <Label htmlFor="cost_price">Cost Price (₱) *</Label>
              <Input
                id="cost_price"
                type="number"
                step="0.01"
                min="0"
                {...register("cost_price", { valueAsNumber: true })}
                placeholder="0.00"
                disabled={isLoading}
                className={errors.cost_price ? "border-red-500" : ""}
              />
              {errors.cost_price && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.cost_price.message}
                </p>
              )}
            </div>
            {/* Current Stock */}
            <div>
              <Label htmlFor="stock_quantity">
                Current Stock ({unitType}) *
              </Label>
              <Input
                id="stock_quantity"
                type="number"
                step="0.001"
                min="0"
                {...register("stock_quantity", { valueAsNumber: true })}
                placeholder="0"
                disabled={isLoading}
                className={errors.stock_quantity ? "border-red-500" : ""}
              />
              {errors.stock_quantity && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.stock_quantity.message}
                </p>
              )}
            </div>
            {/* Minimum Stock Level */}
            <div>
              <Label htmlFor="min_stock_level">
                Low Stock Alert Level ({unitType}) *
              </Label>
              <Input
                id="min_stock_level"
                type="number"
                step="0.001"
                min="0"
                {...register("min_stock_level", { valueAsNumber: true })}
                placeholder="5"
                disabled={isLoading}
                className={errors.min_stock_level ? "border-red-500" : ""}
              />
              {errors.min_stock_level && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.min_stock_level.message}
                </p>
              )}
            </div>
          </div>

          {/* Profit Information & Active Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Profit Information */}
            <div className="p-3 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">
                Profit Information
              </h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Profit per Item:</span>
                  <span className="font-semibold text-green-600">
                    ₱{(price - costPrice).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Profit Margin:</span>
                  <span
                    className={`font-semibold ${
                      profitMargin >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {profitMargin.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Active Status */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label htmlFor="is_active" className="font-medium">
                  Product Status
                </Label>
                <p className="text-sm text-gray-500">
                  {watch("is_active")
                    ? "Active and visible"
                    : "Hidden from sales"}
                </p>
              </div>
              <Switch
                id="is_active"
                checked={watch("is_active")}
                onCheckedChange={(checked) => setValue("is_active", checked)}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || (!isDirty && !image && isEditing)}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {isEditing ? "Updating..." : "Creating..."}
                </>
              ) : isEditing ? (
                "Update Product"
              ) : (
                "Create Product"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProductForm;
