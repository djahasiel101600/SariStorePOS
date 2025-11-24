// src/hooks/useWebSocket.ts
import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

interface WebSocketMessage {
  type: string;
  data?: any;
  message?: string;
}

export const useWebSocket = () => {
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const { accessToken, isAuthenticated } = useAuthStore();
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reconnectAttemptsRef = useRef(0);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const maxReconnectAttempts = 5;
  const isConnectingRef = useRef(false);
  const mountedRef = useRef(true); // Track if component is mounted

  const connect = useCallback(() => {
    if (!isAuthenticated || !accessToken || isConnectingRef.current || !mountedRef.current) {
      return;
    }

    // Prevent multiple simultaneous connection attempts
    isConnectingRef.current = true;

    // Close existing connection only if it's in a bad state
    if (wsRef.current) {
      const state = wsRef.current.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
        // Don't close a working connection
        isConnectingRef.current = false;
        return;
      }
      wsRef.current.close();
    }

    // Determine WebSocket URL with JWT token
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = '8000'; // Use default Django port
    const wsUrl = `${protocol}//${host}:${port}/ws/realtime/?token=${accessToken}`;

    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        isConnectingRef.current = false;
        
        // Start heartbeat to keep connection alive
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          }
        }, 30000); // Every 30 seconds
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
        isConnectingRef.current = false;
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        isConnectingRef.current = false;
        
        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = undefined;
        }
        
        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts && isAuthenticated && accessToken && mountedRef.current) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`Reconnecting in ${delay}ms...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.log('Max reconnection attempts reached');
          toast.error('Real-time updates disconnected. Please refresh the page.');
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      isConnectingRef.current = false;
    }
  }, [isAuthenticated, accessToken, queryClient]);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    console.log('WebSocket message received:', message);

    switch (message.type) {
      case 'connection_established':
        console.log('Connection established:', message.message);
        break;

      case 'dashboard_update':
        // Invalidate dashboard queries to refetch
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        break;

      case 'inventory_update':
        // Invalidate inventory queries
        queryClient.invalidateQueries({ queryKey: ['products'] });
        queryClient.invalidateQueries({ queryKey: ['low-stock-products'] });
        
        if (message.data?.action === 'created') {
          toast.success(`Product ${message.data.product.name} added`);
        } else if (message.data?.action === 'updated') {
          toast.info(`Product ${message.data.product.name} updated`);
        }
        break;

      case 'sales_update':
        // Invalidate sales and dashboard queries
        queryClient.invalidateQueries({ queryKey: ['sales'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        queryClient.invalidateQueries({ queryKey: ['products'] }); // Stock changed
        
        if (message.data?.action === 'created') {
          const saleData = message.data.sale;
          toast.success(
            `New sale: $${saleData.total_amount} by ${message.data.cashier}`,
            { duration: 3000 }
          );
        }
        break;

      case 'shift_update':
        // Invalidate shift queries
        queryClient.invalidateQueries({ queryKey: ['shifts'] });
        queryClient.invalidateQueries({ queryKey: ['active-shifts'] });
        queryClient.invalidateQueries({ queryKey: ['my-shift'] });
        
        if (message.data?.action === 'started') {
          const shift = message.data.shift;
          toast.info(`Shift started by ${shift.user_name}`);
        } else if (message.data?.action === 'ended') {
          const shift = message.data.shift;
          const diff = shift.cash_difference;
          const status = diff === 0 ? '✓ Balanced' : diff > 0 ? '↑ Over' : '↓ Short';
          toast.info(`Shift ended by ${shift.user_name} - ${status}`);
        }
        break;

      case 'low_stock_alert':
        // Show alert for low stock
        queryClient.invalidateQueries({ queryKey: ['low-stock-products'] });
        
        if (message.data?.product) {
          toast.warning(
            `Low stock alert: ${message.data.product.name} (${message.data.product.stock_quantity} left)`,
            { duration: 5000 }
          );
        }
        break;

      case 'pong':
        // Heartbeat response
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }, [queryClient]);

  const disconnect = useCallback(() => {
    isConnectingRef.current = false;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = undefined;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Connect on mount and when auth changes, disconnect on unmount
  useEffect(() => {
    mountedRef.current = true;
    
    if (isAuthenticated && accessToken) {
      // Only connect if not already connected or connecting
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        connect();
      }
    } else {
      // Disconnect if not authenticated
      disconnect();
    }
    
    return () => {
      mountedRef.current = false;
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]); // Reconnect when auth state changes

  return {
    isConnected,
    sendMessage,
    reconnect: connect,
  };
};
