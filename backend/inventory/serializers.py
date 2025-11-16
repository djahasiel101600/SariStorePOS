# serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Product, Customer, Sale, SaleItem, Purchase, PurchaseItem, Payment

class ProductSerializer(serializers.ModelSerializer):
    needs_restock = serializers.ReadOnlyField()
    profit_margin = serializers.ReadOnlyField()
    unit_type_display = serializers.CharField(source='get_unit_type_display', read_only=True)
    pricing_model_display = serializers.CharField(source='get_pricing_model_display', read_only=True)
    
    class Meta:
        model = Product
        fields = '__all__'

class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = '__all__'

class PaymentSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    sale_id = serializers.IntegerField(source='sale.id', read_only=True)

    class Meta:
        model = Payment
        fields = '__all__'

class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    total_price = serializers.ReadOnlyField()
    
    class Meta:
        model = SaleItem
        fields = '__all__'

class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    
    class Meta:
        model = Sale
        fields = '__all__'

class PurchaseItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    
    class Meta:
        model = PurchaseItem
        fields = '__all__'

class PurchaseSerializer(serializers.ModelSerializer):
    items = PurchaseItemSerializer(many=True, read_only=True)
    
    class Meta:
        model = Purchase
        fields = '__all__'

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff']
        read_only_fields = ['id', 'is_staff']