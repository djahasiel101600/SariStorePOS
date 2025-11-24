# models.py
from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal, InvalidOperation
import os, uuid
from django.db.models.signals import post_save
from django.contrib.auth.models import User
from django.dispatch import receiver

# Unit Types for products
UNIT_TYPES = [
    ('piece', 'Piece'),
    ('kg', 'Kilogram'),
    ('g', 'Gram'),
    ('liter', 'Liter'),
    ('ml', 'Milliliter'),
    ('bundle', 'Bundle'),
    ('pack', 'Pack'),
]

# Pricing Models
PRICING_MODELS = [
    ('fixed_per_unit', 'Fixed Price Per Unit'),
    ('fixed_per_weight', 'Fixed Price Per Weight/Volume'),
    ('variable', 'Variable Pricing'),
]

class UserProfile(models.Model):
    ROLE_CHOICES = [
        ('admin', 'Administrator'),
        ('manager', 'Manager'),
        ('cashier', 'Cashier'),
        ('inventory_manager', 'Inventory Manager'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='cashier')
    employee_id = models.CharField(max_length=20, unique=True, blank=True, null=True)
    is_active_employee = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - {self.role}"

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if hasattr(instance, 'profile'):
        instance.profile.save()

def product_image_path(instance, filename):
    # Get file extension
    ext = filename.split('.')[-1]
    # Generate unique filename
    filename = f"{uuid.uuid4()}.{ext}"
    return os.path.join('products/', filename)

class Product(models.Model):
    name = models.CharField(max_length=200)
    barcode = models.CharField(max_length=100, blank=True, null=True, unique=True, default=None)
    
    # Unit Information
    unit_type = models.CharField(max_length=20, choices=UNIT_TYPES, default='piece')
    
    # Pricing Model
    pricing_model = models.CharField(max_length=20, choices=PRICING_MODELS, default='fixed_per_unit')
    
    # Price Fields
    # For fixed_per_unit: price per piece/pack
    # For fixed_per_weight: price per kg/g/L
    # For variable: suggested/base price (can be overridden at sale)
    price = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(0)],
        null=True,  # Can be null for pure variable pricing
        blank=True,
        help_text="Price per unit. Null for variable pricing items"
    )
    
    # Cost tracking
    cost_price = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(0)],
        null=True,
        blank=True,
        help_text="Cost per unit. For variable pricing, this is cost per unit_type"
    )
    
    # Stock (now DecimalField to support weight/volume)
    stock_quantity = models.DecimalField(
        max_digits=12,
        decimal_places=3,  # Supports grams (0.001 kg) or milliliters
        default=0,
        validators=[MinValueValidator(0)]
    )
    min_stock_level = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        default=5,
        validators=[MinValueValidator(0)]
    )
    
    category = models.CharField(max_length=100, blank=True)
    image = models.ImageField(upload_to=product_image_path, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'products'

    def __str__(self):
        return self.name

    @property
    def needs_restock(self):
        return self.stock_quantity <= self.min_stock_level

    @property
    def profit_margin(self):
        if self.cost_price and self.price and self.cost_price > 0:
            return ((self.price - self.cost_price) / self.cost_price) * 100
        return 0
    
    def calculate_price_for_quantity(self, quantity):
        """Calculate total price for given quantity - returns Decimal"""
        if self.pricing_model == 'variable' or not self.price:
            # For variable pricing, price is set at sale time
            return None
        try:
            return Decimal(str(quantity)) * self.price
        except (InvalidOperation, TypeError):
            return None
    
    def calculate_quantity_for_amount(self, amount):
        """For variable pricing: calculate quantity for given amount - returns Decimal"""
        if self.pricing_model != 'variable' or not self.price:
            return None
        if self.price == 0:
            return None
        try:
            return Decimal(str(amount)) / self.price
        except (InvalidOperation, ZeroDivisionError):
            return None

class Customer(models.Model):
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    total_purchases = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    # Utang tracking
    outstanding_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    last_utang_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'customers'

    def __str__(self):
        return self.name

class Sale(models.Model):
    cashier = models.ForeignKey(
        User, 
        on_delete=models.PROTECT, 
        related_name='sales',
        null=True,  # Allow null for migration safety
        blank=True
    )
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    # Utang tracking on sale
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_fully_paid = models.BooleanField(default=True)
    due_date = models.DateField(null=True, blank=True)
    date_created = models.DateTimeField(auto_now_add=True)
    items_sold = models.ManyToManyField('Product', through='SaleItem')
    
    PAYMENT_METHODS = [
        ('cash', 'Cash'),
        ('card', 'Card'),
        ('mobile', 'Mobile Payment'),
        ('utang', 'Utang'),
    ]
    
    payment_method = models.CharField(
        max_length=50, 
        choices=PAYMENT_METHODS, 
        default='cash'
    )
    # Optional idempotency key provided by client to avoid duplicate creates
    idempotency_key = models.CharField(max_length=255, unique=True, null=True, blank=True)
    
        # Link sale to a Shift (created when a staff starts working on a terminal)
    shift = models.ForeignKey('Shift', on_delete=models.SET_NULL, null=True, blank=True, related_name='sales')

    class Meta:
        db_table = 'sales'
        indexes = [
            models.Index(fields=['cashier', 'date_created']),
        ]

    def __str__(self):
        return f"Sale #{self.id} - {self.total_amount}"

class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    
    # Quantity (now DecimalField to support weight/volume)
    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        validators=[MinValueValidator(0.001)]  # Minimum 0.001
    )
    
    # Unit price at time of sale (important for variable pricing)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    
    # For variable pricing: original customer-requested amount
    # This helps track: "Customer wanted Php 5 worth, got X quantity"
    requested_amount = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        null=True, 
        blank=True,
        help_text="For variable pricing: amount customer requested"
    )

    class Meta:
        db_table = 'sale_items'

    def __str__(self):
        return f"{self.product.name} - {self.quantity}"

    @property
    def total_price(self):
        return self.quantity * self.unit_price  # Keep as Decimal

