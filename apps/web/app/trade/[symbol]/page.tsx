'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import OrderPanel from '@/components/OrderPanel';
import TradingChart from '@/components/TradingChart';
import TradingTabs from '@/components/TradingTabs';
import PriceAlerts from '@/components/PriceAlerts';
import Toast from '@/components/Toast';
import { submitOrder, getOrders, getPositions, Order, OrderResponse, Position } from '@/lib/trading';
import { useWebSocket } from '@/hooks/useWebSocket';
import { usePriceAlerts } from '@/hooks/usePriceAlerts';
import { useToast } from '@/hooks/useToast';

const VALID_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'];

export default function TradeSymbolPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const symbolParam = params.symbol as string;
  const [currentSymbol, setCurrentSymbol] = useState<string>(() => {
    // Validate symbol from URL
    if (symbolParam && VALID_SYMBOLS.includes(symbolParam.toUpperCase())) {
      return symbolParam.toUpperCase();
    }
    return 'BTCUSDT';
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [positions, setPositions] = useState<Position[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const { alerts, checkAlerts } = usePriceAlerts();
  const { toasts, showToast, removeToast } = useToast();
  const lastCheckedPriceRef = useRef<number | null>(null);

  // Update symbol when URL changes
  useEffect(() => {
    if (symbolParam && VALID_SYMBOLS.includes(symbolParam.toUpperCase())) {
      setCurrentSymbol(symbolParam.toUpperCase());
    } else if (symbolParam) {
      // Invalid symbol, redirect to BTCUSDT
      router.replace('/trade/BTCUSDT');
    }
  }, [symbolParam, router]);

  // Handle symbol change - update URL
  const handleSymbolChange = useCallback((newSymbol: string) => {
    setCurrentSymbol(newSymbol);
    router.push(`/trade/${newSymbol}`);
  }, [router]);

  // Load orders from API
  const loadOrders = useCallback(async () => {
    try {
      setOrdersLoading(true);
      const fetchedOrders = await getOrders();
      setOrders(fetchedOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  // Load positions from API
  const loadPositions = useCallback(async () => {
    try {
      setPositionsLoading(true);
      const fetchedPositions = await getPositions();
      setPositions(fetchedPositions);
    } catch (error) {
      console.error('Error loading positions:', error);
    } finally {
      setPositionsLoading(false);
    }
  }, []);

  // Handle order updates from WebSocket
  const handleOrderUpdate = useCallback((update: {
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
  }) => {
    // Update the order in the list
    setOrders((prevOrders) => {
      const orderIndex = prevOrders.findIndex((o) => o.orderId === update.orderId);
      
      if (orderIndex >= 0) {
        const updatedOrders = [...prevOrders];
        const existingOrder = updatedOrders[orderIndex];
        
        if (!existingOrder) {
          return prevOrders;
        }
        
        updatedOrders[orderIndex] = {
          orderId: existingOrder.orderId,
          symbol: existingOrder.symbol,
          side: existingOrder.side,
          type: existingOrder.type,
          quantity: existingOrder.quantity,
          price: existingOrder.price,
          status: update.status,
          executedPrice: update.executedPrice,
          executedQuantity: update.executedQuantity,
          createdAt: existingOrder.createdAt,
          updatedAt: update.timestamp,
        };
        return updatedOrders;
      } else {
        const newOrder: Order = {
          orderId: update.orderId,
          symbol: update.symbol,
          side: update.side,
          type: 'MARKET',
          quantity: update.quantity,
          price: update.price,
          status: update.status,
          executedPrice: update.executedPrice,
          executedQuantity: update.executedQuantity,
          createdAt: update.timestamp,
          updatedAt: update.timestamp,
        };
        return [newOrder, ...prevOrders];
      }
    });

    // Reload orders to ensure we have the latest data
    loadOrders();
    
    // Reload positions if order was filled (affects positions)
    if (update.status === 'FILLED') {
      loadPositions();
    }
  }, [loadOrders, loadPositions]);

  // Connect to WebSocket for real-time updates
  const { isConnected, isReconnecting } = useWebSocket(handleOrderUpdate);

  // Handle price updates from chart
  const handlePriceUpdate = useCallback((price: number) => {
    setCurrentPrice(price);
    
    // Check alerts only if price changed significantly (avoid spam)
    if (lastCheckedPriceRef.current === null || Math.abs(price - lastCheckedPriceRef.current) > 0.01) {
      const triggered = checkAlerts(currentSymbol, price);
      triggered.forEach((alert) => {
        showToast(
          `${alert.symbol} ${alert.direction === 'above' ? 'rose above' : 'fell below'} $${alert.threshold.toFixed(2)}`,
          'warning'
        );
      });
      lastCheckedPriceRef.current = price;
    }
  }, [currentSymbol, checkAlerts, showToast]);

  // Load orders and positions on mount
  useEffect(() => {
    if (user) {
      loadOrders();
      loadPositions();
    }
  }, [user, loadOrders, loadPositions]);

  // Handle new order submission
  const handleOrderSubmitted = useCallback((order: OrderResponse) => {
    const optimisticOrder: Order = {
      orderId: order.orderId,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      quantity: order.quantity,
      price: order.price,
      status: 'PENDING',
      executedPrice: null,
      executedQuantity: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setOrders((prev) => [optimisticOrder, ...prev]);
    
    // Reload orders and positions after a short delay
    setTimeout(() => {
      loadOrders();
      loadPositions();
    }, 1000);
  }, [loadOrders, loadPositions]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // useAuth will redirect to login
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <Header
        currentSymbol={currentSymbol}
        onSymbolChange={handleSymbolChange}
        isConnected={isConnected}
        isReconnecting={isReconnecting}
      />

      {/* Main Layout: Left Panel (Order Entry) + Right Panel (Chart + Tables) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Panel - Order Entry */}
        <div className="w-full lg:w-80 border-r border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div className="h-full p-4">
            <OrderPanel
              symbol={currentSymbol}
              onOrderSubmitted={handleOrderSubmitted}
            />
          </div>
        </div>

        {/* Right Panel - Chart + Tables */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chart Section */}
          <div className="flex-1 min-h-0 p-4 border-b border-gray-200 dark:border-gray-800">
            <TradingChart symbol={currentSymbol} onPriceUpdate={handlePriceUpdate} />
          </div>

          {/* Price Alerts Section */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <PriceAlerts symbol={currentSymbol} currentPrice={currentPrice} />
          </div>

          {/* Positions/Orders/Trades Tabs */}
          <div className="h-96 flex-shrink-0 p-4">
            <TradingTabs
              positions={positions}
              orders={orders}
              positionsLoading={positionsLoading}
              ordersLoading={ordersLoading}
              onOrderCanceled={loadOrders}
            />
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

