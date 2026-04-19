"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationModel = void 0;
const mongoose_1 = require("mongoose");
const CandidateSkillSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    level: {
        type: String,
        enum: ["beginner", "intermediate", "advanced", "expert"],
    },
    years: { type: Number },
});
const CandidateLanguageSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    proficiency: {
        type: String,
        enum: ["basic", "conversational", "fluent", "native"],
    },
});
const CandidateExperienceSchema = new mongoose_1.Schema({
    role: { type: String, required: true },
    company: { type: String, required: true },
    startDate: { type: Date },
    endDate: { type: Date },
    description: { type: String },
});
const CandidateEducationSchema = new mongoose_1.Schema({
    institution: { type: String, required: true },
    degree: { type: String },
    fieldOfStudy: { type: String },
    startYear: { type: Number },
    endYear: { type: Number },
});
const CandidateProjectSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    description: { type: String },
    technologies: { type: [String], default: [] },
    link: { type: String },
});
const CandidateCertificationSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    issuer: { type: String },
    year: { type: Number },
    issueDate: { type: String },
});
const CandidateAvailabilitySchema = new mongoose_1.Schema({
    status: {
        type: String,
        enum: ["available", "open_to_opportunities", "not_available"],
    },
    type: { type: String, enum: ["full_time", "part_time", "contract"] },
    startDate: { type: String },
}, { _id: false });
const CandidateSocialLinksSchema = new mongoose_1.Schema({
    linkedin: { type: String },
    github: { type: String },
    portfolio: { type: String },
}, { _id: false, strict: false });
const CandidateProfileSchema = new mongoose_1.Schema({
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
    certifications: { type: [CandidateCertificationSchema], default: [] },
    availability: { type: CandidateAvailabilitySchema },
    socialLinks: { type: CandidateSocialLinksSchema },
    resumeText: { type: String, required: true },
    coverLetterText: { type: String },
    linkedInUrl: { type: String },
    structuredExtractedAt: { type: Date },
    resumeFingerprint: { type: String },
    structuredSource: { type: String, enum: ["heuristic", "ai"] },
});
const ScreeningResultSchema = new mongoose_1.Schema({
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
const InterviewAnswerSchema = new mongoose_1.Schema({
    questionId: { type: String, required: true },
    questionText: { type: String, required: true },
    languageCode: { type: String, required: true },
    audioUrl: { type: String },
    transcript: { type: String },
    createdAt: { type: Date, required: true },
});
const InterviewScoresSchema = new mongoose_1.Schema({
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
const InterviewResultSchema = new mongoose_1.Schema({
    enabledAtRun: { type: Boolean, required: true },
    languageCode: { type: String, required: true },
    answers: { type: [InterviewAnswerSchema], default: [] },
    scores: { type: InterviewScoresSchema },
    completedAt: { type: Date },
});
const ApplicationSchema = new mongoose_1.Schema({
    job: { type: mongoose_1.Schema.Types.ObjectId, ref: "Job", required: true },
    candidateUserId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    candidateProfile: { type: CandidateProfileSchema, required: true },
    screeningResult: { type: ScreeningResultSchema },
    interviewResult: { type: InterviewResultSchema },
}, { timestamps: true });
exports.ApplicationModel = (0, mongoose_1.model)("Application", ApplicationSchema);
//# sourceMappingURL=application.model.js.map