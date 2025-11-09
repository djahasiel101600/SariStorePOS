# models.py
from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal, InvalidOperation

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
    image = models.ImageField(upload_to='products/', blank=True, null=True)
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
        """Calculate total price for given quantity"""
        if self.pricing_model == 'variable' or not self.price:
            # For variable pricing, price is set at sale time
            return None
        return float(self.price) * float(quantity)
    
    def calculate_quantity_for_amount(self, amount):
        """For variable pricing: calculate quantity for given amount"""
        if self.pricing_model != 'variable' or not self.price:
            return None
        if self.price == 0:
            return None
        return float(amount) / float(self.price)

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
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    # Utang tracking on sale
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_fully_paid = models.BooleanField(default=True)
    due_date = models.DateField(null=True, blank=True)

    date_created = models.DateTimeField(auto_now_add=True)
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


    class Meta:
        db_table = 'sales'

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

    @property
    def total_price(self):
        return float(self.quantity) * float(self.unit_price)

class Purchase(models.Model):
    supplier = models.CharField(max_length=200)
    total_cost = models.DecimalField(max_digits=12, decimal_places=2)
    date_created = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'purchases'

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

    def save(self, *args, **kwargs):
        """On save, convert purchased quantity/units to product's stock units and update product cost/price.

        Behavior:
        - If `purchase_unit` is 'pack' and `units_per_pack` > 1, the incoming `quantity` represents packs. We convert to pieces by quantity * units_per_pack.
        - Compute per-piece cost = unit_cost / units_per_pack when purchase_unit is 'pack'.
        - Update the linked Product:
            - increase `stock_quantity` by converted pieces
            - set `cost_price` to per-piece cost
            - if `selling_price` provided, set `price` to selling_price (per piece)
        - Calculate and store `profit_margin_percent` if selling_price provided and cost > 0.
        - Use `added_to_stock` to prevent double-updating stock on subsequent saves.
        """

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

        # If not yet added to stock, update product stock and pricing
        update_product = False
        if not self.added_to_stock:
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
                    prod.price = prod.price
            prod.save()
            self.added_to_stock = True
            update_product = True

        # Calculate profit margin percent if selling_price available and cost > 0
        if self.selling_price is not None and per_piece_cost and Decimal(per_piece_cost) > 0:
            try:
                selling_decimal = Decimal(str(self.selling_price))
                margin = (selling_decimal - per_piece_cost) / per_piece_cost * Decimal('100')
                # store rounded to 2 decimal places
                # Convert to float for storage in DecimalField if desired, but Decimal is fine
                self.profit_margin_percent = margin.quantize(Decimal('0.01'))
            except Exception:
                self.profit_margin_percent = None

        super(PurchaseItem, self).save(*args, **kwargs)

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
