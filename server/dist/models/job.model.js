"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobModel = void 0;
const mongoose_1 = require("mongoose");
const JobSchema = new mongoose_1.Schema({
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
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, required: true, ref: "User" },
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
}, { timestamps: true });
exports.JobModel = (0, mongoose_1.model)("Job", JobSchema);
//# sourceMappingURL=job.model.js.map