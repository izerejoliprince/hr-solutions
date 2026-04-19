"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const database_1 = require("./config/database");
const job_routes_1 = require("./routes/job.routes");
const application_routes_1 = require("./routes/application.routes");
const auth_routes_1 = require("./routes/auth.routes");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const geminiClient_1 = require("./ai/geminiClient");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
// Middlewares
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
const uploadsDir = path_1.default.join(process.cwd(), "uploads");
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express_1.default.static(uploadsDir));
// API routes
app.use("/auth", auth_routes_1.authRouter);
app.use("/api/jobs", job_routes_1.jobRouter);
app.use("/api/applications", application_routes_1.applicationRouter);
// Root route for platform checks (Render opens this by default)
app.get("/", (_req, res) => {
    res.status(200).json({
        service: "HR Pain Solutions API",
        status: "ok",
        health: "/health",
    });
});
// Simple health check route
app.get("/health", (req, res) => {
    res.json({ status: "ok", message: "Backend server is running" });
});
// Simple AI test route to exercise Gemini
app.post("/ai/test", async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: "Missing 'prompt' in request body" });
        }
        const aiResponse = await (0, geminiClient_1.runGeminiEcho)(prompt);
        res.json({ ok: true, result: aiResponse });
    }
    catch (error) {
        console.error("/ai/test error", error);
        res.status(500).json({ ok: false, error: "AI call failed" });
    }
});
(0, database_1.connectDatabase)().catch((error) => {
    console.error("[startup] Database initialization warning", error);
}).finally(() => {
    app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
});
//# sourceMappingURL=server.js.map