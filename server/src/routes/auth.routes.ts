import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import mongoose from "mongoose";
import { UserModel, type UserRole } from "../models/user.model";
import { authCookieName, requireAuth, type AuthenticatedRequest } from "../middleware/auth.middleware";

const router = Router();
const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(process.cwd(), "uploads"),
    filename: (_req: any, file: any, cb: any) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
      cb(null, `${Date.now()}-${safeName}`);
    },
  }),
});

interface RegisterBody {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

interface LoginBody {
  email: string;
  password: string;
}

function ensureDatabaseAvailable(res: Response): boolean {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({
      error: "Database unavailable. Please try again shortly.",
      code: "DB_UNAVAILABLE",
    });
    return false;
  }
  return true;
}

function signToken(userId: string, role: UserRole): string {
  const secret = process.env.JWT_SECRET;
  const tokenExpiresIn = process.env.JWT_EXPIRES_IN || "30d";
  if (!secret) {
    throw new Error("JWT_SECRET not configured");
  }

  return jwt.sign(
    { sub: userId, role },
    secret,
    {
      expiresIn: tokenExpiresIn as any,
    } as any,
  );
}

function setAuthCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === "production";
  const cookieDays = Number(process.env.AUTH_COOKIE_DAYS || 30);
  const sameSitePolicy = isProd ? "none" : "lax";

  res.cookie(authCookieName, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: sameSitePolicy,
    maxAge: cookieDays * 24 * 60 * 60 * 1000,
  });
}

router.post("/register", async (req: Request, res: Response) => {
  try {
    if (!ensureDatabaseAvailable(res)) return;

    const { email, password, name, role } = req.body as RegisterBody;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (role === "owner") {
      return res.status(403).json({ error: "Owner accounts cannot be created via public registration" });
    }

    const existing = await UserModel.findOne({ email }).exec();
    if (existing) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await UserModel.create({
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
  } catch (error) {
    console.error("[auth] register error", error);
    return res.status(500).json({ error: "Failed to register" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    if (!ensureDatabaseAvailable(res)) return;

    const { email, password } = req.body as LoginBody;

    if (!email || !password) {
      return res.status(400).json({ error: "Missing email or password" });
    }

    const user = await UserModel.findOne({ email }).exec();
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
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
  } catch (error) {
    console.error("[auth] login error", error);
    return res.status(500).json({ error: "Failed to login" });
  }
});

router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie(authCookieName);
  return res.status(204).send();
});

router.get("/me", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!ensureDatabaseAvailable(res)) return;

    if (!req.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await UserModel.findById(req.userId).exec();
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
  } catch (error) {
    console.error("[auth] me error", error);
    return res.status(500).json({ error: "Failed to load current user" });
  }
});

router.put(
  "/profile",
  requireAuth(),
  upload.fields([
    { name: "profilePhoto", maxCount: 1 },
    { name: "companyLogo", maxCount: 1 },
  ]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!ensureDatabaseAvailable(res)) return;

      if (!req.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await UserModel.findById(req.userId).exec();
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { name, companyName, currentPassword, newPassword } = req.body as {
        name?: string;
        companyName?: string;
        currentPassword?: string;
        newPassword?: string;
      };

      const anyReq = req as any;
      const files = anyReq.files as
        | {
            [fieldname: string]: any[];
          }
        | undefined;

      const profilePhoto = files?.profilePhoto?.[0];
      const companyLogo = files?.companyLogo?.[0];

      if (name) user.name = name;
      if (companyName) user.companyName = companyName;

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
        const ok = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!ok) {
          return res.status(401).json({ error: "Current password is incorrect" });
        }
        user.passwordHash = await bcrypt.hash(newPassword, 10);
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
    } catch (error) {
      console.error("[auth] profile update error", error);
      return res.status(500).json({ error: "Failed to update profile" });
    }
  },
);

export const authRouter = router;
