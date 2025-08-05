import { Router, Request, Response } from "express";
import {
	authenticateToken,
	generateToken,
	authenticateUser,
	getHardcodedUsers,
} from "../middleware/auth";
import { ResponseUtils } from "../utils/responseUtils";

const router = Router();

// Type for authenticated requests
interface AuthRequest extends Request {
	user?: {
		id: number;
		email: string;
		role: string;
	};
}

// Login endpoint
const login = async (req: Request, res: Response) => {
	try {
		const { email, password } = req.body;

		console.log("Login attempt:", {
			email,
			password: password ? "***" : "undefined",
		});

		if (!email || !password) {
			return ResponseUtils.badRequest(res, "Email and password are required");
		}

		const user = authenticateUser(email, password);

		console.log("Authentication result:", user ? "success" : "failed");

		if (!user) {
			return ResponseUtils.unauthorized(res, "Email or password is incorrect");
		}

		const token = generateToken(user);

		ResponseUtils.success(res, { token }, "Login successful");
	} catch (error) {
		console.error("Login error:", error);
		ResponseUtils.error(res, "An error occurred during login");
	}
};

// Logout endpoint (client-side token removal)
const logout = async (req: Request, res: Response) => {
	try {
		// In a real app, you might want to blacklist the token
		// For now, we'll just return success - client should remove token
		ResponseUtils.success(
			res,
			{ note: "Please remove the token from client storage" },
			"Logout successful"
		);
	} catch (error) {
		ResponseUtils.error(res, "An error occurred during logout");
	}
};

// Refresh token endpoint
const refreshToken = async (req: AuthRequest, res: Response) => {
	try {
		if (!req.user) {
			return ResponseUtils.unauthorized(res, "Please authenticate first");
		}

		const newToken = generateToken(req.user);

		ResponseUtils.success(
			res,
			{
				user: req.user,
				token: newToken,
			},
			"Token refreshed successfully"
		);
	} catch (error) {
		ResponseUtils.error(res, "An error occurred while refreshing token");
	}
};

// Get user profile endpoint
const getProfile = async (req: AuthRequest, res: Response) => {
	try {
		if (!req.user) {
			return ResponseUtils.unauthorized(res, "Please authenticate first");
		}

		ResponseUtils.success(res, req.user, "Profile retrieved successfully");
	} catch (error) {
		ResponseUtils.error(res, "An error occurred while retrieving profile");
	}
};

// Debug endpoint to show available users (for testing)
const getUsers = async (req: Request, res: Response) => {
	try {
		const users = getHardcodedUsers();
		ResponseUtils.success(
			res,
			{
				users: users.map((user) => ({
					...user,
					password: "***", // Don't expose passwords
				})),
			},
			"Available users for testing"
		);
	} catch (error) {
		ResponseUtils.error(res, "An error occurred while retrieving users");
	}
};

// Public endpoints
router.post("/login", login);
router.get("/users", getUsers);

// Protected endpoints
router.post("/logout", logout);
router.post("/refresh", authenticateToken, refreshToken);
router.get("/profile", authenticateToken, getProfile);

// Verify token endpoint
router.get("/verify", authenticateToken, (req: AuthRequest, res) => {
	ResponseUtils.success(res, req.user, "Token is valid");
});

export default router;
