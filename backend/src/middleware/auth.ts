import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ResponseUtils } from "../utils/responseUtils";

// Hardcoded user data for demonstration
const HARDCODED_USERS = [
	{
		id: 1,
		email: "admin@prestalib.com",
		password: "admin123",
		role: "admin",
	},
	{
		id: 2,
		email: "user@prestalib.com",
		password: "admin123",
		role: "user",
	},
];

// Hardcoded JWT secret (in production, this should be in environment variables)
const JWT_SECRET =
	process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";

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
	const headerToken = authHeader?.startsWith("Bearer ")
		? authHeader.split(" ")[1]
		: undefined;
	const altHeaderToken =
		(req.headers["x-access-token"] as string | undefined) || undefined;
	const token = headerToken || altHeaderToken;

	if (!token) {
		return ResponseUtils.unauthorized(
			res,
			"Access token required. Provide a valid JWT in the Authorization header"
		);
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
		return ResponseUtils.unauthorized(res, "Invalid or expired token");
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
		return ResponseUtils.unauthorized(res, "Authentication required");
	}

	if (req.user.role !== "admin") {
		return ResponseUtils.forbidden(res, "Admin access required");
	}

	next();
};

/**
 * Middleware to check if user has specific role
 */
export const requireRole = (role: string) => {
	return (req: Request, res: Response, next: NextFunction) => {
		if (!req.user) {
			return ResponseUtils.unauthorized(res, "Authentication required");
		}

		if (req.user.role !== role) {
			return ResponseUtils.forbidden(
				res,
				`This endpoint requires ${role} role`
			);
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
