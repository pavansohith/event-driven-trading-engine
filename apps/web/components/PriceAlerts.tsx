'use client';

import { useState } from 'react';
import { usePriceAlerts, PriceAlert } from '@/hooks/usePriceAlerts';

interface PriceAlertsProps {
  symbol: string;
  currentPrice: number | null;
  onAlertTriggered?: (alert: PriceAlert) => void;
}

export default function PriceAlerts({ symbol, currentPrice, onAlertTriggered }: PriceAlertsProps) {
  const { alerts, addAlert, removeAlert, resetAlert } = usePriceAlerts();
  const [showForm, setShowForm] = useState(false);
  const [threshold, setThreshold] = useState('');
  const [direction, setDirection] = useState<'above' | 'below'>('above');

  const symbolAlerts = alerts.filter((alert) => alert.symbol === symbol);

  const handleAddAlert = () => {
    const thresholdNum = parseFloat(threshold);
    if (isNaN(thresholdNum) || thresholdNum <= 0) {
      alert('Please enter a valid price threshold');
      return;
    }

    addAlert({
      symbol,
      threshold: thresholdNum,
      direction,
    });

    setThreshold('');
    setShowForm(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Price Alerts</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Alert'}
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Price Threshold</label>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="Enter price"
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Direction</label>
              <div className="flex space-x-2">
                <button
                  onClick={() => setDirection('above')}
                  className={`flex-1 px-3 py-2 rounded text-xs font-semibold transition-colors ${
                    direction === 'above'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  Above
                </button>
                <button
                  onClick={() => setDirection('below')}
                  className={`flex-1 px-3 py-2 rounded text-xs font-semibold transition-colors ${
                    direction === 'below'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  Below
                </button>
              </div>
            </div>
            <button
              onClick={handleAddAlert}
              className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded transition-colors"
            >
              Set Alert
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {symbolAlerts.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-500 text-center py-2">No alerts set</p>
        ) : (
          symbolAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-center justify-between p-2 rounded text-xs ${
                alert.triggered
                  ? 'bg-yellow-50 dark:bg-yellow-500/20 border border-yellow-200 dark:border-yellow-500/50'
                  : 'bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {alert.symbol} {alert.direction === 'above' ? '>' : '<'} ${alert.threshold.toFixed(2)}
                  </span>
                  {alert.triggered && (
                    <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 rounded text-xs">
                      Triggered
                    </span>
                  )}
                </div>
                {currentPrice !== null && (
                  <div className="text-gray-600 dark:text-gray-400 mt-1">
                    Current: ${currentPrice.toFixed(2)}
                  </div>
                )}
              </div>
              <div className="flex space-x-1">
                {alert.triggered && (
                  <button
                    onClick={() => resetAlert(alert.id)}
                    className="px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-white text-xs rounded transition-colors"
                  >
                    Reset
                  </button>
                )}
                <button
                  onClick={() => removeAlert(alert.id)}
                  className="px-2 py-1 bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/30 text-red-600 dark:text-red-400 text-xs rounded transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

