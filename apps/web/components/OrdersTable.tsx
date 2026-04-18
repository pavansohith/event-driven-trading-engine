'use client';

import { useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Order, cancelOrder } from '@/lib/trading';

interface OrdersTableProps {
  orders: Order[];
  onOrderCanceled?: () => void;
}

export default function OrdersTable({ orders, onOrderCanceled }: OrdersTableProps) {
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Use virtualization when there are more than 50 orders
  const shouldVirtualize = orders.length > 50;
  
  const rowVirtualizer = useVirtualizer({
    count: orders.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // Estimated row height
    overscan: 5,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400';
      case 'FILLED':
        return 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400';
      case 'REJECTED':
        return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400';
      case 'CANCELED':
        return 'bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400';
      default:
        return 'bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400';
    }
  };

  const handleCancel = async (orderId: string) => {
    if (cancelingOrderId) return; // Prevent multiple simultaneous cancellations
    
    try {
      setCancelingOrderId(orderId);
      await cancelOrder(orderId);
      if (onOrderCanceled) {
        onOrderCanceled();
      }
    } catch (error) {
      console.error('Error canceling order:', error);
      alert('Failed to cancel order. Please try again.');
    } finally {
      setCancelingOrderId(null);
    }
  };

  if (orders.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400 text-sm">No orders yet. Place your first order above.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {orders.length} {orders.length === 1 ? 'order' : 'orders'}
        </span>
      </div>
      <div className="overflow-x-auto">
        {shouldVirtualize ? (
          <div ref={parentRef} className="h-96 overflow-auto">
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                <thead className="sticky top-0 bg-white dark:bg-gray-900 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Order ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Symbol
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Side
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const order = orders[virtualRow.index];
                    if (!order) return null;
                    return (
                      <tr
                        key={order.orderId}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700 dark:text-gray-300">
                          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-600 dark:text-gray-400">{order.orderId.substring(0, 8)}...</code>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                          {order.symbol}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <span
                            className={`font-bold px-2 py-1 rounded text-xs ${
                              order.side === 'BUY' 
                                ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' 
                                : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
                            }`}
                          >
                            {order.side}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700 dark:text-gray-300">
                          {order.quantity}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <span
                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded ${getStatusColor(
                              order.status
                            )}`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                          {order.executedPrice
                            ? `$${order.executedPrice.toFixed(2)}`
                            : order.price
                            ? `$${order.price.toFixed(2)}`
                            : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {new Date(order.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {order.status === 'PENDING' && (
                            <button
                              onClick={() => handleCancel(order.orderId)}
                              disabled={cancelingOrderId === order.orderId}
                              className="px-3 py-1 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/30 rounded text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {cancelingOrderId === order.orderId ? 'Canceling...' : 'Cancel'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Order ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Symbol
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Side
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {orders.map((order) => (
                <tr key={order.orderId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700 dark:text-gray-300">
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-600 dark:text-gray-400">{order.orderId.substring(0, 8)}...</code>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                    {order.symbol}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span
                      className={`font-bold px-2 py-1 rounded text-xs ${
                        order.side === 'BUY' 
                          ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' 
                          : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
                      }`}
                    >
                      {order.side}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700 dark:text-gray-300">
                    {order.quantity}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded ${getStatusColor(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                    {order.executedPrice
                      ? `$${order.executedPrice.toFixed(2)}`
                      : order.price
                      ? `$${order.price.toFixed(2)}`
                      : '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {new Date(order.createdAt).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {order.status === 'PENDING' && (
                      <button
                        onClick={() => handleCancel(order.orderId)}
                        disabled={cancelingOrderId === order.orderId}
                        className="px-3 py-1 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/30 rounded text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {cancelingOrderId === order.orderId ? 'Canceling...' : 'Cancel'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

