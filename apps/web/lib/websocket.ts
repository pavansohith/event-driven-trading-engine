import { useEffect, useRef, useState } from 'react';

interface UseWebSocketReturn {
  connected: boolean;
  lastMessage: string | null;
  sendMessage: (message: string) => void;
}

/**
 * Reusable WebSocket client hook
 * Connects to the events service WebSocket server
 */
export function useWebSocket(token?: string): UseWebSocketReturn {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // WebSocket server URL (adjust port as needed)
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';
    const url = token ? `${wsUrl}?token=${token}` : wsUrl;

    // Create WebSocket connection
    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
    };

    ws.onmessage = (event) => {
      setLastMessage(event.data);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnected(false);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    };

    wsRef.current = ws;

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [token]);

  const sendMessage = (message: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(message);
    } else {
      console.warn('WebSocket is not connected');
    }
  };

  return { connected, lastMessage, sendMessage };
}