class Purchase(models.Model):
    supplier = models.CharField(max_length=200)
    total_cost = models.DecimalField(max_digits=12, decimal_places=2)
    date_created = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'purchases'

    def __str__(self):
        return f"Purchase #{self.id} - {self.supplier}"

class PurchaseItem(models.Model):
    purchase = models.ForeignKey(Purchase, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    
    # Quantity (now DecimalField to support weight/volume)
    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        validators=[MinValueValidator(0.001)]
    )
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2)
    # The unit the supplier used when purchasing (piece or pack)
    purchase_unit = models.CharField(max_length=20, choices=UNIT_TYPES, default='piece', help_text='Unit used for this purchase (pack or piece)')
    # If purchased as pack, how many pieces are in one pack
    units_per_pack = models.PositiveIntegerField(default=1, help_text='Number of sellable units inside a pack. Set to 1 for single-piece purchases')
    # Selling price per piece that will be set/used for this product when added to inventory
    selling_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text='Optional: selling price per piece')
    # Profit margin percent calculated at time of purchase (based on per-piece cost and selling_price)
    profit_margin_percent = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    # Internal flag to avoid double-applying stock updates when save() is called multiple times
    added_to_stock = models.BooleanField(default=False)

    class Meta:
        db_table = 'purchase_items'

    def __str__(self):
        return f"{self.product.name} - {self.quantity}"

    def save(self, *args, **kwargs):
        """Save the PurchaseItem first, then update product stock if needed"""
        is_new = self._state.adding  # Check if this is a new object
        super().save(*args, **kwargs)  # Save first
        
        if is_new and not self.added_to_stock:
            self.update_product_stock()

    def update_product_stock(self):
        """Update product stock and pricing - separate from save to avoid recursion"""
        try:
            # Determine per-piece quantity and per-piece cost
            is_pack = (self.purchase_unit == 'pack' and self.units_per_pack and int(self.units_per_pack) > 1)
            try:
                units_per_pack = int(self.units_per_pack) if self.units_per_pack else 1
            except Exception:
                units_per_pack = 1

            # Use Decimal for all arithmetic to avoid mixing float and Decimal
            try:
                qty_decimal = Decimal(str(self.quantity))
            except (InvalidOperation, TypeError):
                qty_decimal = Decimal('0')

            try:
                unit_cost_decimal = Decimal(str(self.unit_cost))
            except (InvalidOperation, TypeError):
                unit_cost_decimal = Decimal('0')

            if is_pack:
                pieces_added = qty_decimal * Decimal(units_per_pack)
                try:
                    per_piece_cost = (unit_cost_decimal / Decimal(units_per_pack))
                except (InvalidOperation, ZeroDivisionError):
                    per_piece_cost = unit_cost_decimal
            else:
                pieces_added = qty_decimal
                per_piece_cost = unit_cost_decimal

            # Update product stock and pricing
            prod = self.product
            # Ensure product.stock_quantity is Decimal
            try:
                current_stock = Decimal(str(prod.stock_quantity))
            except (InvalidOperation, TypeError):
                current_stock = Decimal('0')

            prod.stock_quantity = current_stock + pieces_added
            # Update cost_price to per-piece cost
            prod.cost_price = per_piece_cost
            # Optionally update selling price per piece
            if self.selling_price is not None:
                try:
                    prod.price = Decimal(str(self.selling_price))
                except (InvalidOperation, TypeError):
                    pass  # Keep existing price if conversion fails
            
            prod.save()

            # Calculate profit margin percent if selling_price available and cost > 0
            if self.selling_price is not None and per_piece_cost and Decimal(per_piece_cost) > 0:
                try:
                    selling_decimal = Decimal(str(self.selling_price))
                    margin = (selling_decimal - per_piece_cost) / per_piece_cost * Decimal('100')
                    self.profit_margin_percent = margin.quantize(Decimal('0.01'))
                except Exception:
                    self.profit_margin_percent = None

            # Mark as added to stock
            self.added_to_stock = True
            # Use update to avoid recursive save
            PurchaseItem.objects.filter(id=self.id).update(added_to_stock=True)
            
        except Exception as e:
            # Log error but don't break the application
            print(f"Error updating product stock for {self.product.name}: {e}")


