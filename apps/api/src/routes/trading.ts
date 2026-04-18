import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { orderSchema, cancelOrderSchema } from '../schemas/trading';

const router = Router();

// Redis publisher for order commands
// REDIS_URL is required (no localhost fallback for production)
if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL environment variable is required');
}
const redisPublisher = new Redis(process.env.REDIS_URL);

/**
 * POST /api/trading/orders
 * Submit a new trading order
 * Protected route - requires JWT authentication
 */
router.post('/orders', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Validate request body
    const validationResult = orderSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    const { symbol, side, type, quantity, price } = validationResult.data;

    // Get user ID from authenticated request
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Generate unique order ID
    const orderId = uuidv4();

    // Create order command message for Redis
    const orderCommand = {
      orderId,
      userId,
      symbol,
      side,
      type,
      quantity,
      price: price || null,
      timestamp: new Date().toISOString(),
    };

    // Publish order command to Redis channel
    await redisPublisher.publish(
      'commands:order:submit',
      JSON.stringify(orderCommand)
    );

    console.log(`Published order command: ${orderId} for user: ${userId}`);

    // Return immediate response with PENDING status
    res.status(202).json({
      orderId,
      status: 'PENDING',
      symbol,
      side,
      type,
      quantity,
      price: price || null,
    });
  } catch (error) {
    console.error('Error submitting order:', error);
    res.status(500).json({
      error: 'Failed to submit order',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/trading/orders
 * Get all orders for the authenticated user
 * Protected route - requires JWT authentication
 */
router.get('/orders', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch orders from database
    const orders = await prisma.orderCommand.findMany({
      where: {
        userId,
      },
      include: {
        events: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1, // Get the latest event for each order
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform orders to include latest status
    const ordersWithStatus = orders.map((order) => {
      const latestEvent = order.events[0];
      return {
        orderId: order.id,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        quantity: order.quantity,
        price: order.price,
        status: latestEvent?.status || order.status,
        executedPrice: latestEvent?.executedPrice || null,
        executedQuantity: latestEvent?.executedQuantity || null,
        createdAt: order.createdAt.toISOString(),
        updatedAt: latestEvent?.createdAt.toISOString() || order.createdAt.toISOString(),
      };
    });

    res.json({ orders: ordersWithStatus });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      error: 'Failed to fetch orders',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Interface for position aggregation accumulator
 */
interface PositionAccumulator {
  quantity: number;
  totalBuyCost: number;
  totalBuyQuantity: number;
}

/**
 * GET /api/trading/positions
 * Get current positions for the authenticated user
 * Positions are derived from FILLED order events only
 * Protected route - requires JWT authentication
 */
router.get('/positions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch FILLED order events for this user
    // We join through OrderCommand to filter by userId
    // Only FILLED events represent executed trades that affect positions
    const events = await prisma.orderEvent.findMany({
      where: {
        status: 'FILLED',
        orderCommand: {
          userId: userId,
        },
      },
      include: {
        orderCommand: {
          select: {
            symbol: true,
            side: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Aggregate events by symbol to calculate positions
    // BUY increases quantity and cost, SELL decreases quantity
    const positionsMap = new Map<string, PositionAccumulator>();

    for (const event of events) {
      const symbol = event.orderCommand.symbol;
      const side = event.orderCommand.side as 'BUY' | 'SELL';
      const quantity = event.executedQuantity || 0;
      const price = event.executedPrice || 0;

      // Initialize accumulator for symbol if not exists
      if (!positionsMap.has(symbol)) {
        positionsMap.set(symbol, {
          quantity: 0,
          totalBuyCost: 0,
          totalBuyQuantity: 0,
        });
      }

      const position = positionsMap.get(symbol)!;

      if (side === 'BUY') {
        // BUY: increase quantity and track cost
        position.quantity += quantity;
        position.totalBuyCost += price * quantity;
        position.totalBuyQuantity += quantity;
      } else if (side === 'SELL') {
        // SELL: decrease quantity (cost basis remains from BUYs)
        position.quantity -= quantity;
      }
    }

    // Convert map to array and calculate average entry price
    const positions = Array.from(positionsMap.entries())
      .map(([symbol, acc]) => {
        // Calculate average entry price from BUY orders only
        const avgEntryPrice =
          acc.totalBuyQuantity > 0 ? acc.totalBuyCost / acc.totalBuyQuantity : 0;

        return {
          symbol,
          quantity: acc.quantity,
          avgEntryPrice,
        };
      })
      // Exclude positions with zero quantity
      .filter((pos) => pos.quantity > 0)
      // Sort by symbol for consistent output
      .sort((a, b) => a.symbol.localeCompare(b.symbol));

    res.json(positions);
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({
      error: 'Failed to fetch positions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/trading/cancel
 * Cancel a pending order
 * Protected route - requires JWT authentication
 */
router.post('/cancel', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Validate request body
    const validationResult = cancelOrderSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    const { orderId } = validationResult.data;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify order belongs to user and is cancellable
    const order = await prisma.orderCommand.findFirst({
      where: {
        id: orderId,
        userId,
      },
      include: {
        events: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if order is already filled or rejected
    const latestEvent = order.events[0];
    if (latestEvent && (latestEvent.status === 'FILLED' || latestEvent.status === 'REJECTED' || latestEvent.status === 'CANCELED')) {
      return res.status(400).json({
        error: `Order cannot be canceled. Current status: ${latestEvent.status}`,
      });
    }

    // Publish cancel command to Redis
    const cancelCommand = {
      orderId,
      userId,
      timestamp: new Date().toISOString(),
    };

    await redisPublisher.publish(
      'commands:order:cancel',
      JSON.stringify(cancelCommand)
    );

    console.log(`Published cancel command: ${orderId} for user: ${userId}`);

    res.json({
      message: 'Cancel command sent',
      orderId,
    });
  } catch (error) {
    console.error('Error canceling order:', error);
    res.status(500).json({
      error: 'Failed to cancel order',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

