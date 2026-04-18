import { useEffect, useState, useCallback } from 'react';

export interface PriceAlert {
  id: string;
  symbol: string;
  threshold: number;
  direction: 'above' | 'below';
  triggered: boolean;
}

const STORAGE_KEY = 'price_alerts';

/**
 * Hook to manage price alerts
 * Stores alerts in localStorage and provides functions to manage them
 */
export function usePriceAlerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);

  // Load alerts from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setAlerts(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading price alerts:', error);
    }
  }, []);

  // Save alerts to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
    } catch (error) {
      console.error('Error saving price alerts:', error);
    }
  }, [alerts]);

  const addAlert = useCallback((alert: Omit<PriceAlert, 'id' | 'triggered'>) => {
    const newAlert: PriceAlert = {
      ...alert,
      id: `${Date.now()}-${Math.random()}`,
      triggered: false,
    };
    setAlerts((prev) => [...prev, newAlert]);
  }, []);

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  }, []);

  const checkAlerts = useCallback((symbol: string, currentPrice: number): PriceAlert[] => {
    const triggered: PriceAlert[] = [];
    
    setAlerts((prev) => {
      return prev.map((alert) => {
        if (alert.symbol === symbol && !alert.triggered) {
          const shouldTrigger =
            (alert.direction === 'above' && currentPrice >= alert.threshold) ||
            (alert.direction === 'below' && currentPrice <= alert.threshold);
          
          if (shouldTrigger) {
            triggered.push({ ...alert, triggered: true });
            return { ...alert, triggered: true };
          }
        }
        return alert;
      });
    });

    return triggered;
  }, []);

  const resetAlert = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((alert) => (alert.id === id ? { ...alert, triggered: false } : alert))
    );
  }, []);

  return {
    alerts,
    addAlert,
    removeAlert,
    checkAlerts,
    resetAlert,
  };
}

