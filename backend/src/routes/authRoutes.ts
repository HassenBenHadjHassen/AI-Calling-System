import { Router, Request, Response } from "express";
import {
  authenticateToken,
  generateToken,
  authenticateUser,
  getHardcodedUsers,
} from "../middleware/auth";

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
      return res.status(400).json({
        error: "Missing credentials",
        message: "Email and password are required",
      });
    }

    const user = authenticateUser(email, password);

    console.log("Authentication result:", user ? "success" : "failed");

    if (!user) {
      return res.status(401).json({
        error: "Invalid credentials",
        message: "Email or password is incorrect",
      });
    }

    const token = generateToken(user);

    res.json({
      message: "Login successful",
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      error: "Login failed",
      message: "An error occurred during login",
    });
  }
};

// Register endpoint (using hardcoded users for demo)
const register = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Missing credentials",
        message: "Email and password are required",
      });
    }

    // Check if user already exists
    const existingUsers = getHardcodedUsers();
    const userExists = existingUsers.some((user) => user.email === email);

    if (userExists) {
      return res.status(409).json({
        error: "User already exists",
        message: "A user with this email already exists",
      });
    }

    // For demo purposes, we'll just return success
    // In a real app, you'd save the user to database
    res.status(201).json({
      message: "Registration successful",
      user: {
        email,
        role: "user", // Default role for new users
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Registration failed",
      message: "An error occurred during registration",
    });
  }
};

// Logout endpoint (client-side token removal)
const logout = async (req: Request, res: Response) => {
  try {
    // In a real app, you might want to blacklist the token
    // For now, we'll just return success - client should remove token
    res.json({
      message: "Logout successful",
      note: "Please remove the token from client storage",
    });
  } catch (error) {
    res.status(500).json({
      error: "Logout failed",
      message: "An error occurred during logout",
    });
  }
};

// Refresh token endpoint
const refreshToken = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        message: "Please authenticate first",
      });
    }

    const newToken = generateToken(req.user);

    res.json({
      message: "Token refreshed successfully",
      user: req.user,
      token: newToken,
    });
  } catch (error) {
    res.status(500).json({
      error: "Token refresh failed",
      message: "An error occurred while refreshing token",
    });
  }
};

// Get user profile endpoint
const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        message: "Please authenticate first",
      });
    }

    res.json({
      message: "Profile retrieved successfully",
      user: req.user,
    });
  } catch (error) {
    res.status(500).json({
      error: "Profile retrieval failed",
      message: "An error occurred while retrieving profile",
    });
  }
};

// Debug endpoint to show available users (for testing)
const getUsers = async (req: Request, res: Response) => {
  try {
    const users = getHardcodedUsers();
    res.json({
      message: "Available users for testing",
      users: users.map((user) => ({
        ...user,
        password: "***", // Don't expose passwords
      })),
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get users",
      message: "An error occurred while retrieving users",
    });
  }
};

// Public endpoints
router.post("/login", login);
router.post("/register", register);
router.get("/users", getUsers); // Debug endpoint

// Test endpoint for quick testing
router.get("/test", (req: Request, res: Response) => {
  res.json({
    message: "Auth system is working!",
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      "POST /auth/login",
      "POST /auth/register",
      "GET /auth/users",
      "GET /auth/test",
    ],
  });
});

// Protected endpoints
router.post("/logout", logout);
router.post("/refresh", authenticateToken, refreshToken);
router.get("/profile", authenticateToken, getProfile);

// Verify token endpoint
router.get("/verify", authenticateToken, (req: AuthRequest, res) => {
  res.json({
    message: "Token is valid",
    user: req.user,
  });
});

export default router;
