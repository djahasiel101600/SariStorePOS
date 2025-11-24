from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from django.db.models import Sum, F, DecimalField, ExpressionWrapper
from decimal import Decimal
from .models import Product, Customer, Sale, SaleItem, Purchase, PurchaseItem, UserProfile, AuditLog

# Custom Admin Site with Role-Based Access
class RoleBasedAdminSite(admin.AdminSite):
    def has_permission(self, request):
        """
        Only allow access to users with specific roles
        """
        return (
            request.user.is_active and 
            request.user.is_staff and
            hasattr(request.user, 'profile') and
            request.user.profile.role in ['admin', 'manager']
        )

# Register your custom models here.

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'barcode', 'price', 'cost_price', 'stock_quantity', 'min_stock_level', 'needs_restock', 'category']
    list_filter = ['category', 'is_active']
    search_fields = ['name', 'barcode']
    list_editable = ['price', 'stock_quantity', 'min_stock_level']
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # Inventory managers can only see products, not modify sensitive fields
        if hasattr(request.user, 'profile') and request.user.profile.role == 'inventory_manager':
            self.list_editable = ['stock_quantity', 'min_stock_level']  # Remove price editing
        return qs
    
    def get_list_editable(self, request):
        """
        Dynamic list_editable based on user role
        """
        if hasattr(request.user, 'profile'):
            if request.user.profile.role == 'cashier':
                return []  # Cashiers can't edit products
            elif request.user.profile.role == 'inventory_manager':
                return ['stock_quantity', 'min_stock_level']  # Can only update stock levels
            elif request.user.profile.role in ['admin', 'manager']:
                return ['price', 'stock_quantity', 'min_stock_level']  # Full access
        return self.list_editable

@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ['name', 'phone', 'email', 'total_purchases', 'created_at']
    search_fields = ['name', 'phone', 'email']
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # Cashiers can only view customers, not modify
        if hasattr(request.user, 'profile') and request.user.profile.role == 'cashier':
            self.readonly_fields = [field.name for field in Customer._meta.fields]
        return qs

class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 1
    readonly_fields = ['line_total']
    
    def line_total(self, obj):
        if obj.quantity and obj.unit_price:
            return obj.quantity * obj.unit_price
        return Decimal('0.00')
    line_total.short_description = 'Line Total'

@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ['id', 'customer', 'cashier', 'total_amount', 'payment_method', 'date_created']
    list_filter = ['payment_method', 'date_created', 'cashier']
    readonly_fields = ['date_created', 'computed_total']
    inlines = [SaleItemInline]
    
    # Add cashier to search fields for accountability
    search_fields = ['id', 'customer__name', 'cashier__username']
    
    def computed_total(self, obj):
        """Display computed total from sale items for verification"""
        total = sum(item.quantity * item.unit_price for item in obj.saleitem_set.all())
        return f"${total:.2f}"
    computed_total.short_description = 'Verified Total (from items)'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # Cashiers can only see their own sales
        if hasattr(request.user, 'profile') and request.user.profile.role == 'cashier':
            return qs.filter(cashier=request.user)
        return qs
    
    def save_model(self, request, obj, form, change):
        """Automatically set cashier when creating new sales"""
        if not obj.pk:  # If creating new sale
            obj.cashier = request.user
        super().save_model(request, obj, form, change)

class PurchaseItemInline(admin.TabularInline):
    model = PurchaseItem
    extra = 1
    readonly_fields = ['line_total']
    
    def line_total(self, obj):
        if obj.quantity and obj.unit_cost:
            return obj.quantity * obj.unit_cost
        return Decimal('0.00')
    line_total.short_description = 'Line Total'

@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display = ['id', 'supplier', 'total_cost', 'computed_total', 'date_created']
    readonly_fields = ['computed_total', 'date_created']
    inlines = [PurchaseItemInline]
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # Only admin and inventory managers can access purchases
        if hasattr(request.user, 'profile') and request.user.profile.role == 'cashier':
            return qs.none()  # Cashiers can't see purchases
        return qs

    def computed_total(self, obj):
        """Optimized computed total using aggregation"""
        from django.db.models import Sum
        total = obj.purchaseitem_set.aggregate(
            total=Sum(F('unit_cost') * F('quantity'))
        )['total'] or Decimal('0.00')
        return total
    computed_total.short_description = 'Computed Total (items)'

# User Profile Inline for User Admin
class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = 'Employee Profile'
    fields = ['role', 'employee_id', 'is_active_employee']
    readonly_fields = ['created_at', 'updated_at']

# Custom User Admin
class CustomUserAdmin(UserAdmin):
    inlines = (UserProfileInline,)
    list_display = ('username', 'email', 'first_name', 'last_name', 'get_role', 'is_active', 'is_staff')
    list_filter = ('profile__role', 'is_active', 'is_staff', 'date_joined')
    
    def get_role(self, obj):
        return obj.profile.get_role_display() if hasattr(obj, 'profile') and obj.profile.role else 'No role'
    get_role.short_description = 'Role'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # Managers can only see cashiers and inventory managers, not other admins
        if hasattr(request.user, 'profile') and request.user.profile.role == 'manager':
            return qs.filter(profile__role__in=['cashier', 'inventory_manager'])
        return qs

# Audit Log Admin (Read-only for accountability)
@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'action', 'model', 'object_id', 'timestamp']
    list_filter = ['action', 'model', 'timestamp', 'user']
    search_fields = ['user__username', 'details', 'object_id']
    readonly_fields = ['user', 'action', 'model', 'object_id', 'timestamp', 'details', 'ip_address']
    
    def has_add_permission(self, request):
        return False  # No manual audit log entries
    
    def has_change_permission(self, request, obj=None):
        return False  # No editing audit logs
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # Managers can only see audit logs for their subordinates
        if hasattr(request.user, 'profile') and request.user.profile.role == 'manager':
            subordinate_roles = ['cashier', 'inventory_manager']
            return qs.filter(user__profile__role__in=subordinate_roles)
        return qs

# Re-register User Admin
admin.site.unregister(User)
admin.site.register(User, CustomUserAdmin)