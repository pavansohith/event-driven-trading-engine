// Load environment variables FIRST, before any other imports
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import Redis from 'ioredis';
import authRoutes from './routes/auth';
import tradingRoutes from './routes/trading';
import { authRateLimiter, tradingRateLimiter } from './middleware/rateLimit';

const app = express();
const PORT = process.env.PORT || 4000;

// CORS configuration - support multiple origins from env
// FRONTEND_URL is required in production (no localhost fallback)
// Can be a single URL or comma-separated list of URLs
const getCorsOrigin = (): string | string[] => {
  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    throw new Error('FRONTEND_URL environment variable is required');
  }
  // Support multiple origins separated by comma
  if (frontendUrl.includes(',')) {
    return frontendUrl.split(',').map(url => url.trim());
  }
  return frontendUrl;
};

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = getCorsOrigin();
    const originsArray = Array.isArray(allowedOrigins) ? allowedOrigins : [allowedOrigins];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    const isAllowed = originsArray.some(allowedOrigin => {
      // Exact match
      if (origin === allowedOrigin) return true;
      // Match without trailing slash
      if (origin === allowedOrigin.replace(/\/$/, '')) return true;
      // Match with trailing slash
      if (origin === allowedOrigin + '/') return true;
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}. Allowed origins: ${originsArray.join(', ')}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Redis publisher setup for publishing commands
// REDIS_URL is required (no localhost fallback for production)
if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL environment variable is required');
}
const redisPublisher = new Redis(process.env.REDIS_URL);

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'api-gateway' });
});

// Auth routes with rate limiting
app.use('/auth', authRateLimiter, authRoutes);

// Trading routes with rate limiting
app.use('/api/trading', tradingRateLimiter, tradingRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  redisPublisher.disconnect();
  process.exit(0);
});

