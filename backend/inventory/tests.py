from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from django.contrib.auth.models import User
from .models import Product, Sale, Shift


class SaleIdempotencyTest(APITestCase):
	def setUp(self):
		self.user = User.objects.create_user(username='tester', password='pass')
		self.client = APIClient()
		self.client.force_authenticate(user=self.user)

		# create a product to sell
		self.product = Product.objects.create(
			name='Test Product',
			price=100,
			stock_quantity=10,
			is_active=True
		)
		# create an active shift for the user
		self.shift = Shift.objects.create(user=self.user, terminal_id='test-term')

	def test_create_sale_idempotent(self):
		url = reverse('sale-list')
		payload = {
			'customer': None,
			'payment_method': 'cash',
			'items': [
				{
					'product_id': self.product.id,
					'quantity': 1,
					'unit_price': '100.00'
				}
			]
		}

		key = 'test-idemp-123'

		resp1 = self.client.post(url, payload, format='json', HTTP_IDEMPOTENCY_KEY=key)
		self.assertIn(resp1.status_code, (200, 201))

		resp2 = self.client.post(url, payload, format='json', HTTP_IDEMPOTENCY_KEY=key)
		self.assertIn(resp2.status_code, (200, 201))

		# Only one Sale should exist
		sales = Sale.objects.filter(idempotency_key=key)
		self.assertEqual(sales.count(), 1)
