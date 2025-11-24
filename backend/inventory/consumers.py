# backend/inventory/consumers.py
import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser

logger = logging.getLogger(__name__)


class RealtimeConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time updates
    Handles: dashboard stats, inventory changes, sales, shift updates
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Initialize group names
        self.dashboard_group = "dashboard_updates"
        self.inventory_group = "inventory_updates"
        self.sales_group = "sales_updates"
        self.shifts_group = "shifts_updates"
    
    async def connect(self):
        self.user = self.scope["user"]
        
        logger.info(f"WebSocket connect attempt by user: {self.user}")
        
        # Reject anonymous users
        if isinstance(self.user, AnonymousUser):
            logger.warning("WebSocket connection rejected: AnonymousUser")
            await self.close()
            return
        
        logger.info(f"WebSocket connection accepted for user: {self.user.username}")
        
        # Add to groups
        await self.channel_layer.group_add(self.dashboard_group, self.channel_name)
        await self.channel_layer.group_add(self.inventory_group, self.channel_name)
        await self.channel_layer.group_add(self.sales_group, self.channel_name)
        await self.channel_layer.group_add(self.shifts_group, self.channel_name)
        
        await self.accept()
        
        # Send connection confirmation
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'message': 'Connected to real-time updates',
            'user': self.user.username
        }))
    
    async def disconnect(self, close_code):
        # Leave all groups
        await self.channel_layer.group_discard(self.dashboard_group, self.channel_name)
        await self.channel_layer.group_discard(self.inventory_group, self.channel_name)
        await self.channel_layer.group_discard(self.sales_group, self.channel_name)
        await self.channel_layer.group_discard(self.shifts_group, self.channel_name)
    
    async def receive(self, text_data):
        """
        Handle messages from WebSocket client
        """
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'ping':
                await self.send(text_data=json.dumps({
                    'type': 'pong',
                    'timestamp': data.get('timestamp')
                }))
        except json.JSONDecodeError:
            pass
    
    # Handler methods for different update types
    async def dashboard_update(self, event):
        """Send dashboard updates to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'dashboard_update',
            'data': event['data']
        }))
    
    async def inventory_update(self, event):
        """Send inventory updates to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'inventory_update',
            'data': event['data']
        }))
    
    async def sales_update(self, event):
        """Send sales updates to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'sales_update',
            'data': event['data']
        }))
    
    async def shift_update(self, event):
        """Send shift updates to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'shift_update',
            'data': event['data']
        }))
    
    async def low_stock_alert(self, event):
        """Send low stock alerts to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'low_stock_alert',
            'data': event['data']
        }))
