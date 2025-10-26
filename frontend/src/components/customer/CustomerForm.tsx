// src/components/customers/CustomerForm.tsx
import React, { useEffect } from "react"; // Add useEffect import
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Customer } from "@/types";
import { useCreateCustomer, useUpdateCustomer } from "@/hooks/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const customerSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
});

type CustomerFormData = z.infer<typeof customerSchema>;

interface CustomerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Customer | null;
}

const CustomerForm: React.FC<CustomerFormProps> = ({
  open,
  onOpenChange,
  customer,
}) => {
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();

  const isEditing = !!customer;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue, // Add setValue for manual field updates
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
    },
  });

  // Reset form when customer changes or dialog opens/closes
  useEffect(() => {
    if (open && customer) {
      // Editing existing customer - populate form with current data
      reset({
        name: customer.name || "",
        phone: customer.phone || "",
        email: customer.email || "",
      });
    } else if (open && !customer) {
      // Adding new customer - clear the form
      reset({
        name: "",
        phone: "",
        email: "",
      });
    }
  }, [open, customer, reset]); // Add reset to dependencies

  const onSubmit = async (data: CustomerFormData) => {
    try {
      if (isEditing && customer) {
        await updateCustomer.mutateAsync({ id: customer.id, data });
        toast.success("Customer updated successfully");
      } else {
        await createCustomer.mutateAsync(data);
        toast.success("Customer created successfully");
      }

      handleClose();
    } catch (error) {
      toast.error(`Failed to ${isEditing ? "update" : "create"} customer`);
    }
  };

  const handleClose = () => {
    reset(); // Clear form on close
    onOpenChange(false);
  };

  const isLoading = createCustomer.isPending || updateCustomer.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Customer" : "Add New Customer"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Customer Name *</Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="Enter customer name"
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              {...register("phone")}
              placeholder="Enter phone number"
            />
            {errors.phone && (
              <p className="text-red-500 text-sm mt-1">
                {errors.phone.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              {...register("email")}
              placeholder="Enter email address"
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">
                {errors.email.message}
              </p>
            )}
          </div>

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
                "Update Customer"
              ) : (
                "Create Customer"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerForm;
