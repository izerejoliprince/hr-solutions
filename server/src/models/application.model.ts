import { Schema, model, type Document, type Types } from "mongoose";

export interface CandidateSkill {
  name: string;
  level?: "beginner" | "intermediate" | "advanced" | "expert";
  years?: number;
}

export interface CandidateLanguage {
  name: string;
  proficiency?: "basic" | "conversational" | "fluent" | "native";
}

export interface CandidateExperience {
  role: string;
  company: string;
  startDate?: Date;
  endDate?: Date | null;
  description?: string;
}

export interface CandidateEducation {
  institution: string;
  degree?: string;
  fieldOfStudy?: string;
  startYear?: number;
  endYear?: number;
}

export interface CandidateProject {
  name: string;
  description?: string;
  technologies?: string[];
  link?: string;
}

export interface CandidateCertification {
  name: string;
  issuer?: string;
  year?: number;
  issueDate?: string;
}

export interface CandidateEvidenceAsset {
  imageUrl: string;
  originalName?: string;
}

export interface CandidateAvailability {
  status?: "available" | "open_to_opportunities" | "not_available";
  type?: "full_time" | "part_time" | "contract";
  startDate?: string;
}

export interface CandidateSocialLinks {
  linkedin?: string;
  github?: string;
  portfolio?: string;
  [key: string]: string | undefined;
}

export interface CandidateProfile {
  fullName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  headline?: string;
  bio?: string;
  location?: string;
  totalExperienceYears?: number;
  skills: CandidateSkill[];
  languages?: CandidateLanguage[];
  experiences: CandidateExperience[];
  education: CandidateEducation[];
  projects: CandidateProject[];
  projectAssets?: CandidateEvidenceAsset[];
  certifications: CandidateCertification[];
  certificationAssets?: CandidateEvidenceAsset[];
  availability?: CandidateAvailability;
  socialLinks?: CandidateSocialLinks;
  resumeText: string; // raw resume text
  coverLetterText?: string;
  linkedInUrl?: string;
  structuredExtractedAt?: Date;
  resumeFingerprint?: string;
  structuredSource?: "heuristic" | "ai";
}

export interface ScreeningResult {
  matchScore: number; // 0-100
  skillsScore?: number;
  experienceScore?: number;
  educationScore?: number;
  projectScore?: number;
  llmScore?: number;
  deterministicScore?: number;
  agreementGap?: number;
  confidenceLevel?: "low" | "medium" | "high";
  strengths: string[];
  gaps: string[];
  overallRecommendation: "strong_match" | "consider" | "not_recommended";
  rawExplanation: string; // full explanation text
  lastRunAt: Date;
}

export interface InterviewAnswer {
  questionId: string;
  questionText: string;
  languageCode: string;
  audioUrl?: string; // where the audio is stored (S3, GCS, etc.)
  transcript?: string; // text version of the answer after STT
  createdAt: Date;
}

export interface InterviewScores {
  communicationClarity: number; // 0-100
  problemUnderstanding: number; // 0-100
  relevanceToRole: number; // 0-100
  motivationInterest: number; // 0-100
  practicalKnowledge: number; // 0-100
  overall: number; // 0-100 aggregate
  llmOverall?: number;
  deterministicOverall?: number;
  agreementGap?: number;
  confidenceLevel?: "low" | "medium" | "high";
  overallWithScreening?: number; // weighted blend of interview + screening
  explanation: string; // summary written by the AI interviewer
}

export interface InterviewResult {
  enabledAtRun: boolean; // whether interview was enabled for this job when recorded
  languageCode: string;
  answers: InterviewAnswer[];
  scores?: InterviewScores;
  completedAt?: Date;
}

export interface Application extends Document {
  job: Types.ObjectId; // reference to Job
  candidateUserId?: Types.ObjectId; // optional reference to User (candidate account)
  candidateProfile: CandidateProfile;
  screeningResult?: ScreeningResult;
  interviewResult?: InterviewResult;
  createdAt: Date;
  updatedAt: Date;
}

const CandidateSkillSchema = new Schema<CandidateSkill>({
  name: { type: String, required: true },
  level: {
    type: String,
    enum: ["beginner", "intermediate", "advanced", "expert"],
  },
  years: { type: Number },
});

const CandidateLanguageSchema = new Schema<CandidateLanguage>({
  name: { type: String, required: true },
  proficiency: {
    type: String,
    enum: ["basic", "conversational", "fluent", "native"],
  },
});

const CandidateExperienceSchema = new Schema<CandidateExperience>({
  role: { type: String, required: true },
  company: { type: String, required: true },
  startDate: { type: Date },
  endDate: { type: Date },
  description: { type: String },
});

const CandidateEducationSchema = new Schema<CandidateEducation>({
  institution: { type: String, required: true },
  degree: { type: String },
  fieldOfStudy: { type: String },
  startYear: { type: Number },
  endYear: { type: Number },
});

