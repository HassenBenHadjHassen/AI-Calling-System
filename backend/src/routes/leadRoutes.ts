import { Router } from "express";
import {
  uploadLeads,
  listLeads,
  updateLeadStatus,
} from "../controllers/leadController";

const router = Router();

router.post("/upload", uploadLeads);
router.get("/", listLeads);
router.patch("/:id/status", updateLeadStatus);

export default router;
