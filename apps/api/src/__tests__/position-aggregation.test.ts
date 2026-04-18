import { describe, it, expect } from 'vitest';

interface PositionAccumulator {
  quantity: number;
  totalBuyCost: number;
  totalBuyQuantity: number;
}

interface OrderEvent {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
}

/**
 * Position aggregation logic extracted for testing
 */
function aggregatePositions(events: OrderEvent[]) {
  const positionsMap = new Map<string, PositionAccumulator>();

  for (const event of events) {
    const symbol = event.symbol;
    const side = event.side;
    const quantity = event.quantity;
    const price = event.price;

    if (!positionsMap.has(symbol)) {
      positionsMap.set(symbol, {
        quantity: 0,
        totalBuyCost: 0,
        totalBuyQuantity: 0,
      });
    }

    const position = positionsMap.get(symbol)!;

    if (side === 'BUY') {
      position.quantity += quantity;
      position.totalBuyCost += price * quantity;
      position.totalBuyQuantity += quantity;
    } else if (side === 'SELL') {
      position.quantity -= quantity;
    }
  }

  return Array.from(positionsMap.entries())
    .map(([symbol, acc]) => {
      const avgEntryPrice =
        acc.totalBuyQuantity > 0 ? acc.totalBuyCost / acc.totalBuyQuantity : 0;

      return {
        symbol,
        quantity: acc.quantity,
        avgEntryPrice,
      };
    })
    .filter((pos) => pos.quantity > 0)
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}

describe('Position Aggregation', () => {
  it('should calculate positions correctly for BUY orders', () => {
    const events: OrderEvent[] = [
      { symbol: 'BTCUSDT', side: 'BUY', quantity: 1, price: 50000 },
      { symbol: 'BTCUSDT', side: 'BUY', quantity: 0.5, price: 51000 },
    ];

    const positions = aggregatePositions(events);

    expect(positions).toHaveLength(1);
    expect(positions[0]).toEqual({
      symbol: 'BTCUSDT',
      quantity: 1.5,
      avgEntryPrice: 50333.33, // (50000 * 1 + 51000 * 0.5) / 1.5
    });
  });

  it('should decrease quantity on SELL orders', () => {
    const events: OrderEvent[] = [
      { symbol: 'BTCUSDT', side: 'BUY', quantity: 2, price: 50000 },
      { symbol: 'BTCUSDT', side: 'SELL', quantity: 0.5, price: 52000 },
    ];

    const positions = aggregatePositions(events);

    expect(positions).toHaveLength(1);
    expect(positions[0]?.quantity).toBe(1.5);
    expect(positions[0]?.avgEntryPrice).toBe(50000); // Only BUY orders affect avg price
  });

  it('should exclude positions with zero quantity', () => {
    const events: OrderEvent[] = [
      { symbol: 'BTCUSDT', side: 'BUY', quantity: 1, price: 50000 },
      { symbol: 'BTCUSDT', side: 'SELL', quantity: 1, price: 52000 },
    ];

    const positions = aggregatePositions(events);

    expect(positions).toHaveLength(0);
  });

  it('should handle multiple symbols', () => {
    const events: OrderEvent[] = [
      { symbol: 'BTCUSDT', side: 'BUY', quantity: 1, price: 50000 },
      { symbol: 'ETHUSDT', side: 'BUY', quantity: 10, price: 3000 },
    ];

    const positions = aggregatePositions(events);

    expect(positions).toHaveLength(2);
    expect(positions[0]?.symbol).toBe('BTCUSDT');
    expect(positions[1]?.symbol).toBe('ETHUSDT');
  });

  it('should sort positions by symbol', () => {
    const events: OrderEvent[] = [
      { symbol: 'ETHUSDT', side: 'BUY', quantity: 1, price: 3000 },
      { symbol: 'BTCUSDT', side: 'BUY', quantity: 1, price: 50000 },
    ];

    const positions = aggregatePositions(events);

    expect(positions).toHaveLength(2);
    expect(positions[0]?.symbol).toBe('BTCUSDT');
    expect(positions[1]?.symbol).toBe('ETHUSDT');
  });
});

