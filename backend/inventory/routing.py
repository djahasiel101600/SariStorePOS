# backend/inventory/routing.py
from django.urls import path
from . import consumers

websocket_urlpatterns = [
    path('ws/realtime/', consumers.RealtimeConsumer.as_asgi()),
]
