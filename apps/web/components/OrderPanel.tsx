'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { submitOrder, OrderResponse } from '@/lib/trading';

interface OrderPanelProps {
  symbol: string;
  onOrderSubmitted: (order: OrderResponse) => void;
}

type OrderSide = 'BUY' | 'SELL';
type OrderType = 'MARKET' | 'LIMIT' | 'STOP_MARKET';

export default function OrderPanel({ symbol, onOrderSubmitted }: OrderPanelProps) {
  const [side, setSide] = useState<OrderSide>('BUY');
  const [orderType, setOrderType] = useState<OrderType>('MARKET');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(async () => {
    if (!quantity || parseFloat(quantity) <= 0) {
      setError('Please enter a valid quantity');
      return;
    }

    if (orderType === 'LIMIT' && (!price || parseFloat(price) <= 0)) {
      setError('Please enter a valid price for limit orders');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // STOP_MARKET would need backend support, so convert to MARKET
      const orderTypeToSubmit: 'MARKET' | 'LIMIT' = orderType === 'STOP_MARKET' ? 'MARKET' : orderType;
      
      const order = await submitOrder({
        symbol,
        side,
        type: orderTypeToSubmit,
        quantity: parseFloat(quantity),
        ...(orderTypeToSubmit === 'LIMIT' && price ? { price: parseFloat(price) } : {}),
      });

      onOrderSubmitted(order);
      
      // Reset form
      setQuantity('');
      setPrice('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit order');
    } finally {
      setLoading(false);
    }
  }, [symbol, side, orderType, quantity, price, onOrderSubmitted]);

  // Calculate total for LIMIT orders
  const total = orderType === 'LIMIT' && quantity && price
    ? (parseFloat(quantity) * parseFloat(price)).toFixed(2)
    : '0.00';

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      
      // B key - focus Buy tab (only when not in input)
      if ((e.key === 'b' || e.key === 'B') && !isInput) {
        e.preventDefault();
        setSide('BUY');
        return;
      }

      // S key - focus Sell tab (only when not in input)
      if ((e.key === 's' || e.key === 'S') && !isInput) {
        e.preventDefault();
        setSide('SELL');
        return;
      }

      // Enter key - submit order (works everywhere)
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit]);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg h-full flex flex-col">
      {/* Buy/Sell Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setSide('BUY')}
          className={`flex-1 py-3 px-4 text-sm font-semibold transition-colors ${
            side === 'BUY'
              ? 'bg-green-600/20 dark:bg-green-600/20 text-green-600 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setSide('SELL')}
          className={`flex-1 py-3 px-4 text-sm font-semibold transition-colors ${
            side === 'SELL'
              ? 'bg-red-600/20 dark:bg-red-600/20 text-red-600 dark:text-red-400 border-b-2 border-red-600 dark:border-red-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
          }`}
        >
          Sell
        </button>
      </div>

      {/* Order Type Selector */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex space-x-2">
          <button
            onClick={() => setOrderType('MARKET')}
            className={`px-3 py-1.5 text-xs font-medium rounded ${
              orderType === 'MARKET'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Market
          </button>
          <button
            onClick={() => setOrderType('LIMIT')}
            className={`px-3 py-1.5 text-xs font-medium rounded ${
              orderType === 'LIMIT'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Limit
          </button>
          <button
            onClick={() => setOrderType('STOP_MARKET')}
            className={`px-3 py-1.5 text-xs font-medium rounded ${
              orderType === 'STOP_MARKET'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Stop
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 p-4 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Quantity Input */}
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Quantity</label>
          <input
            ref={quantityInputRef}
            type="number"
            step="0.000001"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Price Input (for LIMIT orders) */}
        {orderType === 'LIMIT' && (
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Price</label>
            <input
              ref={priceInputRef}
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        )}

        {/* Total (for LIMIT orders) */}
        {orderType === 'LIMIT' && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Total</span>
            <span className="text-gray-900 dark:text-white font-semibold">${total}</span>
          </div>
        )}

        {/* Place Order Button */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`w-full py-3 rounded font-semibold text-white transition-colors ${
            side === 'BUY'
              ? 'bg-green-600 hover:bg-green-700 disabled:bg-green-600/50'
              : 'bg-red-600 hover:bg-red-700 disabled:bg-red-600/50'
          }`}
        >
          {loading ? 'Placing Order...' : `${side} ${symbol.split('USDT')[0]}`}
        </button>

        {/* Account Info Placeholder */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-gray-600 dark:text-gray-400">Available Balance</span>
            <span className="text-gray-700 dark:text-gray-300">--</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-600 dark:text-gray-400">Margin Ratio</span>
            <span className="text-gray-700 dark:text-gray-300">--</span>
          </div>
        </div>
      </div>
    </div>
  );
}