const CandidateProjectSchema = new Schema<CandidateProject>({
  name: { type: String, required: true },
  description: { type: String },
  technologies: { type: [String], default: [] },
  link: { type: String },
});

const CandidateCertificationSchema = new Schema<CandidateCertification>({
  name: { type: String, required: true },
  issuer: { type: String },
  year: { type: Number },
  issueDate: { type: String },
});

const CandidateAvailabilitySchema = new Schema<CandidateAvailability>(
  {
    status: {
      type: String,
      enum: ["available", "open_to_opportunities", "not_available"],
    },
    type: { type: String, enum: ["full_time", "part_time", "contract"] },
    startDate: { type: String },
  },
  { _id: false }
);

const CandidateSocialLinksSchema = new Schema<CandidateSocialLinks>(
  {
    linkedin: { type: String },
    github: { type: String },
    portfolio: { type: String },
  },
  { _id: false, strict: false }
);

const CandidateEvidenceAssetSchema = new Schema<CandidateEvidenceAsset>(
  {
    imageUrl: { type: String, required: true },
    originalName: { type: String },
  },
  { _id: false }
);

const CandidateProfileSchema = new Schema<CandidateProfile>({
  fullName: { type: String, required: true },
  firstName: { type: String },
  lastName: { type: String },
  email: { type: String, required: true },
  headline: { type: String },
  bio: { type: String },
  location: { type: String },
  totalExperienceYears: { type: Number },
  skills: { type: [CandidateSkillSchema], default: [] },
  languages: { type: [CandidateLanguageSchema], default: [] },
  experiences: { type: [CandidateExperienceSchema], default: [] },
  education: { type: [CandidateEducationSchema], default: [] },
  projects: { type: [CandidateProjectSchema], default: [] },
  projectAssets: { type: [CandidateEvidenceAssetSchema], default: [] },
  certifications: { type: [CandidateCertificationSchema], default: [] },
  certificationAssets: { type: [CandidateEvidenceAssetSchema], default: [] },
  availability: { type: CandidateAvailabilitySchema },
  socialLinks: { type: CandidateSocialLinksSchema },
  resumeText: { type: String, required: true },
  coverLetterText: { type: String },
  linkedInUrl: { type: String },
  structuredExtractedAt: { type: Date },
  resumeFingerprint: { type: String },
  structuredSource: { type: String, enum: ["heuristic", "ai"] },
});

const ScreeningResultSchema = new Schema<ScreeningResult>({
  matchScore: { type: Number, required: true },
  skillsScore: { type: Number },
  experienceScore: { type: Number },
  educationScore: { type: Number },
  projectScore: { type: Number },
  llmScore: { type: Number },
  deterministicScore: { type: Number },
  agreementGap: { type: Number },
  confidenceLevel: { type: String, enum: ["low", "medium", "high"] },
  strengths: { type: [String], default: [] },
  gaps: { type: [String], default: [] },
  overallRecommendation: {
    type: String,
    enum: ["strong_match", "consider", "not_recommended"],
    required: true,
  },
  rawExplanation: { type: String, required: true },
  lastRunAt: { type: Date, required: true },
});

const InterviewAnswerSchema = new Schema<InterviewAnswer>({
  questionId: { type: String, required: true },
  questionText: { type: String, required: true },
  languageCode: { type: String, required: true },
  audioUrl: { type: String },
  transcript: { type: String },
  createdAt: { type: Date, required: true },
});

const InterviewScoresSchema = new Schema<InterviewScores>({
  communicationClarity: { type: Number, required: true },
  problemUnderstanding: { type: Number, required: true },
  relevanceToRole: { type: Number, required: true },
  motivationInterest: { type: Number, required: true },
  practicalKnowledge: { type: Number, required: true },
  overall: { type: Number, required: true },
  llmOverall: { type: Number },
  deterministicOverall: { type: Number },
  agreementGap: { type: Number },
  confidenceLevel: { type: String, enum: ["low", "medium", "high"] },
  overallWithScreening: { type: Number },
  explanation: { type: String, required: true },
});

const InterviewResultSchema = new Schema<InterviewResult>({
  enabledAtRun: { type: Boolean, required: true },
  languageCode: { type: String, required: true },
  answers: { type: [InterviewAnswerSchema], default: [] },
  scores: { type: InterviewScoresSchema },
  completedAt: { type: Date },
});

const ApplicationSchema = new Schema<Application>(
  {
    job: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    candidateUserId: { type: Schema.Types.ObjectId, ref: "User" },
    candidateProfile: { type: CandidateProfileSchema, required: true },
    screeningResult: { type: ScreeningResultSchema },
    interviewResult: { type: InterviewResultSchema },
  },
  { timestamps: true }
);

export const ApplicationModel = model<Application>("Application", ApplicationSchema);
