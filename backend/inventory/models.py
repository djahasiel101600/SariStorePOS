# models.py
from django.db import models
from django.core.validators import MinValueValidator

class Product(models.Model):
    name = models.CharField(max_length=200)
    barcode = models.CharField(max_length=100, blank=True, null=True, unique=True, default=None)
    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    cost_price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    stock_quantity = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    min_stock_level = models.IntegerField(default=5, validators=[MinValueValidator(0)])
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
        if self.cost_price > 0:
            return ((self.price - self.cost_price) / self.cost_price) * 100
        return 0

class Customer(models.Model):
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    total_purchases = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'customers'

    def __str__(self):
        return self.name

class Sale(models.Model):
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
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
    quantity = models.IntegerField(validators=[MinValueValidator(1)])
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = 'sale_items'

    @property
    def total_price(self):
        return self.quantity * self.unit_price

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
    quantity = models.IntegerField(validators=[MinValueValidator(1)])
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = 'purchase_items'
