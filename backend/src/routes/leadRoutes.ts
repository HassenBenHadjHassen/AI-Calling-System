import { Router } from "express";
import {
  uploadLeads,
  uploadLeadsFromFile,
  listLeads,
  updateLeadStatus,
  getLeadStats,
} from "../controllers/leadController";
import { authenticateToken } from "../middleware/auth";
import { uploadMiddleware } from "../middleware/upload";

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Upload leads via JSON
router.post("/upload", uploadLeads);

// Upload leads via file (Excel/CSV)
router.post("/upload/file", uploadMiddleware.single('file'), uploadLeadsFromFile);

// List leads with pagination and filtering
router.get("/", listLeads);

// Get lead statistics
router.get("/stats", getLeadStats);

// Update lead status
router.patch("/:id/status", updateLeadStatus);

export default router;
