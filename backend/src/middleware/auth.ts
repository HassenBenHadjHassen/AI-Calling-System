import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, env.JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

export const generateToken = (user: { id: string; email: string }): string => {
  return jwt.sign(user, env.JWT_SECRET, { expiresIn: '24h' });
};

// Basic login function (in a real app, you'd have proper user management)
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    // For MVP, we'll use a simple hardcoded admin user
    // In production, you'd check against a user database with hashed passwords
    if (email === 'admin@example.com' && password === 'admin123') {
      const user = { id: '1', email: 'admin@example.com' };
      const token = generateToken(user);
      
      res.json({
        message: 'Login successful',
        token,
        user: { id: user.id, email: user.email }
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};
