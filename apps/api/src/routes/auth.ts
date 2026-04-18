import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { encrypt } from '../utils/crypto';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { loginSchema, registerSchema } from '../schemas/auth';

const router = Router();

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'change-me-access-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'change-me-refresh-secret';
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';
const NODE_ENV = process.env.NODE_ENV || 'development';
// FRONTEND_URL is required in production (no localhost fallback)
if (!process.env.FRONTEND_URL) {
  throw new Error('FRONTEND_URL environment variable is required');
}
const FRONTEND_URL = process.env.FRONTEND_URL;

/**
 * Get cookie options based on environment and frontend URL
 */
function getCookieOptions() {
  const isProduction = NODE_ENV === 'production';
  const isHttps = FRONTEND_URL.startsWith('https://');
  
  // For cross-domain cookies (different domains), we need:
  // - sameSite: 'none' (required for cross-domain)
  // - secure: true (required when sameSite is 'none')
  const cookieOptions: {
    httpOnly: boolean;
    sameSite: 'none' | 'lax' | 'strict';
    secure: boolean;
    maxAge: number;
    domain?: string;
  } = {
    httpOnly: true,
    sameSite: isProduction && isHttps ? 'none' : 'lax',
    secure: isProduction && isHttps,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  };

  // Don't set domain for cross-domain cookies - let browser handle it
  // Setting domain would restrict the cookie to that domain only
  
  return cookieOptions;
}

/**
 * Set httpOnly cookies for access and refresh tokens
 */
function setAuthCookies(res: Response, userId: string, email: string): void {
  const accessToken = jwt.sign(
    { userId, email },
    JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY } as jwt.SignOptions
  );

  const refreshToken = jwt.sign(
    { userId, email },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY } as jwt.SignOptions
  );

  const cookieOptions = getCookieOptions();

  res.cookie('accessToken', accessToken, cookieOptions);
  res.cookie('refreshToken', refreshToken, cookieOptions);
}

/**
 * POST /auth/register
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body with Zod
    const validationResult = registerSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
      return;
    }

    const { email, password, firstName, lastName, binanceApiKey, binanceSecretKey } = validationResult.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(409).json({ error: 'User with this email already exists' });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Encrypt Binance API keys
    const encryptedApiKey = encrypt(binanceApiKey);
    const encryptedSecretKey = encrypt(binanceSecretKey);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        binanceApiKey: encryptedApiKey,
        binanceSecretKey: encryptedSecretKey,
      },
    });

    // Generate and set tokens
    setAuthCookies(res, user.id, user.email);

    // Return user info (without sensitive data)
    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/login
 * Login existing user
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body with Zod
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
      return;
    }

    const { email, password } = validationResult.data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Generate and set tokens
    setAuthCookies(res, user.id, user.email);

    // Return user info
    res.json({
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/logout
 * Clear authentication cookies
 */
router.post('/logout', (req: Request, res: Response): void => {
  const cookieOptions = getCookieOptions();
  
  // Clear cookies with same options used to set them
  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);
  res.json({ message: 'Logged out successfully' });
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh token not provided' });
      return;
    }

    // Verify refresh token
    let decoded: { userId: string; email: string };
    try {
      decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string; email: string };
    } catch (error) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    // Verify user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Generate new tokens
    setAuthCookies(res, user.id, user.email);

    res.json({
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /auth/me
 * Get current authenticated user
 */
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /auth/ws-token
 * Returns a JWT token for WebSocket authentication
 * Protected route - requires JWT authentication
 */
router.get('/ws-token', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const email = req.user?.email;

    if (!userId || !email) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Generate a short-lived token for WebSocket (valid for 1 hour)
    const wsToken = jwt.sign(
      { userId, email },
      JWT_ACCESS_SECRET,
      { expiresIn: '1h' } as jwt.SignOptions
    );

    res.json({ token: wsToken });
  } catch (error) {
    console.error('Get WS token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

