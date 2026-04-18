import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'change-me-access-secret';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

/**
 * Authentication middleware that verifies JWT from httpOnly cookies
 */
export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get access token from cookie
    const accessToken = req.cookies?.accessToken;

    if (!accessToken) {
      res.status(401).json({ error: 'Unauthorized - No token provided' });
      return;
    }

    // Verify the token
    const decoded = jwt.verify(accessToken, JWT_ACCESS_SECRET) as {
      userId: string;
      email: string;
    };

    // Attach user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Unauthorized - Invalid token' });
      return;
    }

    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Unauthorized - Token expired' });
      return;
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

