# backend/inventory/websocket_utils.py
import json
from decimal import Decimal
from django.core.serializers.json import DjangoJSONEncoder
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync


def serialize_data(data):
    """Convert data to JSON-serializable format, handling Decimal and DRF types"""
    from collections import OrderedDict
    from rest_framework.utils.serializer_helpers import ReturnDict, ReturnList
    
    if isinstance(data, (dict, OrderedDict, ReturnDict)):
        return {key: serialize_data(value) for key, value in data.items()}
    elif isinstance(data, (list, tuple, ReturnList)):
        return [serialize_data(item) for item in data]
    elif isinstance(data, Decimal):
        return float(data)
    elif hasattr(data, 'isoformat'):  # datetime objects
        return data.isoformat()
    elif hasattr(data, '__dict__') and not isinstance(data, type):
        return serialize_data(data.__dict__)
    return data


def broadcast_dashboard_update(data):
    """Broadcast dashboard stats update to all connected clients"""
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        "dashboard_updates",
        {
            "type": "dashboard_update",
            "data": serialize_data(data)
        }
    )


def broadcast_inventory_update(product_data):
    """Broadcast inventory change to all connected clients"""
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        "inventory_updates",
        {
            "type": "inventory_update",
            "data": serialize_data(product_data)
        }
    )


def broadcast_sales_update(sale_data):
    """Broadcast new sale to all connected clients"""
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        "sales_updates",
        {
            "type": "sales_update",
            "data": serialize_data(sale_data)
        }
    )


def broadcast_shift_update(shift_data):
    """Broadcast shift change to all connected clients"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        channel_layer = get_channel_layer()
        if not channel_layer:
            logger.error("Channel layer is None - Redis may not be configured correctly")
            return
            
        logger.info(f"Broadcasting shift update: {shift_data.get('action', 'unknown')}")
        
        # Serialize the data to handle Decimal objects
        serialized_data = serialize_data(shift_data)
        
        async_to_sync(channel_layer.group_send)(
            "shifts_updates",
            {
                "type": "shift_update",
                "data": serialized_data
            }
        )
        logger.info("Shift update broadcast successful")
    except Exception as e:
        logger.error(f"Error broadcasting shift update: {e}", exc_info=True)


def broadcast_low_stock_alert(product_data):
    """Broadcast low stock alert to all connected clients"""
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        "inventory_updates",
        {
            "type": "low_stock_alert",
            "data": product_data
        }
    )
