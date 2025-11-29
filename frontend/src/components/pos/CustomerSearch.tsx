// src/components/pos/CustomerSearch.tsx
import React, { useState, useRef, useEffect } from "react";
import { useCustomers, useCreateCustomer } from "@/hooks/api";
import { usePOS } from "@/hooks/use-pos";
import { Customer } from "@/types";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorHandling";
import { Search, User, UserPlus, X, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const CustomerSearch: React.FC = () => {
  const { data: customers, isLoading } = useCustomers();
  const createCustomer = useCreateCustomer();
  const { customer: selectedCustomer, setCustomer } = usePOS();

  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter customers based on search query
  const filteredCustomers =
    customers?.filter(
      (customer) =>
        customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.email?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectCustomer = (customer: Customer) => {
    setCustomer(customer);
    setSearchQuery(customer.name);
    setIsDropdownOpen(false);
    toast.success(`Customer selected: ${customer.name}`);
  };

  const handleClearCustomer = () => {
    setCustomer(null);
    setSearchQuery("");
    searchInputRef.current?.focus();
  };

  const handleQuickAddCustomer = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a customer name");
      return;
    }

    setIsAddingCustomer(true);
    try {
      const newCustomer = await createCustomer.mutateAsync({
        name: searchQuery.trim(),
        phone: "",
        email: "",
      });

      setCustomer(newCustomer);
      setIsDropdownOpen(false);
      toast.success(`Customer "${newCustomer.name}" added successfully`);
    } catch (error) {
      console.error("Quick add customer error:", error);
      toast.error(getErrorMessage(error));
    } finally {
      setIsAddingCustomer(false);
    }
  };

  const handleInputFocus = () => {
    setIsDropdownOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (!isDropdownOpen) {
      setIsDropdownOpen(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      e.preventDefault();

      // If there are filtered customers, select the first one
      if (filteredCustomers.length > 0) {
        handleSelectCustomer(filteredCustomers[0]);
      } else {
        // No existing customers, quick add new customer
        handleQuickAddCustomer();
      }
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          ref={searchInputRef}
          placeholder={
            selectedCustomer
              ? selectedCustomer.name
              : "Search customer (Enter to select)..."
          }
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          className="pl-10 pr-20"
          disabled={!!selectedCustomer}
        />

        {selectedCustomer && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearCustomer}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Selected Customer Badge */}
      {selectedCustomer && (
        <div className="mt-2 flex items-center gap-2 text-sm">
          <Badge variant="secondary" className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {selectedCustomer.name}
          </Badge>
          {selectedCustomer.phone && (
            <span className="text-gray-600">📞 {selectedCustomer.phone}</span>
          )}
        </div>
      )}

      {/* Dropdown Results */}
      {isDropdownOpen && !selectedCustomer && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 mt-1 max-h-60 overflow-y-auto">
          {/* Existing Customers */}
          {searchQuery && filteredCustomers.length > 0 && (
            <div className="p-2">
              <div className="text-xs font-medium text-gray-500 px-2 py-1">
                EXISTING CUSTOMERS
              </div>
              {filteredCustomers.slice(0, 5).map((customer) => (
                <button
                  key={customer.id}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 flex items-center justify-between"
                  onClick={() => handleSelectCustomer(customer)}
                >
                  <div>
                    <div className="font-medium">{customer.name}</div>
                    <div className="text-sm text-gray-600">
                      {customer.phone && `📞 ${customer.phone}`}
                      {customer.phone && customer.email && " • "}
                      {customer.email && `✉️ ${customer.email}`}
                    </div>
                  </div>
                  <Check className="h-4 w-4 text-green-600" />
                </button>
              ))}
            </div>
          )}

          {/* Quick Add Option */}
          {searchQuery && (
            <div className="border-t p-2">
              <button
                className="w-full text-left px-3 py-2 rounded-md hover:bg-blue-50 flex items-center gap-2 text-blue-600"
                onClick={handleQuickAddCustomer}
                disabled={isAddingCustomer}
              >
                {isAddingCustomer ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                <span>
                  {isAddingCustomer
                    ? "Adding..."
                    : `Add "${searchQuery}" as new customer`}
                </span>
              </button>
            </div>
          )}

          {/* No Results */}
          {searchQuery && filteredCustomers.length === 0 && (
            <div className="p-4 text-center text-gray-500">
              <User className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>No customers found</p>
              <p className="text-sm">Add new customer using button below</p>
            </div>
          )}

          {/* Browse All Customers */}
          {!searchQuery && (
            <div className="p-4 text-center text-gray-500">
              <User className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>Search for customers by name, phone, or email</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerSearch;
