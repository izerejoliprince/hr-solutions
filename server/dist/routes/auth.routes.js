"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const mongoose_1 = __importDefault(require("mongoose"));
const user_model_1 = require("../models/user.model");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.diskStorage({
        destination: path_1.default.join(process.cwd(), "uploads"),
        filename: (_req, file, cb) => {
            const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
            cb(null, `${Date.now()}-${safeName}`);
        },
    }),
});
function ensureDatabaseAvailable(res) {
    if (mongoose_1.default.connection.readyState !== 1) {
        res.status(503).json({
            error: "Database unavailable. Please try again shortly.",
            code: "DB_UNAVAILABLE",
        });
        return false;
    }
    return true;
}
function signToken(userId, role) {
    const secret = process.env.JWT_SECRET;
    const tokenExpiresIn = process.env.JWT_EXPIRES_IN || "30d";
    if (!secret) {
        throw new Error("JWT_SECRET not configured");
    }
    return jsonwebtoken_1.default.sign({ sub: userId, role }, secret, {
        expiresIn: tokenExpiresIn,
    });
}
function setAuthCookie(res, token) {
    const isProd = process.env.NODE_ENV === "production";
    const cookieDays = Number(process.env.AUTH_COOKIE_DAYS || 30);
    res.cookie(auth_middleware_1.authCookieName, token, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        maxAge: cookieDays * 24 * 60 * 60 * 1000,
    });
}
router.post("/register", async (req, res) => {
    try {
        if (!ensureDatabaseAvailable(res))
            return;
        const { email, password, name, role } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        if (role === "owner") {
            return res.status(403).json({ error: "Owner accounts cannot be created via public registration" });
        }
        const existing = await user_model_1.UserModel.findOne({ email }).exec();
        if (existing) {
            return res.status(409).json({ error: "Email already in use" });
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        const user = await user_model_1.UserModel.create({
            email,
            passwordHash,
            name,
            role: role ?? "candidate",
        });
        const token = signToken(user.id, user.role);
        setAuthCookie(res, token);
        return res.status(201).json({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            profilePhotoUrl: user.profilePhotoUrl,
            companyName: user.companyName,
            companyLogoUrl: user.companyLogoUrl,
        });
    }
    catch (error) {
        console.error("[auth] register error", error);
        return res.status(500).json({ error: "Failed to register" });
    }
});
router.post("/login", async (req, res) => {
    try {
        if (!ensureDatabaseAvailable(res))
            return;
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Missing email or password" });
        }
        const user = await user_model_1.UserModel.findOne({ email }).exec();
        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        const ok = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!ok) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        const token = signToken(user.id, user.role);
        setAuthCookie(res, token);
        return res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            profilePhotoUrl: user.profilePhotoUrl,
            companyName: user.companyName,
            companyLogoUrl: user.companyLogoUrl,
        });
    }
    catch (error) {
        console.error("[auth] login error", error);
        return res.status(500).json({ error: "Failed to login" });
    }
});
router.post("/logout", (_req, res) => {
    res.clearCookie(auth_middleware_1.authCookieName);
    return res.status(204).send();
});
router.get("/me", (0, auth_middleware_1.requireAuth)(), async (req, res) => {
    try {
        if (!ensureDatabaseAvailable(res))
            return;
        if (!req.userId) {
            return res.status(401).json({ error: "Not authenticated" });
        }
        const user = await user_model_1.UserModel.findById(req.userId).exec();
        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }
        return res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            profilePhotoUrl: user.profilePhotoUrl,
            companyName: user.companyName,
            companyLogoUrl: user.companyLogoUrl,
        });
    }
    catch (error) {
        console.error("[auth] me error", error);
        return res.status(500).json({ error: "Failed to load current user" });
    }
});
router.put("/profile", (0, auth_middleware_1.requireAuth)(), upload.fields([
    { name: "profilePhoto", maxCount: 1 },
    { name: "companyLogo", maxCount: 1 },
]), async (req, res) => {
    try {
        if (!ensureDatabaseAvailable(res))
            return;
        if (!req.userId) {
            return res.status(401).json({ error: "Not authenticated" });
        }
        const user = await user_model_1.UserModel.findById(req.userId).exec();
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const { name, companyName, currentPassword, newPassword } = req.body;
        const anyReq = req;
        const files = anyReq.files;
        const profilePhoto = files?.profilePhoto?.[0];
        const companyLogo = files?.companyLogo?.[0];
        if (name)
            user.name = name;
        if (companyName)
            user.companyName = companyName;
        if (profilePhoto) {
            user.profilePhotoUrl = `/uploads/${profilePhoto.filename}`;
        }
        if (companyLogo) {
            user.companyLogoUrl = `/uploads/${companyLogo.filename}`;
        }
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ error: "Current password is required to set a new password" });
            }
            const ok = await bcryptjs_1.default.compare(currentPassword, user.passwordHash);
            if (!ok) {
                return res.status(401).json({ error: "Current password is incorrect" });
            }
            user.passwordHash = await bcryptjs_1.default.hash(newPassword, 10);
        }
        await user.save();
        return res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            profilePhotoUrl: user.profilePhotoUrl,
            companyName: user.companyName,
            companyLogoUrl: user.companyLogoUrl,
        });
    }
    catch (error) {
        console.error("[auth] profile update error", error);
        return res.status(500).json({ error: "Failed to update profile" });
    }
});
exports.authRouter = router;
//# sourceMappingURL=auth.routes.js.map