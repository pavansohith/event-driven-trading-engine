import { describe, it, expect } from 'vitest';
import { loginSchema, registerSchema } from '../schemas/auth';
import { orderSchema, cancelOrderSchema } from '../schemas/trading';

describe('Auth Schemas', () => {
  describe('loginSchema', () => {
    it('should validate correct login data', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = loginSchema.safeParse({
        email: 'invalid-email',
        password: 'password123',
      });

      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: '',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('should validate correct registration data', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        binanceApiKey: 'api-key',
        binanceSecretKey: 'secret-key',
      });

      expect(result.success).toBe(true);
    });

    it('should reject password shorter than 8 characters', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'short',
        firstName: 'John',
        lastName: 'Doe',
        binanceApiKey: 'api-key',
        binanceSecretKey: 'secret-key',
      });

      expect(result.success).toBe(false);
    });
  });
});

describe('Trading Schemas', () => {
  describe('orderSchema', () => {
    it('should validate MARKET order', () => {
      const result = orderSchema.safeParse({
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'MARKET',
        quantity: 0.1,
      });

      expect(result.success).toBe(true);
    });

    it('should validate LIMIT order with price', () => {
      const result = orderSchema.safeParse({
        symbol: 'BTCUSDT',
        side: 'SELL',
        type: 'LIMIT',
        quantity: 0.1,
        price: 50000,
      });

      expect(result.success).toBe(true);
    });

    it('should reject LIMIT order without price', () => {
      const result = orderSchema.safeParse({
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: 0.1,
      });

      expect(result.success).toBe(false);
    });

    it('should reject invalid side', () => {
      const result = orderSchema.safeParse({
        symbol: 'BTCUSDT',
        side: 'INVALID',
        type: 'MARKET',
        quantity: 0.1,
      });

      expect(result.success).toBe(false);
    });

    it('should reject negative quantity', () => {
      const result = orderSchema.safeParse({
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'MARKET',
        quantity: -0.1,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('cancelOrderSchema', () => {
    it('should validate correct UUID', () => {
      const result = cancelOrderSchema.safeParse({
        orderId: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID format', () => {
      const result = cancelOrderSchema.safeParse({
        orderId: 'invalid-id',
      });

      expect(result.success).toBe(false);
    });
  });
});

