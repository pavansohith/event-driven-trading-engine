'use client';

import { useState } from 'react';
import { Order, Position } from '@/lib/trading';
import PositionsTable from './PositionsTable';
import OrdersTable from './OrdersTable';

interface TradingTabsProps {
  positions: Position[];
  orders: Order[];
  positionsLoading: boolean;
  ordersLoading: boolean;
  onOrderCanceled?: () => void;
}

type TabType = 'positions' | 'orders' | 'trades';

export default function TradingTabs({
  positions,
  orders,
  positionsLoading,
  ordersLoading,
  onOrderCanceled,
}: TradingTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('positions');

  // Filter filled orders as "trades"
  const trades = orders.filter((order) => order.status === 'FILLED');

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveTab('positions')}
          className={`px-6 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'positions'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
          }`}
        >
          Positions
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-6 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'orders'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
          }`}
        >
          Orders
        </button>
        <button
          onClick={() => setActiveTab('trades')}
          className={`px-6 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'trades'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
          }`}
        >
          Trades
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {activeTab === 'positions' && (
          <>
            {positionsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-400">Loading positions...</span>
              </div>
            ) : (
              <PositionsTable positions={positions} />
            )}
          </>
        )}

        {activeTab === 'orders' && (
          <>
            {ordersLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-400">Loading orders...</span>
              </div>
            ) : (
              <OrdersTable orders={orders} onOrderCanceled={onOrderCanceled} />
            )}
          </>
        )}

        {activeTab === 'trades' && (
          <>
            {ordersLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-400">Loading trades...</span>
              </div>
            ) : (
              <OrdersTable orders={trades} onOrderCanceled={onOrderCanceled} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

