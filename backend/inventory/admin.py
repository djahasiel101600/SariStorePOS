# backend/inventory/admin.py
from django.contrib import admin
from .models import Product, Customer, Sale, SaleItem, Purchase, PurchaseItem

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'barcode', 'price', 'cost_price', 'stock_quantity', 'min_stock_level', 'needs_restock', 'category']
    list_filter = ['category', 'is_active']
    search_fields = ['name', 'barcode']
    list_editable = ['price', 'stock_quantity', 'min_stock_level']

@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ['name', 'phone', 'email', 'total_purchases', 'created_at']
    search_fields = ['name', 'phone', 'email']

class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 1

@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ['id', 'customer', 'total_amount', 'payment_method', 'date_created']
    list_filter = ['payment_method', 'date_created']
    inlines = [SaleItemInline]

class PurchaseItemInline(admin.TabularInline):
    model = PurchaseItem
    extra = 1

@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display = ['id', 'supplier', 'total_cost', 'date_created']
    inlines = [PurchaseItemInline]