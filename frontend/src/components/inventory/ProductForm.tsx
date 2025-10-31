// src/components/inventory/ProductForm.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Product } from "@/types";
import { useCreateProduct, useUpdateProduct } from "@/hooks/api";
import { toast } from "sonner";
import { Loader2, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  name: z.string().min(1, "Product name is required").max(100, "Product name is too long"),
  barcode: z.union([z.string().max(50, "Barcode is too long"), z.literal(''), z.null()])
    .transform(val => (val === '' ? null : val)),
  price: z.number()
    .min(0.01, "Price must be at least ₱0.01")
    .max(999999.99, "Price is too high"),
  cost_price: z.number()
    .min(0, "Cost price must be positive")
    .max(999999.99, "Cost price is too high"),
  stock_quantity: z.number()
    .int("Stock must be a whole number")
    .min(0, "Stock must be positive")
    .max(999999, "Stock quantity is too high"),
  min_stock_level: z.number()
    .int("Minimum stock level must be a whole number")
    .min(0, "Minimum stock level must be positive")
    .max(9999, "Minimum stock level is too high"),
  category: z.string().max(50, "Category name is too long").optional(),
  is_active: z.boolean(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  prefillData?: Partial<Product> | null;
}

// Default form values
const defaultFormValues: Partial<ProductFormData> = {
  stock_quantity: 0,
  min_stock_level: 5,
  price: 0,
  cost_price: 0,
  is_active: true,
};

const ProductForm: React.FC<ProductFormProps> = ({
  open,
  onOpenChange,
  product,
  prefillData,
}) => {
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

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
  const price = watch("price");
  const costPrice = watch("cost_price");
  const profitMargin = price > 0 && costPrice >= 0 
    ? ((price - costPrice) / price) * 100 
    : 0;

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (imagePreview.startsWith('blob:')) {
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
          price: product.price || 0,
          cost_price: product.cost_price || 0,
          stock_quantity: product.stock_quantity || 0,
          min_stock_level: product.min_stock_level || 5,
          is_active: product.is_active ?? true,
        });
        setImagePreview(product.image || "");
      } else if (prefillData) {
          // Creating new product with prefill data
          reset({
            name: prefillData.name || "",
            barcode: prefillData.barcode || "",
            category: prefillData.category || "",
            price: prefillData.price || 0,
            cost_price: prefillData.cost_price || 0,
            stock_quantity: prefillData.stock_quantity || 0,
            min_stock_level: prefillData.min_stock_level || 5,
            is_active: prefillData.is_active ?? true,
          });
          setImagePreview("");
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
    if (!file.type.startsWith('image/')) {
      toast.error("Please select a valid image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    // Clean up previous blob URL
    if (imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }

    setImage(file);
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
  };

  const removeImage = useCallback(() => {
    if (imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    setImage(null);
    setImagePreview("");
  }, [imagePreview]);

  const prepareFormData = useCallback((data: ProductFormData): FormData => {
    const formData = new FormData();

    // Append form data with proper type handling
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (typeof value === 'boolean') {
          formData.append(key, value.toString());
        } else if (typeof value === 'number') {
          formData.append(key, value.toString());
        } else {
          formData.append(key, value);
        }
      }
    });

    // Append image if selected
    if (image) {
      formData.append("image", image);
    }

    return formData;
  }, [image]);

  const onSubmit = async (data: ProductFormData) => {
    try {
      const formData = prepareFormData(data);

      if (isEditing && product) {
        await updateProduct.mutateAsync({ 
          id: product.id, 
          data: formData 
        });
        toast.success("Product updated successfully");
      } else {
        await createProduct.mutateAsync(formData);
        toast.success("Product created successfully");
      }

      handleClose();
    } catch (error) {
      const errorMessage = error instanceof Error 
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
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Product preview"
                    className="h-32 w-32 object-cover rounded-lg border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={removeImage}
                    disabled={isLoading}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <label
                  htmlFor="image-upload"
                  className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors"
                >
                  <Upload className="h-8 w-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500">Upload Image</span>
                </label>
              )}
              <input
                id="image-upload"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                disabled={isLoading}
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
              <Input
                id="barcode"
                {...register("barcode")}
                placeholder="Optional barcode"
                disabled={isLoading}
              />
              {errors.barcode && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.barcode.message}
                </p>
              )}
            </div>

            {/* Category */}
            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                {...register("category")}
                placeholder="e.g., Snacks, Drinks"
                disabled={isLoading}
              />
              {errors.category && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.category.message}
                </p>
              )}
            </div>

            {/* Selling Price */}
            <div>
              <Label htmlFor="price">Selling Price (₱) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0.01"
                {...register("price", { 
                  valueAsNumber: true,
                  min: 0.01
                })}
                placeholder="0.00"
                disabled={isLoading}
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
              <Label htmlFor="stock_quantity">Current Stock *</Label>
              <Input
                id="stock_quantity"
                type="number"
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
              <Label htmlFor="min_stock_level">Low Stock Alert Level *</Label>
              <Input
                id="min_stock_level"
                type="number"
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
              <h4 className="font-medium text-blue-900 mb-2">Profit Information</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Profit per Item:</span>
                  <span className="font-semibold text-green-600">
                    ₱{(price - costPrice).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Profit Margin:</span>
                  <span className={`font-semibold ${
                    profitMargin >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
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
                  {watch("is_active") ? "Active and visible" : "Hidden from sales"}
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