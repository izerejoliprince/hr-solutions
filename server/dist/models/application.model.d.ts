import { type Document, type Types } from "mongoose";
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
    certifications: CandidateCertification[];
    availability?: CandidateAvailability;
    socialLinks?: CandidateSocialLinks;
    resumeText: string;
    coverLetterText?: string;
    linkedInUrl?: string;
    structuredExtractedAt?: Date;
    resumeFingerprint?: string;
    structuredSource?: "heuristic" | "ai";
}
export interface ScreeningResult {
    matchScore: number;
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
    rawExplanation: string;
    lastRunAt: Date;
}
export interface InterviewAnswer {
    questionId: string;
    questionText: string;
    languageCode: string;
    audioUrl?: string;
    transcript?: string;
    createdAt: Date;
}
export interface InterviewScores {
    communicationClarity: number;
    problemUnderstanding: number;
    relevanceToRole: number;
    motivationInterest: number;
    practicalKnowledge: number;
    overall: number;
    llmOverall?: number;
    deterministicOverall?: number;
    agreementGap?: number;
    confidenceLevel?: "low" | "medium" | "high";
    overallWithScreening?: number;
    explanation: string;
}
export interface InterviewResult {
    enabledAtRun: boolean;
    languageCode: string;
    answers: InterviewAnswer[];
    scores?: InterviewScores;
    completedAt?: Date;
}
export interface Application extends Document {
    job: Types.ObjectId;
    candidateUserId?: Types.ObjectId;
    candidateProfile: CandidateProfile;
    screeningResult?: ScreeningResult;
    interviewResult?: InterviewResult;
    createdAt: Date;
    updatedAt: Date;
}
export declare const ApplicationModel: import("mongoose").Model<Application, {}, {}, {}, Document<unknown, {}, Application, {}, import("mongoose").DefaultSchemaOptions> & Application & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, Application>;
//# sourceMappingURL=application.model.d.ts.map