import { Schema, model, type Document, type Model } from "mongoose";

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

const UserSchema = new Schema<User>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ["owner", "recruiter", "candidate"], default: "candidate" },
    profilePhotoUrl: { type: String },
    companyName: { type: String },
    companyLogoUrl: { type: String },
  },
  { timestamps: true },
);

export const UserModel: Model<User> = model<User>("User", UserSchema);
