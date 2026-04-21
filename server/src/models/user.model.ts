import { Schema, model, type Document, type Model } from "mongoose";

export type UserRole = "owner" | "recruiter" | "candidate";

export interface CandidateProjectLink {
  name: string;
  url: string;
}

export interface CandidateCertificateRecord {
  title: string;
  imageUrl: string;
  originalName?: string;
}

export interface CandidateEvidenceProfile {
  projects: CandidateProjectLink[];
  certificates: CandidateCertificateRecord[];
  fingerprint?: string;
  updatedAt?: Date;
}

export interface User extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  profilePhotoUrl?: string;
  companyName?: string;
  companyLogoUrl?: string;
  candidateEvidence?: CandidateEvidenceProfile;
  createdAt: Date;
  updatedAt: Date;
}

const CandidateProjectLinkSchema = new Schema<CandidateProjectLink>(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false },
);

const CandidateCertificateRecordSchema = new Schema<CandidateCertificateRecord>(
  {
    title: { type: String, required: true },
    imageUrl: { type: String, required: true },
    originalName: { type: String },
  },
  { _id: false },
);

const CandidateEvidenceProfileSchema = new Schema<CandidateEvidenceProfile>(
  {
    projects: { type: [CandidateProjectLinkSchema], default: [] },
    certificates: { type: [CandidateCertificateRecordSchema], default: [] },
    fingerprint: { type: String },
    updatedAt: { type: Date },
  },
  { _id: false },
);

const UserSchema = new Schema<User>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ["owner", "recruiter", "candidate"], default: "candidate" },
    profilePhotoUrl: { type: String },
    companyName: { type: String },
    companyLogoUrl: { type: String },
    candidateEvidence: { type: CandidateEvidenceProfileSchema },
  },
  { timestamps: true },
);

export const UserModel: Model<User> = model<User>("User", UserSchema);
