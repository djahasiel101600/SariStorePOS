from django.db.models import Sum
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Sale, Customer

@receiver([post_save, post_delete], sender=Sale)
def update_customer_total_purchases(sender, instance, **kwargs):
    """
    Update customer's total_purchases when a Sale is saved or deleted.
    """
    # If the sale has a customer, update that customer's total_purchases
    if instance.customer:
        total = Sale.objects.filter(customer=instance.customer).aggregate(total=Sum('total_amount'))['total'] or 0
        # Update the customer's total_purchases without saving the entire customer (to avoid recursion if customer has save signals)
        Customer.objects.filter(id=instance.customer.id).update(total_purchases=total)
        
@receiver(post_delete, sender=Sale)
def update_customer_total_purchases_on_delete(sender, instance, **kwargs):
    """
    Update customer's total_purchases when a Sale is deleted.
    """
    if instance.customer:
        total = Sale.objects.filter(customer=instance.customer).aggregate(total=Sum('total_amount'))['total'] or 0
        instance.customer.total_purchases = total
        instance.customer.save()