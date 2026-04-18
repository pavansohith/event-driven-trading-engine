import { useEffect, useRef, useState } from 'react';
import { getWebSocketToken } from '@/lib/auth';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000';

export interface OrderUpdate {
  type: 'ORDER_UPDATE';
  data: {
    orderId: string;
    status: 'PENDING' | 'FILLED' | 'REJECTED' | 'CANCELED';
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price: number | null;
    executedPrice: number | null;
    executedQuantity: number | null;
    error: string | null;
    timestamp: string;
  };
}

export interface WebSocketMessage {
  type: 'connected' | 'ORDER_UPDATE';
  userId?: string;
  data?: OrderUpdate['data'];
}

/**
 * Hook to manage WebSocket connection for real-time order updates
 * Automatically connects on mount and cleans up on unmount
 */
export function useWebSocket(
  onOrderUpdate: (update: OrderUpdate['data']) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 5;
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    // Don't reconnect if already connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Connect to WebSocket with JWT token
    const connect = async () => {
      // Check if component is still mounted
      if (!isMountedRef.current) {
        return;
      }

      // Check retry limit
      if (retryCountRef.current >= maxRetries) {
        console.error('Max reconnection attempts reached');
        setIsReconnecting(false);
        return;
      }

      try {
        // Show reconnecting status after first failed attempt
        if (retryCountRef.current > 0) {
          setIsReconnecting(true);
        }

        // Get WebSocket token from API
        const token = await getWebSocketToken();
        const ws = new WebSocket(`${WS_URL}?token=${token}`);

        ws.onopen = () => {
          console.log('WebSocket connected');
          setIsConnected(true);
          setIsReconnecting(false);
          retryCountRef.current = 0; // Reset retry count on successful connection
          
          // Clear any pending reconnect
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
        };

        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);

            if (message.type === 'connected') {
              console.log('WebSocket authenticated:', message.userId);
            } else if (message.type === 'ORDER_UPDATE' && message.data) {
              // Handle order update
              onOrderUpdate(message.data);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setIsConnected(false);
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setIsConnected(false);
          
          // Only attempt reconnect if component is still mounted and under retry limit
          if (isMountedRef.current && retryCountRef.current < maxRetries) {
            // Exponential backoff: 1s, 2s, 4s, 8s, 16s
            const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 16000);
            retryCountRef.current += 1;
            
            console.log(`Reconnecting in ${delay}ms (attempt ${retryCountRef.current}/${maxRetries})`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              if (isMountedRef.current) {
                connect();
              }
            }, delay);
          } else if (retryCountRef.current >= maxRetries) {
            setIsReconnecting(false);
            console.error('Max reconnection attempts reached');
          }
        };

        wsRef.current = ws;
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        setIsConnected(false);
        
        // Retry on error with exponential backoff
        if (isMountedRef.current && retryCountRef.current < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 16000);
          retryCountRef.current += 1;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              connect();
            }
          }, delay);
        }
      }
    };

    connect();

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [onOrderUpdate]);

  return { isConnected, isReconnecting };
}

