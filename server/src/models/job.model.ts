import { Schema, model, type Document, type Types } from "mongoose";

export interface InterviewQuestionConfig {
  id: string;
  text: string;
  category:
    | "communication"
    | "problem_understanding"
    | "relevance_to_role"
    | "motivation_interest"
    | "practical_knowledge";
}

export interface InterviewConfig {
  enabled: boolean;
  languageCode: string; // e.g. "en", "fr", "de"
  mode: "manual" | "auto"; // recruiter-defined questions vs AI-generated
  questions: InterviewQuestionConfig[];
  allowAiFollowups: boolean;
  maxDurationMinutes: number;
  maxQuestions: number;
}

export interface Job extends Document {
  title: string;
  companyName: string;
  companyLogoUrl?: string;
  location?: string;
  employmentType?: "full_time" | "part_time" | "contract" | "internship" | "temporary";
  description: string;
  responsibilities?: string;
  requirements?: string;
  requiredSkills: string[];
  niceToHaveSkills: string[];
  openings: number;
  minExperienceYears?: number;
  educationLevel?: string;
  rollingBasis?: boolean;
  applicationDeadline?: Date;
  salaryMin?: number;
  salaryMax?: number;
  createdBy: Types.ObjectId; // recruiter user id (we'll define user model later)
   interviewConfig?: InterviewConfig;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema = new Schema<Job>(
  {
    title: { type: String, required: true },
    companyName: { type: String, required: true },
    companyLogoUrl: { type: String },
    location: { type: String },
    employmentType: {
      type: String,
      enum: ["full_time", "part_time", "contract", "internship", "temporary"],
    },
    description: { type: String, required: true },
    responsibilities: { type: String },
    requirements: { type: String },
    requiredSkills: { type: [String], default: [] },
    niceToHaveSkills: { type: [String], default: [] },
    openings: { type: Number, default: 1, min: 1 },
    minExperienceYears: { type: Number },
    educationLevel: { type: String },
    rollingBasis: { type: Boolean, default: true },
    applicationDeadline: { type: Date },
    salaryMin: { type: Number, min: 0 },
    salaryMax: { type: Number, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    interviewConfig: {
      enabled: { type: Boolean, default: false },
      languageCode: { type: String, default: "en" },
      mode: { type: String, enum: ["manual", "auto"], default: "auto" },
      allowAiFollowups: { type: Boolean, default: true },
      maxDurationMinutes: { type: Number, default: 10, min: 3, max: 15 },
      maxQuestions: { type: Number, default: 6, min: 3, max: 10 },
      questions: [
        {
          id: { type: String, required: true },
          text: { type: String, required: true },
          category: {
            type: String,
            enum: [
              "communication",
              "problem_understanding",
              "relevance_to_role",
              "motivation_interest",
              "practical_knowledge",
            ],
            required: true,
          },
        },
      ],
    },
  },
  { timestamps: true }
);

export const JobModel = model<Job>("Job", JobSchema);
