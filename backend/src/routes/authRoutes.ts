import { Router } from 'express';
import { login } from '../middleware/auth';

const router = Router();

// Login endpoint
router.post('/login', login);

// Logout endpoint (for completeness, though JWT is stateless)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// Verify token endpoint
router.get('/verify', (req, res) => {
  // This would typically use the authenticateToken middleware
  // For now, just return a simple response
  res.json({ message: 'Token verification endpoint' });
});

export default router;
