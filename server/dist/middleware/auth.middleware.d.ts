import type { Request, Response, NextFunction } from "express";
import { type UserRole } from "../models/user.model";
export interface AuthenticatedRequest extends Request {
    userId?: string;
    userRole?: UserRole;
}
export declare function requireAuth(roles?: UserRole[]): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export declare const authCookieName = "hr_auth";
//# sourceMappingURL=auth.middleware.d.ts.map