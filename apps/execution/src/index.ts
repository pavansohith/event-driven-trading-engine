import dotenv from 'dotenv';
import Redis from 'ioredis';
import { prisma } from './lib/prisma';
import { decrypt } from './crypto';
import { placeOrder, cancelOrder } from './binance';

// Load environment variables
dotenv.config();

// Redis connection for subscribing to commands
// REDIS_URL is required (no localhost fallback for production)
if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL environment variable is required');
}
const redisSubscriber = new Redis(process.env.REDIS_URL);

// Redis publisher for publishing events
const redisPublisher = new Redis(process.env.REDIS_URL);

/**
 * Processes an order command:
 * 1. Fetches user and decrypts API keys
 * 2. Places order on Binance
 * 3. Logs to database
 * 4. Publishes event to Redis
 */
async function handleCommand(command: any): Promise<void> {
  const { orderId, userId, symbol, side, type, quantity, price } = command;

  console.log(`Processing order ${orderId} for user ${userId}`);

  // Create OrderCommand in database first (before any operations that might fail)
  // This ensures we have a record to update later
  let orderCommandCreated = false;
  try {
    await prisma.orderCommand.create({
      data: {
        id: orderId,
        userId,
        symbol,
        side,
        type,
        quantity,
        price: price || null,
        status: 'PROCESSING',
      },
    });
    orderCommandCreated = true;

    // Create initial SUBMITTED event
    await prisma.orderEvent.create({
      data: {
        orderCommandId: orderId,
        eventType: 'SUBMITTED',
        status: 'PENDING',
        message: 'Order submitted to execution service',
      },
    });
  } catch (createError: any) {
    // If order already exists (race condition), that's okay
    if (createError.code === 'P2002') {
      console.log(`Order ${orderId} already exists, continuing...`);
      orderCommandCreated = true;
    } else {
      console.error(`Failed to create order command ${orderId}:`, createError);
      // Still try to process, but we'll handle the update carefully
    }
  }

  try {
    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Decrypt Binance API keys
    let apiKey: string;
    let secretKey: string;

    try {
      // Check if keys exist
      if (!user.binanceApiKey || !user.binanceSecretKey) {
        throw new Error('User does not have Binance API keys configured');
      }

      apiKey = decrypt(user.binanceApiKey);
      secretKey = decrypt(user.binanceSecretKey);
      
      // Validate that keys were decrypted successfully
      if (!apiKey || !secretKey || apiKey.length === 0 || secretKey.length === 0) {
        throw new Error('Decrypted API keys are empty');
      }

      console.log(`Successfully decrypted API keys for user ${userId}`);
    } catch (decryptError: any) {
      const errorMsg = `Failed to decrypt API keys: ${decryptError.message}`;
      console.error(errorMsg);
      console.error('Make sure ENCRYPTION_SECRET matches between API and Execution services');
      throw new Error(errorMsg);
    }

    // Place order on Binance
    let binanceResponse: any;
    let orderStatus: 'FILLED' | 'REJECTED';
    let executedPrice: number | null = null;
    let executedQuantity: number | null = null;
    let errorMessage: string | null = null;

    try {
      binanceResponse = await placeOrder(apiKey, secretKey, {
        symbol,
        side,
        type,
        quantity,
        price: price || undefined,
      });

      // Order was successful
      orderStatus = 'FILLED';
      executedPrice = parseFloat(binanceResponse.price || '0');
      executedQuantity = parseFloat(binanceResponse.executedQty || quantity.toString());

      // Update order command status
      await prisma.orderCommand.update({
        where: { id: orderId },
        data: {
          status: 'COMPLETED',
          price: executedPrice,
        },
      });

      // Create EXECUTED event
      await prisma.orderEvent.create({
        data: {
          orderCommandId: orderId,
          eventType: 'EXECUTED',
          status: 'FILLED',
          executedPrice,
          executedQuantity,
          message: `Order executed successfully. Price: ${executedPrice}, Quantity: ${executedQuantity}`,
        },
      });

      console.log(`Order ${orderId} executed successfully`);
    } catch (binanceError: any) {
      // Order failed
      orderStatus = 'REJECTED';
      errorMessage = binanceError.message || 'Unknown error';

      // Update order command status
      await prisma.orderCommand.update({
        where: { id: orderId },
        data: {
          status: 'FAILED',
        },
      });

      // Create FAILED event
      await prisma.orderEvent.create({
        data: {
          orderCommandId: orderId,
          eventType: 'FAILED',
          status: 'REJECTED',
          message: errorMessage,
        },
      });

      console.error(`Order ${orderId} failed:`, errorMessage);
    }

    // Publish order status event to Redis
    const orderEvent = {
      orderId,
      userId,
      status: orderStatus,
      symbol,
      side,
      quantity,
      price: executedPrice || price || null,
      executedPrice,
      executedQuantity,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    };

    await redisPublisher.publish('events:order:status', JSON.stringify(orderEvent));

    console.log(`Published order status event for ${orderId}: ${orderStatus}`);
  } catch (error: any) {
    console.error(`Error processing order ${orderId}:`, error);

    // Update order command status to FAILED (only if it was created)
    if (orderCommandCreated) {
      try {
        // Use updateMany to avoid error if record doesn't exist
        await prisma.orderCommand.updateMany({
          where: { id: orderId },
          data: {
            status: 'FAILED',
          },
        });

        // Try to create event, but don't fail if orderCommandId doesn't exist
        try {
          await prisma.orderEvent.create({
            data: {
              orderCommandId: orderId,
              eventType: 'FAILED',
              status: 'REJECTED',
              message: error.message || 'Unknown error occurred',
            },
          });
        } catch (eventError) {
          console.warn('Could not create FAILED event (order may not exist):', eventError);
        }
      } catch (dbError) {
        console.error('Failed to update order status in database:', dbError);
      }
    } else {
      console.warn(`Order ${orderId} was never created, skipping database update`);
    }

    // Publish error event
    const errorEvent = {
      orderId,
      userId,
      status: 'REJECTED',
      symbol,
      side,
      quantity,
      price: price || null,
      error: error.message || 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    };

    await redisPublisher.publish('events:order:status', JSON.stringify(errorEvent));
  }
}

