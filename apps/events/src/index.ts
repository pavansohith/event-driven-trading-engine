import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import dotenv from 'dotenv';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '5000');
// JWT_SECRET is required (no default fallback for production)
// Use JWT_ACCESS_SECRET if available, otherwise JWT_SECRET
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
if (!JWT_ACCESS_SECRET) {
  throw new Error('JWT_SECRET or JWT_ACCESS_SECRET environment variable is required');
}

// Create HTTP server for health checks
const server = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'events' }));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// WebSocket server with origin validation
// FRONTEND_URL is required for origin validation
const FRONTEND_URL = process.env.FRONTEND_URL;
if (!FRONTEND_URL) {
  throw new Error('FRONTEND_URL environment variable is required');
}

// Parse allowed origins (support comma-separated list)
const getAllowedOrigins = (): string[] => {
  if (FRONTEND_URL.includes(',')) {
    return FRONTEND_URL.split(',').map(url => url.trim());
  }
  return [FRONTEND_URL];
};

const allowedOrigins = getAllowedOrigins();

// WebSocket server attached to HTTP server with origin validation
const wss = new WebSocketServer({ 
  server,
  verifyClient: (info) => {
    const origin = info.origin;
    if (!origin) {
      // Allow connections without origin (like Postman or direct connections)
      return true;
    }
    
    // Check if origin is in allowed list
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      // Extract domain from origin (remove protocol)
      const originDomain = origin.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const allowedDomain = allowedOrigin.replace(/^https?:\/\//, '').replace(/\/$/, '');
      return originDomain === allowedDomain;
    });
    
    if (!isAllowed) {
      console.warn(`WebSocket connection blocked from origin: ${origin}. Allowed origins: ${allowedOrigins.join(', ')}`);
    }
    
    return isAllowed;
  }
});

// Map to maintain user connections: userId -> WebSocket
const userConnections = new Map<string, WebSocket>();

// Redis subscriber for order status events
// REDIS_URL is required (no localhost fallback for production)
if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL environment variable is required');
}
const redisSubscriber = new Redis(process.env.REDIS_URL);

// Subscribe to order status events
redisSubscriber.subscribe('events:order:status', (err) => {
  if (err) {
    console.error('Failed to subscribe to events:order:status:', err);
  } else {
    console.log('Subscribed to events:order:status');
  }
});

// Handle incoming Redis events and fan out to connected users
redisSubscriber.on('message', (channel, message) => {
  if (channel === 'events:order:status') {
    try {
      const event = JSON.parse(message);
      const userId = event.userId;
      
      if (!userId) {
        console.warn('Received event without userId, skipping');
        return;
      }

      // Find user's WebSocket connection
      const ws = userConnections.get(userId);
      
      if (ws && ws.readyState === WebSocket.OPEN) {
        // Send formatted order update to user
        const orderUpdate = {
          type: 'ORDER_UPDATE',
          data: {
            orderId: event.orderId,
            status: event.status,
            symbol: event.symbol,
            side: event.side,
            quantity: event.quantity,
            price: event.price,
            executedPrice: event.executedPrice,
            executedQuantity: event.executedQuantity,
            error: event.error,
            timestamp: event.timestamp,
          },
        };

        ws.send(JSON.stringify(orderUpdate));
        console.log(`Sent ORDER_UPDATE to user ${userId} for order ${event.orderId}`);
      } else {
        console.log(`User ${userId} not connected, event will not be delivered`);
      }
    } catch (error) {
      console.error('Error processing Redis event:', error);
    }
  }
});

// Handle WebSocket connections
wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
  console.log('New WebSocket connection attempt');

  // Extract JWT token from query parameter
  // WebSocket URLs use ws:// or wss://, but URL constructor needs http/https
  const protocol = req.headers['x-forwarded-proto'] === 'https' || 
                   (req.socket as any)?.encrypted ? 'https' : 'http';
  const url = new URL(req.url || '', `${protocol}://${req.headers.host || 'localhost'}`);
  const token = url.searchParams.get('token');

  if (!token) {
    ws.close(1008, 'Missing authentication token');
    return;
  }

  // Verify JWT token
  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as { userId: string; email: string };
    const userId = decoded.userId;

    // Store connection
    userConnections.set(userId, ws);
    console.log(`User ${userId} connected`);

    // Send welcome message
    ws.send(JSON.stringify({ type: 'connected', userId }));

    // Handle connection close
    ws.on('close', () => {
      userConnections.delete(userId);
      console.log(`User ${userId} disconnected`);
    });

    // Handle errors
    ws.on('error', (error: Error) => {
      console.error(`WebSocket error for user ${userId}:`, error);
      userConnections.delete(userId);
    });
  } catch (error) {
    console.error('JWT verification failed:', error);
    ws.close(1008, 'Invalid authentication token');
  }
});

// Start HTTP server (which also serves WebSocket)
server.listen(PORT, () => {
  console.log(`Event service listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  wss.close(() => {
    console.log('WebSocket server closed');
  });
  server.close(() => {
    console.log('HTTP server closed');
  });
  redisSubscriber.disconnect();
  process.exit(0);
});

