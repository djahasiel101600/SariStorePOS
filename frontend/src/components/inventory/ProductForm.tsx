// src/components/inventory/ProductForm.tsx
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Product } from "@/types";
import { useCreateProduct, useUpdateProduct, useProducts } from "@/hooks/api";
import { toast } from "sonner";
import { Loader2, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  barcode: z.string().optional(),
  price: z.number().min(0, "Price must be positive"),
  cost_price: z.number().min(0, "Cost price must be positive"),
  stock_quantity: z.number().int().min(0, "Stock must be positive"),
  min_stock_level: z
    .number()
    .int()
    .min(0, "Minimum stock level must be positive"),
  category: z.string().optional(),
  is_active: z.boolean(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
}

const ProductForm: React.FC<ProductFormProps> = ({
  open,
  onOpenChange,
  product,
}) => {
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const isEditing = !!product;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          name: product.name,
          barcode: product.barcode || "",
          price: product.price,
          cost_price: product.cost_price,
          stock_quantity: product.stock_quantity,
          min_stock_level: product.min_stock_level,
          category: product.category || "",
          is_active: true,
        }
      : {
          stock_quantity: 0,
          min_stock_level: 5,
        },
  });

  useEffect(() => {
    if (open && product) {
      // Editing existing product - populate form with current data
      reset({
        name: product.name || "",
        barcode: product.barcode || "",
        category: product.category || "",
        price: product.price || 0,
        cost_price: product.cost_price || 0,
        stock_quantity: product.stock_quantity || 0,
        min_stock_level: product.min_stock_level || 5,
      });

      // Reset image state
      setImage(null);
      setImagePreview(product.image || "");
    } else if (open && !product) {
      // Adding new product - clear the form
      reset({
        name: "",
        barcode: "",
        category: "",
        price: 0,
        cost_price: 0,
        stock_quantity: 0,
        min_stock_level: 5,
      });

      // Clear image state
      setImage(null);
      setImagePreview("");
    }
  }, [open, product, reset]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview("");
  };

  const onSubmit = async (data: ProductFormData) => {
    try {
      const formData = new FormData();

      // Append form data
      Object.entries(data).forEach(([key, value]) => {
        formData.append(key, value.toString());
      });

      // Append image if selected
      if (image) {
        formData.append("image", image);
      }

      if (isEditing && product) {
        await updateProduct.mutateAsync({ id: product.id, data: formData });
        toast.success("Product updated successfully");
      } else {
        await createProduct.mutateAsync(formData);
        toast.success("Product created successfully");
      }

      handleClose();
    } catch (error) {
      toast.error(`Failed to ${isEditing ? "update" : "create"} product`);
    }
  };

  const handleClose = () => {
    reset();
    setImage(null);
    setImagePreview("");
    onOpenChange(false);
  };

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
          {/* Image Upload */}
          <div>
            <Label htmlFor="image">Product Image</Label>
            <div className="mt-2">
              {imagePreview ? (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-32 w-32 object-cover rounded-lg border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={removeImage}
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
              />
            </div>
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="Enter product name"
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="barcode">Barcode</Label>
              <Input
                id="barcode"
                {...register("barcode")}
                placeholder="Optional barcode"
              />
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                {...register("category")}
                placeholder="e.g., Snacks, Drinks"
              />
            </div>

            <div>
              <Label htmlFor="price">Selling Price (₱) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                {...register("price", { valueAsNumber: true })}
                placeholder="0.00"
              />
              {errors.price && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.price.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="cost_price">Cost Price (₱) *</Label>
              <Input
                id="cost_price"
                type="number"
                step="0.01"
                {...register("cost_price", { valueAsNumber: true })}
                placeholder="0.00"
              />
              {errors.cost_price && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.cost_price.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="stock_quantity">Current Stock *</Label>
              <Input
                id="stock_quantity"
                type="number"
                {...register("stock_quantity", { valueAsNumber: true })}
                placeholder="0"
              />
              {errors.stock_quantity && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.stock_quantity.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="min_stock_level">Low Stock Alert Level *</Label>
              <Input
                id="min_stock_level"
                type="number"
                {...register("min_stock_level", { valueAsNumber: true })}
                placeholder="5"
              />
              {errors.min_stock_level && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.min_stock_level.message}
                </p>
              )}
            </div>
          </div>

          {/* Profit Margin Display */}
          {isEditing && product && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900">Profit Information</h4>
              <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                <span>Profit Margin:</span>
                <span className="font-semibold text-green-600">
                  {product.profit_margin.toFixed(1)}%
                </span>
                <span>Profit per Item:</span>
                <span className="font-semibold text-green-600">
                  ₱{(product.price - product.cost_price).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
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