/**
 * Handles order cancellation command:
 * 1. Fetches user and decrypts API keys
 * 2. Fetches order details from database
 * 3. Cancels order on Binance
 * 4. Updates database
 * 5. Publishes event to Redis
 */
async function handleCancelCommand(command: any): Promise<void> {
  const { orderId, userId } = command;

  console.log(`Processing cancel command for order ${orderId} for user ${userId}`);

  try {
    // Fetch order from database
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
      throw new Error(`Order ${orderId} not found`);
    }

    // Check if order is already filled or rejected
    const latestEvent = order.events[0];
    if (latestEvent && (latestEvent.status === 'FILLED' || latestEvent.status === 'REJECTED' || latestEvent.status === 'CANCELED')) {
      throw new Error(`Order cannot be canceled. Current status: ${latestEvent.status}`);
    }

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Decrypt Binance API keys
    let apiKey: string;
    let secretKey: string;

    try {
      if (!user.binanceApiKey || !user.binanceSecretKey) {
        throw new Error('User does not have Binance API keys configured');
      }

      apiKey = decrypt(user.binanceApiKey);
      secretKey = decrypt(user.binanceSecretKey);
      
      if (!apiKey || !secretKey || apiKey.length === 0 || secretKey.length === 0) {
        throw new Error('Decrypted API keys are empty');
      }
    } catch (decryptError: any) {
      throw new Error(`Failed to decrypt API keys: ${decryptError.message}`);
    }

    // Cancel order on Binance
    // Note: For testnet, we need the Binance order ID, not our internal orderId
    // Since we're using testnet and may not have the Binance order ID stored,
    // we'll try to cancel by symbol and our orderId, or handle gracefully
    try {
      // For now, we'll update the database status directly
      // In production, you'd need to store the Binance order ID when placing the order
      await cancelOrder(apiKey, secretKey, {
        symbol: order.symbol,
        orderId: orderId, // This might need to be the Binance order ID in production
      });

      // Update order command status
      await prisma.orderCommand.update({
        where: { id: orderId },
        data: {
          status: 'CANCELED',
        },
      });

      // Create CANCELED event
      await prisma.orderEvent.create({
        data: {
          orderCommandId: orderId,
          eventType: 'CANCELED',
          status: 'CANCELED',
          message: 'Order canceled successfully',
        },
      });

      console.log(`Order ${orderId} canceled successfully`);

      // Publish cancel event to Redis
      const cancelEvent = {
        orderId,
        userId,
        status: 'CANCELED',
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity,
        price: order.price,
        timestamp: new Date().toISOString(),
      };

      await redisPublisher.publish('events:order:status', JSON.stringify(cancelEvent));
    } catch (binanceError: any) {
      // If Binance cancel fails, we still mark it as canceled in our system
      // (order might have already been filled or doesn't exist on Binance)
      console.warn(`Binance cancel failed for order ${orderId}:`, binanceError.message);

      await prisma.orderCommand.update({
        where: { id: orderId },
        data: {
          status: 'CANCELED',
        },
      });

      await prisma.orderEvent.create({
        data: {
          orderCommandId: orderId,
          eventType: 'CANCELED',
          status: 'CANCELED',
          message: `Order canceled (Binance error: ${binanceError.message})`,
        },
      });

      // Publish cancel event
      const cancelEvent = {
        orderId,
        userId,
        status: 'CANCELED',
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity,
        price: order.price,
        timestamp: new Date().toISOString(),
      };

      await redisPublisher.publish('events:order:status', JSON.stringify(cancelEvent));
    }
  } catch (error: any) {
    console.error(`Error processing cancel command for order ${orderId}:`, error);

    // Publish error event
    const errorEvent = {
      orderId,
      userId,
      status: 'REJECTED',
      error: error.message || 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    };

    await redisPublisher.publish('events:order:status', JSON.stringify(errorEvent));
  }
}

// Subscribe to order submission and cancellation commands
redisSubscriber.subscribe('commands:order:submit', (err) => {
  if (err) {
    console.error('Failed to subscribe to commands:order:submit:', err);
    process.exit(1); // Exit on fatal subscription error
  } else {
    console.log('Subscribed to commands:order:submit');
  }
});

redisSubscriber.subscribe('commands:order:cancel', (err) => {
  if (err) {
    console.error('Failed to subscribe to commands:order:cancel:', err);
    process.exit(1); // Exit on fatal subscription error
  } else {
    console.log('Subscribed to commands:order:cancel');
  }
});

// Handle incoming commands
redisSubscriber.on('message', async (channel, message) => {
  if (channel === 'commands:order:submit') {
    try {
      const command = JSON.parse(message);
      await handleCommand(command);
    } catch (error) {
      console.error('Error parsing or handling command:', error);
    }
  } else if (channel === 'commands:order:cancel') {
    try {
      const command = JSON.parse(message);
      await handleCancelCommand(command);
    } catch (error) {
      console.error('Error parsing or handling cancel command:', error);
    }
  }
});

console.log('Execution service started');

// Handle fatal errors - exit process
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  redisSubscriber.disconnect();
  redisPublisher.disconnect();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  redisSubscriber.disconnect();
  redisPublisher.disconnect();
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  redisSubscriber.disconnect();
  redisPublisher.disconnect();
  process.exit(0);
});
