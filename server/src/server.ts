import express, { type Request, type Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { connectDatabase } from "./config/database";
import { jobRouter } from "./routes/job.routes";
import { applicationRouter } from "./routes/application.routes";
import { authRouter } from "./routes/auth.routes";
import cookieParser from "cookie-parser";
import { runGeminiEcho } from "./ai/geminiClient";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// API routes
app.use("/auth", authRouter);
app.use("/api/jobs", jobRouter);
app.use("/api/applications", applicationRouter);

// Simple health check route
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", message: "Backend server is running" });
});

// Simple AI test route to exercise Gemini
app.post("/ai/test", async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body as { prompt?: string };

    if (!prompt) {
      return res.status(400).json({ error: "Missing 'prompt' in request body" });
    }

    const aiResponse = await runGeminiEcho(prompt);
    res.json({ ok: true, result: aiResponse });
  } catch (error) {
    console.error("/ai/test error", error);
    res.status(500).json({ ok: false, error: "AI call failed" });
  }
});

connectDatabase().catch((error) => {
  console.error("[startup] Database initialization warning", error);
}).finally(() => {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
});
