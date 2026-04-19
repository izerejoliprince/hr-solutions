"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authCookieName = void 0;
exports.requireAuth = requireAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_COOKIE_NAME = "hr_auth";
function requireAuth(roles) {
    return async (req, res, next) => {
        try {
            const token = req.cookies?.[JWT_COOKIE_NAME];
            if (!token) {
                return res.status(401).json({ error: "Not authenticated" });
            }
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                console.error("[auth] Missing JWT_SECRET env var");
                return res.status(500).json({ error: "Auth not configured" });
            }
            const payload = jsonwebtoken_1.default.verify(token, secret);
            req.userId = payload.sub;
            req.userRole = payload.role;
            if (roles && roles.length > 0 && !roles.includes(payload.role)) {
                return res.status(403).json({ error: "Forbidden" });
            }
            return next();
        }
        catch (err) {
            console.error("[auth] requireAuth error", err);
            return res.status(401).json({ error: "Invalid or expired auth token" });
        }
    };
}
exports.authCookieName = JWT_COOKIE_NAME;
//# sourceMappingURL=auth.middleware.js.map