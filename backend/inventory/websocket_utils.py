# backend/inventory/websocket_utils.py
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync


def broadcast_dashboard_update(data):
    """Broadcast dashboard stats update to all connected clients"""
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        "dashboard_updates",
        {
            "type": "dashboard_update",
            "data": data
        }
    )


def broadcast_inventory_update(product_data):
    """Broadcast inventory change to all connected clients"""
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        "inventory_updates",
        {
            "type": "inventory_update",
            "data": product_data
        }
    )


def broadcast_sales_update(sale_data):
    """Broadcast new sale to all connected clients"""
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        "sales_updates",
        {
            "type": "sales_update",
            "data": sale_data
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
        async_to_sync(channel_layer.group_send)(
            "shifts_updates",
            {
                "type": "shift_update",
                "data": shift_data
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
