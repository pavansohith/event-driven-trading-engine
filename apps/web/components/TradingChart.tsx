'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData } from 'lightweight-charts';

type Timeframe = '1m' | '5m' | '1h' | '1d' | '1w';

/**
 * Convert Binance kline array to lightweight-charts format
 * Binance format: [timestamp, open, high, low, close, volume, ...]
 */
function binanceKlineToCandle(kline: any[]): CandlestickData {
  const timestamp = Math.floor(kline[0] / 1000); // Convert milliseconds to seconds
  return {
    time: timestamp as any,
    open: parseFloat(kline[1]),
    high: parseFloat(kline[2]),
    low: parseFloat(kline[3]),
    close: parseFloat(kline[4]),
  };
}

interface TradingChartProps {
  symbol?: string;
  onPriceUpdate?: (price: number) => void;
}

export default function TradingChart({ symbol = 'BTCUSDT', onPriceUpdate }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isSettingUpWsRef = useRef(false);
  const dataLoadedRef = useRef(false);
  const latestCandleTimeRef = useRef<number | null>(null);
  
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>('1h');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number | null>(null);

  // Load candles from REST API
  const loadCandles = async (interval: string, symbolToLoad: string): Promise<void> => {
    if (!seriesRef.current) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch the most recent candles - Binance returns data in reverse chronological order
      // We request more than needed to ensure we get the latest data
      const response = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${symbolToLoad}&interval=${interval}&limit=500`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch klines: ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('No data received from Binance');
      }

      // Convert to chart format and update chart
      // Binance returns data in chronological order (oldest first), so the last item is the most recent
      const candlestickData: CandlestickData[] = data.map(binanceKlineToCandle);
      
      // Determine how many candles to show based on timeframe
      // Fewer candles = more granular time labels
      let candleLimit: number;
      switch (interval) {
        case '1m':
          candleLimit = 60; // Show last 60 minutes for 1m timeframe
          break;
        case '5m':
          candleLimit = 100; // Show last ~8 hours for 5m timeframe
          break;
        case '1h':
          candleLimit = 168; // Show last week for 1h timeframe
          break;
        case '1d':
          candleLimit = 90; // Show last 90 days for 1d timeframe
          break;
        case '1w':
          candleLimit = 52; // Show last year for 1w timeframe
          break;
        default:
          candleLimit = 200;
      }
      
      // Take only the last N candles to keep the chart performant and show appropriate time granularity
      // This ensures we show the most recent data with proper time label frequency
      const recentCandles = candlestickData.slice(-candleLimit);
      
      // Update last price and calculate price change from latest candle
      if (recentCandles.length > 0) {
        const latestCandle = recentCandles[recentCandles.length - 1];
        const firstCandle = recentCandles[0];
        if (latestCandle && firstCandle) {
          setLastPrice(latestCandle.close);
          if (onPriceUpdate) {
            onPriceUpdate(latestCandle.close);
          }
          // Calculate price change percentage
          const change = ((latestCandle.close - firstCandle.open) / firstCandle.open) * 100;
          setPriceChange(change);
          // Store the latest candle time for WebSocket updates
          latestCandleTimeRef.current = latestCandle.time as number;
        }
      }
      
      seriesRef.current.setData(recentCandles);
      // Fit content to show all data, which will display the latest candles on the right
      chartRef.current?.timeScale().fitContent();
      dataLoadedRef.current = true;
      setLoading(false);
    } catch (err) {
      console.error('Error loading candles:', err);
      setError(err instanceof Error ? err.message : 'Failed to load chart data');
      setLoading(false);
    }
  };

  // Initialize chart once on mount
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const containerWidth = container.clientWidth || 800;

    const chart = createChart(container, {
      width: containerWidth,
      height: 500,
      layout: {
        background: { color: '#111827' }, // Dark gray-900
        textColor: '#9ca3af', // Gray-400
        fontSize: 12,
      },
      grid: {
        vertLines: {
          color: '#374151', // Gray-700
          style: 0,
        },
        horzLines: {
          color: '#374151', // Gray-700
          style: 0,
        },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#374151', // Gray-700
        rightOffset: 12,
        barSpacing: 8,
        minBarSpacing: 2,
        rightBarStaysOnScroll: true,
        lockVisibleTimeRangeOnResize: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
      rightPriceScale: {
        borderColor: '#374151', // Gray-700
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      crosshair: {
        mode: 1,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      
      // Close WebSocket if open
      if (wsRef.current) {
        const ws = wsRef.current;
        if (ws.readyState !== WebSocket.CLOSED) {
          ws.close();
        }
        wsRef.current = null;
      }
      
      // Remove chart instance
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []); // Run only once on mount

  // Handle timeframe changes: load data and manage WebSocket
  useEffect(() => {
    // Wait for chart to be ready
    if (!chartRef.current || !seriesRef.current) {
      return;
    }

    // Store current timeframe to check in async callbacks
    const currentTimeframe = activeTimeframe;

    // Safely close existing WebSocket connection
    // Guard: only close if not already closed and not in the middle of setup
    if (wsRef.current && !isSettingUpWsRef.current) {
      const ws = wsRef.current;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
        console.log('WS closed');
      }
      wsRef.current = null;
    }

    // Determine interval for REST API call
    // Map timeframe to Binance interval format
    const interval = activeTimeframe;

    // Reset data loaded flag when switching timeframes or symbols
    dataLoadedRef.current = false;
    
    // Load fresh historical candles for the selected timeframe and symbol
    const currentSymbol = symbol;
    loadCandles(interval, currentSymbol).then(() => {
      // Only open WebSocket for real-time timeframes (1m, 5m, 1h) after data is loaded
      // 1d and 1w are historical only - no real-time updates needed
      const realTimeTimeframes: Timeframe[] = ['1m', '5m', '1h'];
      if (realTimeTimeframes.includes(currentTimeframe) && dataLoadedRef.current && !wsRef.current) {
        isSettingUpWsRef.current = true;
        // Convert symbol to lowercase for WebSocket stream
        const symbolLower = currentSymbol.toLowerCase();
        const wsUrl = `wss://stream.binance.com:9443/ws/${symbolLower}@kline_${currentTimeframe}`;

        try {
          const ws = new WebSocket(wsUrl);

          ws.onopen = () => {
            isSettingUpWsRef.current = false;
            // Only log if this is still the active WebSocket and timeframe is still a real-time one
            if (wsRef.current === ws && realTimeTimeframes.includes(currentTimeframe)) {
              console.log('WS connected');
            }
          };

          ws.onmessage = (event) => {
            // Only process if this is still the active WebSocket, data is loaded, and timeframe is still a real-time one
            if (wsRef.current !== ws || !seriesRef.current || !dataLoadedRef.current || !realTimeTimeframes.includes(currentTimeframe)) {
              return;
            }

            try {
              const data = JSON.parse(event.data);

              if (data.k) {
                const kline = data.k;
                const timestamp = Math.floor(kline.t / 1000);
                
                // Only update if we have a valid latest candle time reference
                // and the incoming candle time is >= the latest candle time
                // This prevents trying to update older candles which causes the error
                if (latestCandleTimeRef.current !== null && timestamp < latestCandleTimeRef.current) {
                  // Ignore older candles - they're likely stale updates
                  return;
                }
                
                const candle: CandlestickData = {
                  time: timestamp as any,
                  open: parseFloat(kline.o),
                  high: parseFloat(kline.h),
                  low: parseFloat(kline.l),
                  close: parseFloat(kline.c),
                };

                // Update the candle - series.update() will update existing candle with matching time
                // or add a new one if time doesn't match
                // This updates the chart in real-time without full re-render
                try {
                  if (seriesRef.current) {
                    seriesRef.current.update(candle);
                  }
                  
                  // Track the latest candle time
                  latestCandleTimeRef.current = timestamp;
                  
                  // Update last price from WebSocket
                  const newPrice = parseFloat(kline.c);
                  setLastPrice(newPrice);
                  if (onPriceUpdate) {
                    onPriceUpdate(newPrice);
                  }
                } catch (updateErr) {
                  // If update fails (e.g., trying to update oldest data), ignore it
                  // This can happen with race conditions or stale WebSocket messages
                  console.warn('Failed to update candle:', updateErr);
                }
              }
            } catch (err) {
              console.error('Error parsing WebSocket message:', err);
            }
          };

          ws.onerror = (error) => {
            isSettingUpWsRef.current = false;
            // Only log if this is still the active WebSocket
            if (wsRef.current === ws) {
              console.error('WS error', error);
            }
          };

          ws.onclose = () => {
            isSettingUpWsRef.current = false;
            // Only log if this is still the active WebSocket
            if (wsRef.current === ws) {
              console.log('WS closed');
              wsRef.current = null;
            }
          };

          wsRef.current = ws;
        } catch (err) {
          isSettingUpWsRef.current = false;
          console.error('Failed to connect WebSocket:', err);
        }
      }
    });

    // Cleanup: close WebSocket on timeframe change or unmount
    // Guard: only close if it exists and is not already closed
    return () => {
      if (wsRef.current && !isSettingUpWsRef.current) {
        const ws = wsRef.current;
        if (ws.readyState !== WebSocket.CLOSED) {
          ws.close();
        }
        wsRef.current = null;
      }
    };
  }, [activeTimeframe, symbol]); // Re-run when timeframe or symbol changes

  // Update time scale format and bar spacing based on active timeframe
  useEffect(() => {
    if (!chartRef.current) return;

    const timeScale = chartRef.current.timeScale();
    
    // Configure time format and bar spacing based on timeframe
    switch (activeTimeframe) {
      case '1m':
        // For 1-minute candles, show hours:minutes:seconds with tighter spacing
        timeScale.applyOptions({
          timeVisible: true,
          secondsVisible: true,
          barSpacing: 2,
          minBarSpacing: 1,
        });
        chartRef.current.applyOptions({
          localization: {
            timeFormatter: (businessDayOrTimestamp: number) => {
              const date = new Date(businessDayOrTimestamp * 1000);
              return date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit',
                hour12: false 
              });
            },
          },
        });
        break;
      case '5m':
        // For 5-minute candles, show hours:minutes
        timeScale.applyOptions({
          timeVisible: true,
          secondsVisible: false,
          barSpacing: 4,
          minBarSpacing: 2,
        });
        chartRef.current.applyOptions({
          localization: {
            timeFormatter: (businessDayOrTimestamp: number) => {
              const date = new Date(businessDayOrTimestamp * 1000);
              return date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
              });
            },
          },
        });
        break;
      case '1h':
        // For 1-hour candles, show date and hour
        timeScale.applyOptions({
          timeVisible: true,
          secondsVisible: false,
          barSpacing: 8,
          minBarSpacing: 2,
        });
        chartRef.current.applyOptions({
          localization: {
            timeFormatter: (businessDayOrTimestamp: number) => {
              const date = new Date(businessDayOrTimestamp * 1000);
              return date.toLocaleString('en-US', { 
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                hour12: false 
              });
            },
          },
        });
        break;
      case '1d':
        // For 1-day candles, show date
        timeScale.applyOptions({
          timeVisible: true,
          secondsVisible: false,
          barSpacing: 8,
          minBarSpacing: 2,
        });
        chartRef.current.applyOptions({
          localization: {
            timeFormatter: (businessDayOrTimestamp: number) => {
              const date = new Date(businessDayOrTimestamp * 1000);
              return date.toLocaleDateString('en-US', { 
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });
            },
          },
        });
        break;
      case '1w':
        // For 1-week candles, show date
        timeScale.applyOptions({
          timeVisible: true,
          secondsVisible: false,
          barSpacing: 8,
          minBarSpacing: 2,
        });
        chartRef.current.applyOptions({
          localization: {
            timeFormatter: (businessDayOrTimestamp: number) => {
              const date = new Date(businessDayOrTimestamp * 1000);
              return date.toLocaleDateString('en-US', { 
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });
            },
          },
        });
        break;
    }
    
    // Force chart to refresh time scale display
    chartRef.current.timeScale().fitContent();
  }, [activeTimeframe]);

  const handleTimeframeChange = (timeframe: Timeframe) => {
    setActiveTimeframe(timeframe);
  };

  return (
    <div className="w-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
      {/* Price Display */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-lg font-semibold text-gray-900 dark:text-white">{symbol}</span>
            {lastPrice !== null && (
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                ${lastPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
            {priceChange !== null && (
              <span
                className={`text-sm font-semibold ${
                  priceChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}
              >
                {priceChange >= 0 ? '+' : ''}
                {priceChange.toFixed(2)}%
              </span>
            )}
          </div>
          {(['1m', '5m', '1h'] as Timeframe[]).includes(activeTimeframe) && (
            <span className="px-2 py-1 text-xs font-medium text-white bg-green-500 rounded">
              LIVE
            </span>
          )}
        </div>
      </div>

      {/* Timeframe Tabs */}
      <div className="px-4 pt-4 flex gap-2 border-b border-gray-200 dark:border-gray-800">
        {(['1m', '5m', '1h', '1d', '1w'] as Timeframe[]).map((timeframe) => (
          <button
            key={timeframe}
            onClick={() => handleTimeframeChange(timeframe)}
            className={`px-4 py-2 text-sm font-medium transition-colors rounded-t ${
              activeTimeframe === timeframe
                ? 'bg-gray-100 dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-t border-x border-gray-300 dark:border-gray-700'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            {timeframe}
          </button>
        ))}
      </div>

      {/* Chart Container */}
      <div className="p-4">
        {loading && (
          <div className="flex items-center justify-center h-[500px] text-gray-600 dark:text-gray-400">
            Loading chart data...
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-[500px] text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
        <div
          ref={chartContainerRef}
          className="w-full"
          style={{
            display: loading || error ? 'none' : 'block',
            height: '500px',
            minHeight: '500px',
          }}
        />
      </div>
    </div>
  );
}
