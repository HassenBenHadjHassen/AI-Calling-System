import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Hardcoded user data for demonstration
const HARDCODED_USERS = [
  {
    id: 1,
    email: "admin@example.com",
    password: "admin123",
    role: "admin",
  },
  {
    id: 2,
    email: "user@example.com",
    password: "user123",
    role: "user",
  },
];

// Hardcoded JWT secret (in production, this should be in environment variables)
const JWT_SECRET = "your-super-secret-jwt-key-change-in-production";

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: string;
      };
    }
  }
}

/**
 * Middleware to authenticate requests using JWT tokens
 */
export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: "Access token required",
      message: "Please provide a valid JWT token in the Authorization header",
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch (error) {
    return res.status(403).json({
      error: "Invalid token",
      message: "The provided token is invalid or expired",
    });
  }
};

/**
 * Middleware to check if user has admin role
 */
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      error: "Authentication required",
      message: "Please authenticate first",
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      error: "Admin access required",
      message: "This endpoint requires admin privileges",
    });
  }

  next();
};

/**
 * Middleware to check if user has specific role
 */
export const requireRole = (role: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        message: "Please authenticate first",
      });
    }

    if (req.user.role !== role) {
      return res.status(403).json({
        error: "Insufficient permissions",
        message: `This endpoint requires ${role} role`,
      });
    }

    next();
  };
};

/**
 * Helper function to generate JWT token for a user
 */
export const generateToken = (user: {
  id: number;
  email: string;
  role: string;
}) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
};

/**
 * Helper function to authenticate user with email and password
 */
export const authenticateUser = (email: string, password: string) => {
  const user = HARDCODED_USERS.find(
    (u) => u.email === email && u.password === password
  );
  return user ? { id: user.id, email: user.email, role: user.role } : null;
};

/**
 * Get all hardcoded users (for testing purposes)
 */
export const getHardcodedUsers = () => {
  return HARDCODED_USERS.map((user) => ({
    id: user.id,
    email: user.email,
    role: user.role,
  }));
};

