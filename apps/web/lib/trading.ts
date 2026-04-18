import { api } from './api';

export interface Order {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity: number;
  price: number | null;
  status: 'PENDING' | 'FILLED' | 'REJECTED' | 'CANCELED';
  executedPrice: number | null;
  executedQuantity: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderResponse {
  orderId: string;
  status: 'PENDING';
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity: number;
  price: number | null;
}

export interface OrdersResponse {
  orders: Order[];
}

export interface SubmitOrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity: number;
  price?: number;
}

export interface Position {
  symbol: string;
  quantity: number;
  avgEntryPrice: number;
}

/**
 * Submit a new trading order
 */
export async function submitOrder(order: SubmitOrderRequest): Promise<OrderResponse> {
  const response = await api.post<OrderResponse>('/api/trading/orders', order);
  return response.data;
}

/**
 * Get all orders for the authenticated user
 */
export async function getOrders(): Promise<Order[]> {
  const response = await api.get<OrdersResponse>('/api/trading/orders');
  return response.data.orders;
}

/**
 * Get current positions for the authenticated user
 */
export async function getPositions(): Promise<Position[]> {
  const response = await api.get<Position[]>('/api/trading/positions');
  return response.data;
}

/**
 * Cancel a pending order
 */
export async function cancelOrder(orderId: string): Promise<{ message: string; orderId: string }> {
  const response = await api.post<{ message: string; orderId: string }>('/api/trading/cancel', { orderId });
  return response.data;
}

