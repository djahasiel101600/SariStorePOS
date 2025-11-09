# backend/inventory/admin.py
from django.contrib import admin
from decimal import Decimal
from django.db.models import Sum, F, ExpressionWrapper, DecimalField
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
    list_display = ['id', 'supplier', 'total_cost', 'computed_total', 'date_created']
    readonly_fields = ['computed_total']
    inlines = [PurchaseItemInline]

    def computed_total(self, obj):
        """Compute running total from purchase items: sum(unit_cost * quantity).
        Uses Django ORM aggregation for efficiency."""
        qs = PurchaseItem.objects.filter(purchase=obj).aggregate(
            total=Sum(ExpressionWrapper(F('unit_cost') * F('quantity'), output_field=DecimalField()))
        )
        total = qs.get('total') or Decimal('0')
        # Return Decimal; admin will format it
        return total
    computed_total.short_description = 'Computed Total (items)'