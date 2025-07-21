import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import leadRoutes from "./routes/leadRoutes";
import campaignRoutes from "./routes/campaignRoutes";
import callRoutes from "./routes/callRoutes";
import statsRoutes from "./routes/statsRoutes";

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

// Placeholder routers (to be implemented)
app.use("/api/leads", leadRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/stats", statsRoutes);

// Health check
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Error handling
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
