'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData } from 'lightweight-charts';

interface BasicChartProps {
  symbol?: string;
}

type TimeInterval = '1h' | '4h' | '1d' | '1w' | '1M';
type TimePeriod = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

const INTERVAL_MAP: Record<TimePeriod, { interval: TimeInterval; limit: number }> = {
  '1D': { interval: '1h', limit: 24 },
  '1W': { interval: '4h', limit: 42 },
  '1M': { interval: '1d', limit: 30 },
  '3M': { interval: '1d', limit: 90 },
  '6M': { interval: '1d', limit: 180 },
  '1Y': { interval: '1w', limit: 52 },
  'ALL': { interval: '1M', limit: 200 },
};

export default function BasicChart({ symbol = 'BTCUSDT' }: BasicChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const latestCandleRef = useRef<CandlestickData | null>(null);
  const historicalDataRef = useRef<CandlestickData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1M');
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<{ value: number; percent: number } | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const containerWidth = container.clientWidth || 800;

    // Initialize chart with better visibility settings
    const chart = createChart(container, {
      width: containerWidth,
      height: 500,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333',
        fontSize: 12,
      },
      grid: {
        vertLines: {
          color: '#e0e0e0',
          style: 0,
        },
        horzLines: {
          color: '#e0e0e0',
          style: 0,
        },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#d1d5db',
        rightOffset: 12,
        barSpacing: 8,
        minBarSpacing: 2,
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
        borderColor: '#d1d5db',
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

    // Fetch klines from Binance testnet
    async function fetchKlines() {
      try {
        setLoading(true);
        setError(null);

        const { interval, limit } = INTERVAL_MAP[selectedPeriod];
        const response = await fetch(
          `https://testnet.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch klines: ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
          throw new Error('No data received from Binance');
        }

        // Transform Binance klines to lightweight-charts format
        const candlestickData: CandlestickData[] = data.map((kline: any[]) => {
          const timestamp = Math.floor(kline[0] / 1000);
          return {
            time: timestamp as any,
            open: parseFloat(kline[1]),
            high: parseFloat(kline[2]),
            low: parseFloat(kline[3]),
            close: parseFloat(kline[4]),
          };
        });

        // Calculate current price and change
        if (candlestickData.length > 0) {
          const latest = candlestickData[candlestickData.length - 1];
          if (latest) {
            const previous = candlestickData.length > 1 ? candlestickData[candlestickData.length - 2] : latest;
            if (previous) {
              const price = latest.close;
              const change = price - previous.close;
              const changePercent = ((change / previous.close) * 100);

              setCurrentPrice(price);
              setPriceChange({ value: change, percent: changePercent });
            }
          }
        }

        candlestickSeries.setData(candlestickData);
        
        // Store historical data and latest candle for WebSocket updates
        historicalDataRef.current = candlestickData;
        if (candlestickData.length > 0) {
          const latest = candlestickData[candlestickData.length - 1];
          if (latest) {
            latestCandleRef.current = latest;
          }
        }
        
        chart.timeScale().fitContent();
        setLoading(false);
      } catch (err) {
        console.error('Error fetching klines:', err);
        setError(err instanceof Error ? err.message : 'Failed to load chart data');
        setLoading(false);
      }
    }

    fetchKlines().then(() => {
      // After historical data is loaded, connect WebSocket for real-time updates
      connectWebSocket();
    });

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [symbol, selectedPeriod]);

  // WebSocket connection for real-time updates
  const connectWebSocket = () => {
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    // Determine WebSocket interval based on selected period
    // For real-time, use 1m (1 minute) klines
    const wsInterval = '1m';
    const wsSymbol = symbol.toLowerCase();
    const wsUrl = `wss://testnet.binance.vision/ws/${wsSymbol}@kline_${wsInterval}`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('Binance WebSocket connected for real-time updates');
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.k) {
            // kline data structure
            const kline = data.k;
            const isKlineClosed = kline.x; // x=true means candle is closed
            
            const timestamp = Math.floor(kline.t / 1000); // Convert to seconds
            const candle: CandlestickData = {
              time: timestamp as any,
              open: parseFloat(kline.o),
              high: parseFloat(kline.h),
              low: parseFloat(kline.l),
              close: parseFloat(kline.c),
            };

            if (seriesRef.current) {
              if (isKlineClosed) {
                // Candle is closed, update it
                seriesRef.current.update(candle);
                latestCandleRef.current = candle;
              } else {
                // Candle is still forming, update the latest candle
                if (latestCandleRef.current && latestCandleRef.current.time === candle.time) {
                  // Update existing candle
                  seriesRef.current.update(candle);
                } else {
                  // New candle, add it
                  seriesRef.current.update(candle);
                }
                latestCandleRef.current = candle;
              }

              // Update current price
              setCurrentPrice(parseFloat(kline.c));
              
              // Calculate price change if we have previous data
              if (latestCandleRef.current && historicalDataRef.current.length > 0) {
                const previousClose = historicalDataRef.current[historicalDataRef.current.length - 1]?.close || parseFloat(kline.c);
                const change = parseFloat(kline.c) - previousClose;
                const changePercent = ((change / previousClose) * 100);
                setPriceChange({ value: change, percent: changePercent });
              }
            }
          } else if (data.c) {
            // Ticker data (fallback)
            const price = parseFloat(data.c);
            setCurrentPrice(price);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsConnected(false);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting...');
        setWsConnected(false);
        // Reconnect after 3 seconds
        setTimeout(() => {
          if (chartRef.current && seriesRef.current) {
            connectWebSocket();
          }
        }, 3000);
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to connect WebSocket:', err);
      setWsConnected(false);
    }
  };

  const handleZoomIn = () => {
    if (chartRef.current && seriesRef.current) {
      // Get current visible range and zoom in
      const timeScale = chartRef.current.timeScale();
      const visibleRange = timeScale.getVisibleRange();
      if (visibleRange) {
        // Zoom in by scrolling to show less data
        timeScale.scrollToPosition(-5, false);
      }
    }
  };

  const handleZoomOut = () => {
    if (chartRef.current && seriesRef.current) {
      // Zoom out by scrolling to show more data
      const timeScale = chartRef.current.timeScale();
      timeScale.scrollToPosition(5, false);
    }
  };

  const handlePeriodChange = (period: TimePeriod) => {
    setSelectedPeriod(period);
  };

  return (
    <div className="w-full">
      {/* Price Display and Controls */}
      <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col">
          {currentPrice !== null && (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">
                  ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {priceChange && (
                  <span
                    className={`text-sm font-medium ${
                      priceChange.value >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {priceChange.value >= 0 ? '+' : ''}
                    {priceChange.value.toFixed(2)} ({priceChange.percent >= 0 ? '+' : ''}
                    {priceChange.percent.toFixed(2)}%)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">{symbol}</span>
                {wsConnected && (
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full">
                    Live
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            title="Zoom Out"
          >
            −
          </button>
          <button
            onClick={handleZoomIn}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            title="Zoom In"
          >
            +
          </button>
        </div>
      </div>

      {/* Time Period Selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(['1D', '1W', '1M', '3M', '6M', '1Y', 'ALL'] as TimePeriod[]).map((period) => (
          <button
            key={period}
            onClick={() => handlePeriodChange(period)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              selectedPeriod === period
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {period}
          </button>
        ))}
      </div>

      {/* Chart Container */}
      {loading && (
        <div className="flex items-center justify-center h-[500px] text-gray-500">
          Loading chart data...
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center h-[500px] text-red-500">
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
  );
}

