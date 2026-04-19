import { type Document, type Model } from "mongoose";
export type UserRole = "owner" | "recruiter" | "candidate";
export interface User extends Document {
    email: string;
    passwordHash: string;
    name: string;
    role: UserRole;
    profilePhotoUrl?: string;
    companyName?: string;
    companyLogoUrl?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const UserModel: Model<User>;
//# sourceMappingURL=user.model.d.ts.map