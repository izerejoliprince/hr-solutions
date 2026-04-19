import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserModel, type UserRole } from "../models/user.model";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userRole?: UserRole;
}

const JWT_COOKIE_NAME = "hr_auth";

export function requireAuth(roles?: UserRole[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

      const payload = jwt.verify(token, secret) as { sub: string; role: UserRole };

      req.userId = payload.sub;
      req.userRole = payload.role;

      if (roles && roles.length > 0 && !roles.includes(payload.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      return next();
    } catch (err) {
      console.error("[auth] requireAuth error", err);
      return res.status(401).json({ error: "Invalid or expired auth token" });
    }
  };
}

export const authCookieName = JWT_COOKIE_NAME;
