# Generated manually for unit types and pricing model enhancement

import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0001_initial'),
    ]

    operations = [
        # Add new fields to Product model
        migrations.AddField(
            model_name='product',
            name='unit_type',
            field=models.CharField(choices=[('piece', 'Piece'), ('kg', 'Kilogram'), ('g', 'Gram'), ('liter', 'Liter'), ('ml', 'Milliliter'), ('bundle', 'Bundle'), ('pack', 'Pack')], default='piece', max_length=20),
        ),
        migrations.AddField(
            model_name='product',
            name='pricing_model',
            field=models.CharField(choices=[('fixed_per_unit', 'Fixed Price Per Unit'), ('fixed_per_weight', 'Fixed Price Per Weight/Volume'), ('variable', 'Variable Pricing')], default='fixed_per_unit', max_length=20),
        ),
        # Make price nullable for variable pricing
        migrations.AlterField(
            model_name='product',
            name='price',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Price per unit. Null for variable pricing items', max_digits=10, null=True, validators=[django.core.validators.MinValueValidator(0)]),
        ),
        # Make cost_price nullable
        migrations.AlterField(
            model_name='product',
            name='cost_price',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Cost per unit. For variable pricing, this is cost per unit_type', max_digits=10, null=True, validators=[django.core.validators.MinValueValidator(0)]),
        ),
        # Convert stock_quantity from IntegerField to DecimalField
        migrations.AlterField(
            model_name='product',
            name='stock_quantity',
            field=models.DecimalField(decimal_places=3, default=0, max_digits=12, validators=[django.core.validators.MinValueValidator(0)]),
        ),
        # Convert min_stock_level from IntegerField to DecimalField
        migrations.AlterField(
            model_name='product',
            name='min_stock_level',
            field=models.DecimalField(decimal_places=3, default=5, max_digits=12, validators=[django.core.validators.MinValueValidator(0)]),
        ),
        # Convert SaleItem quantity from IntegerField to DecimalField
        migrations.AlterField(
            model_name='saleitem',
            name='quantity',
            field=models.DecimalField(decimal_places=3, max_digits=12, validators=[django.core.validators.MinValueValidator(0.001)]),
        ),
        # Add requested_amount field to SaleItem
        migrations.AddField(
            model_name='saleitem',
            name='requested_amount',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='For variable pricing: amount customer requested', max_digits=10, null=True),
        ),
        # Convert PurchaseItem quantity from IntegerField to DecimalField
        migrations.AlterField(
            model_name='purchaseitem',
            name='quantity',
            field=models.DecimalField(decimal_places=3, max_digits=12, validators=[django.core.validators.MinValueValidator(0.001)]),
        ),
    ]

