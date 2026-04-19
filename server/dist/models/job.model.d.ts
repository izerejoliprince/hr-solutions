import { type Document, type Types } from "mongoose";
export interface InterviewQuestionConfig {
    id: string;
    text: string;
    category: "communication" | "problem_understanding" | "relevance_to_role" | "motivation_interest" | "practical_knowledge";
}
export interface InterviewConfig {
    enabled: boolean;
    languageCode: string;
    mode: "manual" | "auto";
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
    createdBy: Types.ObjectId;
    interviewConfig?: InterviewConfig;
    createdAt: Date;
    updatedAt: Date;
}
export declare const JobModel: import("mongoose").Model<Job, {}, {}, {}, Document<unknown, {}, Job, {}, import("mongoose").DefaultSchemaOptions> & Job & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, Job>;
//# sourceMappingURL=job.model.d.ts.map