class Shift(models.Model):
    """Represents a staff shift/session on a terminal."""
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('closed', 'Closed'),
    ]

    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name='shifts')
    terminal_id = models.CharField(max_length=200, blank=True, null=True)
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    
    # Cash management
    opening_cash = models.DecimalField(max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    closing_cash = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)])
    
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'shifts'
        indexes = [models.Index(fields=['user', 'start_time', 'status'])]

    def __str__(self):
        return f"Shift #{self.id} - {self.user.username} - {self.status}"
    
    @property
    def sales_count(self):
        """Count of sales made during this shift"""
        return self.sales.count()
    
    @property
    def total_sales(self):
        """Total revenue from sales during this shift"""
        from django.db.models import Sum
        total = self.sales.aggregate(total=Sum('total_amount'))['total']
        return total or Decimal('0.00')
    
    @property
    def expected_cash(self):
        """Expected cash = opening cash + cash sales"""
        if not self.sales.exists():
            return self.opening_cash
        
        from django.db.models import Sum
        cash_sales = self.sales.filter(payment_method='cash').aggregate(
            total=Sum('total_amount')
        )['total'] or Decimal('0.00')
        
        return self.opening_cash + cash_sales
    
    @property
    def cash_difference(self):
        """Difference between expected and actual closing cash"""
        if self.closing_cash is None:
            return None
        return self.closing_cash - self.expected_cash

# New model for recording payments against utang
class Payment(models.Model):
    PAYMENT_METHODS = [
        ('cash', 'Cash'),
        ('card', 'Card'),
        ('mobile', 'Mobile Payment'),
    ]
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='payments')
    sale = models.ForeignKey(Sale, on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0.01)])
    method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default='cash')
    notes = models.TextField(blank=True)
    date_created = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payments'

    def __str__(self):
        return f"Payment #{self.id} - {self.amount}"

class AuditLog(models.Model):
    ACTION_CHOICES = [
        ('SALE_CREATED', 'Sale Created'),
        ('SALE_MODIFIED', 'Sale Modified'),
        ('SALE_VOIDED', 'Sale Voided'),
        ('USER_LOGIN', 'User Login'),
        ('USER_LOGOUT', 'User Logout'),
        ('ROLE_CHANGED', 'Role Changed'),
        ('INVENTORY_UPDATE', 'Inventory Updated'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name='audit_logs')
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    model = models.CharField(max_length=50)  # Which model was affected
    object_id = models.PositiveIntegerField(null=True, blank=True)  # ID of affected object
    timestamp = models.DateTimeField(auto_now_add=True)
    details = models.TextField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['action', 'timestamp']),
        ]
        ordering = ['-timestamp']
    
    def __str__(self):
        return f"{self.user.username} - {self.action} - {self.timestamp}"
    