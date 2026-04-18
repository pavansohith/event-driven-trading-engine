import { z } from 'zod';

/**
 * Order submission schema
 */
export const orderSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required'),
  side: z.enum(['BUY', 'SELL'], {
    errorMap: () => ({ message: 'Side must be BUY or SELL' }),
  }),
  type: z.enum(['MARKET', 'LIMIT'], {
    errorMap: () => ({ message: 'Type must be MARKET or LIMIT' }),
  }),
  quantity: z.number().positive('Quantity must be positive'),
  price: z.number().positive('Price must be positive').optional(),
}).refine(
  (data) => {
    // Price is required for LIMIT orders
    if (data.type === 'LIMIT' && !data.price) {
      return false;
    }
    return true;
  },
  {
    message: 'Price is required for LIMIT orders',
    path: ['price'],
  }
);

/**
 * Order cancellation schema
 */
export const cancelOrderSchema = z.object({
  orderId: z.string().uuid('Invalid order ID format'),
});

