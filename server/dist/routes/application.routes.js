"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applicationRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const crypto_1 = require("crypto");
const application_model_1 = require("../models/application.model");
const job_model_1 = require("../models/job.model");
const screeningGraph_1 = require("../ai/screeningGraph");
const interviewQuestionGenerator_1 = require("../ai/interviewQuestionGenerator");
const interviewFollowupGenerator_1 = require("../ai/interviewFollowupGenerator");
const interviewScoring_1 = require("../ai/interviewScoring");
const fileParsing_service_1 = require("../services/fileParsing.service");
const profileExtraction_service_1 = require("../services/profileExtraction.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
function fingerprintResume(resumeText, coverLetterText) {
    const source = `${resumeText}\n---\n${coverLetterText || ""}`;
    return (0, crypto_1.createHash)("sha256").update(source).digest("hex");
}
function canAccessApplication(req, application) {
    if (!req.userId || !req.userRole)
        return false;
    if (req.userRole === "owner" || req.userRole === "recruiter")
        return true;
    if (req.userRole === "candidate") {
        return String(application.candidateUserId || "") === String(req.userId);
    }
    return false;
}
// In-memory file storage for resume / cover letter uploads
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// Candidate: list own applications
router.get("/candidate/applications", (0, auth_middleware_1.requireAuth)(["candidate"]), async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const applications = await application_model_1.ApplicationModel
            .find({ candidateUserId: userId })
            .populate("job", "title companyName location employmentType interviewConfig")
            .sort({ createdAt: -1 })
            .lean();
        return res.json({ applications });
    }
    catch (error) {
        console.error("Error fetching candidate applications", error);
        return res.status(500).json({ message: "Failed to fetch applications" });
    }
});
// Create a new application
router.post("/", async (req, res) => {
    try {
        const body = req.body;
        const authReq = req;
        if (!body.jobId || !body.candidateProfile || !body.candidateProfile.fullName || !body.candidateProfile.email || !body.candidateProfile.resumeText) {
            return res.status(400).json({ error: "Missing required application fields" });
        }
        if (authReq.userId) {
            const existing = await application_model_1.ApplicationModel.findOne({
                job: body.jobId,
                candidateUserId: authReq.userId,
            }).exec();
            if (existing) {
                return res.status(409).json({ error: "You already applied to this job" });
            }
        }
        else {
            const existingByEmail = await application_model_1.ApplicationModel.findOne({
                job: body.jobId,
                "candidateProfile.email": body.candidateProfile.email,
            }).exec();
            if (existingByEmail) {
                return res.status(409).json({ error: "Application already exists for this email on the selected job" });
            }
        }
        const structured = (0, profileExtraction_service_1.extractStructuredProfile)(body.candidateProfile.resumeText, body.candidateProfile.coverLetterText, {
            ...(body.candidateProfile.headline ? { headline: body.candidateProfile.headline } : {}),
            ...(body.candidateProfile.bio ? { bio: body.candidateProfile.bio } : {}),
        });
        const profileInput = body.candidateProfile;
        const candidateProfilePayload = {
            fullName: profileInput.fullName,
            ...(profileInput.firstName ? { firstName: profileInput.firstName } : {}),
            ...(profileInput.lastName ? { lastName: profileInput.lastName } : {}),
            email: profileInput.email,
            ...(profileInput.headline ? { headline: profileInput.headline } : {}),
            ...(profileInput.bio ? { bio: profileInput.bio } : {}),
            ...(profileInput.location ? { location: profileInput.location } : {}),
            ...(typeof profileInput.totalExperienceYears === "number"
                ? { totalExperienceYears: profileInput.totalExperienceYears }
                : {}),
            skills: profileInput.skills && profileInput.skills.length > 0
                ? profileInput.skills
                : structured.skills,
            experiences: profileInput.experiences && profileInput.experiences.length > 0
                ? profileInput.experiences
                : structured.experiences,
            education: profileInput.education && profileInput.education.length > 0
                ? profileInput.education
                : structured.education,
            projects: profileInput.projects && profileInput.projects.length > 0
                ? profileInput.projects
                : structured.projects,
            certifications: profileInput.certifications && profileInput.certifications.length > 0
                ? profileInput.certifications
                : structured.certifications,
            languages: profileInput.languages ?? [],
            ...(profileInput.availability ? { availability: profileInput.availability } : {}),
            ...(profileInput.socialLinks ? { socialLinks: profileInput.socialLinks } : {}),
            resumeText: profileInput.resumeText,
            ...(profileInput.coverLetterText ? { coverLetterText: profileInput.coverLetterText } : {}),
            ...(profileInput.linkedInUrl ? { linkedInUrl: profileInput.linkedInUrl } : {}),
            structuredExtractedAt: new Date(),
            resumeFingerprint: fingerprintResume(profileInput.resumeText, profileInput.coverLetterText),
            structuredSource: "heuristic",
        };
        const application = await application_model_1.ApplicationModel.create({
            job: body.jobId,
            ...(authReq.userId ? { candidateUserId: authReq.userId } : {}),
            candidateProfile: candidateProfilePayload,
        });
        return res.status(201).json(application);
    }
    catch (error) {
        console.error("[applications] create error", error);
        return res.status(500).json({ error: "Failed to create application" });
    }
});
// Create a new application from uploaded resume / cover letter files (PDF/DOCX)
router.post("/upload", (0, auth_middleware_1.requireAuth)(["candidate"]), upload.fields([
    { name: "resumeFile", maxCount: 1 },
    { name: "coverLetterFile", maxCount: 1 },
]), async (req, res) => {
    try {
        const authReq = req;
        const { jobId, fullName, firstName, lastName, email, headline, bio, location, linkedInUrl, availability, socialLinks, } = req.body;
        if (!jobId || !fullName || !email) {
            return res.status(400).json({ error: "Missing required fields: jobId, fullName, email" });
        }
        if (authReq.userId) {
            const existing = await application_model_1.ApplicationModel.findOne({
                job: jobId,
                candidateUserId: authReq.userId,
            }).exec();
            if (existing) {
                return res.status(409).json({ error: "You already applied to this job" });
            }
        }
        const anyReq = req;
        const files = anyReq.files;
        const resumeFile = files?.resumeFile?.[0];
        const coverLetterFile = files?.coverLetterFile?.[0];
        let resumeText = "";
        let coverLetterText = undefined;
        if (resumeFile) {
            resumeText = await (0, fileParsing_service_1.extractTextFromUploadedFile)(resumeFile);
        }
        if (coverLetterFile) {
            coverLetterText = await (0, fileParsing_service_1.extractTextFromUploadedFile)(coverLetterFile);
        }
        if (!resumeText) {
            return res.status(400).json({ error: "Could not extract text from resume file" });
        }
        const structured = (0, profileExtraction_service_1.extractStructuredProfile)(resumeText, coverLetterText, {
            ...(headline ? { headline } : {}),
            ...(bio ? { bio } : {}),
        });
        const application = await application_model_1.ApplicationModel.create({
            job: jobId,
            ...(authReq.userId ? { candidateUserId: authReq.userId } : {}),
            candidateProfile: {
                fullName,
                firstName,
                lastName,
                email,
                headline,
                bio,
                location,
                skills: structured.skills,
                languages: [],
                experiences: structured.experiences,
                education: structured.education,
                projects: structured.projects,
                certifications: structured.certifications,
                ...(availability ? { availability } : {}),
                ...(socialLinks ? { socialLinks } : {}),
                resumeText,
                coverLetterText,
                linkedInUrl,
                structuredExtractedAt: new Date(),
                resumeFingerprint: fingerprintResume(resumeText, coverLetterText),
                structuredSource: "heuristic",
            },
        });
        return res.status(201).json(application);
    }
    catch (error) {
        console.error("[applications/upload] create error", error);
        return res
            .status(500)
            .json({ error: "Failed to create application from uploaded files" });
    }
});
// Fetch a single application with basic job context for recruiter views
router.get("/:applicationId", (0, auth_middleware_1.requireAuth)(["owner", "recruiter"]), async (req, res) => {
    try {
        const { applicationId } = req.params;
        const application = await application_model_1.ApplicationModel.findById(applicationId)
            .populate({ path: "job", select: "title companyName description requiredSkills createdAt" })
            .populate({ path: "candidateUserId", select: "profilePhotoUrl name" })
            .exec();
        if (!application) {
            return res.status(404).json({ error: "Application not found" });
        }
        return res.json(application);
    }
    catch (error) {
        console.error("[applications] get one error", error);
        return res.status(500).json({ error: "Failed to fetch application" });
    }
});
router.post("/:applicationId/screening/explanation", (0, auth_middleware_1.requireAuth)(["owner", "recruiter"]), async (req, res) => {
    try {
        const { applicationId } = req.params;
        const application = await application_model_1.ApplicationModel.findById(applicationId).exec();
        if (!application) {
            return res.status(404).json({ error: "Application not found" });
        }
        if (!application.screeningResult) {
            return res.status(400).json({ error: "Screening result does not exist yet" });
        }
        const job = await job_model_1.JobModel.findById(application.job).exec();
        if (!job) {
            return res.status(404).json({ error: "Job not found" });
        }
        const explanation = await (0, screeningGraph_1.generateScreeningExplanation)(job, application.screeningResult);
        application.screeningResult.rawExplanation = explanation;
        await application.save();
        return res.json({
            applicationId: String(application._id),
            explanation,
        });
    }
    catch (error) {
        console.error("[applications] generate explanation error", error);
        return res.status(500).json({ error: "Failed to generate screening explanation" });
    }
});
exports.applicationRouter = router;
// Fetch interview questions for a given application based on its job's interviewConfig
router.get("/:applicationId/interview-questions", (0, auth_middleware_1.requireAuth)(["candidate", "recruiter", "owner"]), async (req, res) => {
    try {
        const authReq = req;
        const { applicationId } = req.params;
        const application = await application_model_1.ApplicationModel.findById(applicationId).exec();
        if (!application) {
            return res.status(404).json({ error: "Application not found" });
        }
        if (!canAccessApplication(authReq, application)) {
            return res.status(403).json({ error: "Forbidden" });
        }
        const job = await job_model_1.JobModel.findById(application.job).exec();
        if (!job || !job.interviewConfig || !job.interviewConfig.enabled) {
            return res.status(400).json({ error: "Interview is not enabled for this job" });
        }
        const cfg = job.interviewConfig;
        const languageCode = cfg.languageCode || "en";
        const maxDurationMinutes = Math.max(3, Math.min(15, cfg.maxDurationMinutes ?? 10));
        const maxQuestions = Math.max(3, Math.min(10, cfg.maxQuestions ?? 6));
        let questions = cfg.questions;
        if ((!questions || questions.length === 0) || cfg.mode === "auto") {
            questions = await (0, interviewQuestionGenerator_1.generateInterviewQuestions)(job, languageCode, maxQuestions, maxDurationMinutes);
        }
        questions = questions.slice(0, maxQuestions);
        await application_model_1.ApplicationModel.updateOne({ _id: application._id }, {
            $set: {
                "interviewResult.enabledAtRun": true,
                "interviewResult.languageCode": languageCode,
            },
            $setOnInsert: {
                "interviewResult.answers": [],
            },
        }).exec();
        return res.json({
            applicationId: String(application._id),
            jobId: String(job._id),
            languageCode,
            mode: cfg.mode,
            allowAiFollowups: cfg.allowAiFollowups,
            maxDurationMinutes,
            maxQuestions,
            questions,
        });
    }
    catch (error) {
        console.error("[applications] interview-questions error", error);
        return res.status(500).json({ error: "Failed to fetch interview questions" });
    }
});
router.post("/:applicationId/interview/followup-question", (0, auth_middleware_1.requireAuth)(["candidate", "recruiter", "owner"]), async (req, res) => {
    try {
        const authReq = req;
        const { applicationId } = req.params;
        const { questionText, answerTranscript, category, languageCode } = req.body;
        if (!questionText || !answerTranscript) {
            return res.status(400).json({ error: "Missing questionText or answerTranscript" });
        }
        const application = await application_model_1.ApplicationModel.findById(applicationId).exec();
        if (!application) {
            return res.status(404).json({ error: "Application not found" });
        }
        if (!canAccessApplication(authReq, application)) {
            return res.status(403).json({ error: "Forbidden" });
        }
        const job = await job_model_1.JobModel.findById(application.job).exec();
        if (!job || !job.interviewConfig || !job.interviewConfig.enabled) {
            return res.status(400).json({ error: "Interview is not enabled for this job" });
        }
        if (!job.interviewConfig.allowAiFollowups) {
            return res.status(400).json({ error: "AI follow-up questions are disabled for this job" });
        }
        const maxQuestions = Math.max(3, Math.min(10, job.interviewConfig.maxQuestions ?? 6));
        const answeredCount = application.interviewResult?.answers?.length ?? 0;
        if (answeredCount >= maxQuestions) {
            return res.status(400).json({ error: "Maximum interview question limit reached" });
        }
        const followup = await (0, interviewFollowupGenerator_1.generateInterviewFollowupQuestion)(job, languageCode || job.interviewConfig.languageCode || "en", questionText, answerTranscript, category || "problem_understanding");
        return res.json({ followup });
    }
    catch (error) {
        console.error("[applications] interview follow-up error", error);
        return res.status(500).json({ error: "Failed to generate follow-up question" });
    }
});
// Append a transcript answer for a specific interview question (text-based for now)
router.post("/:applicationId/interview/answer-text", (0, auth_middleware_1.requireAuth)(["candidate", "recruiter", "owner"]), async (req, res) => {
    try {
        const authReq = req;
        const { applicationId } = req.params;
        const { questionId, questionText, transcript, languageCode } = req.body;
        if (!questionId || !questionText || !transcript) {
            return res.status(400).json({ error: "Missing questionId, questionText, or transcript" });
        }
        const application = await application_model_1.ApplicationModel.findById(applicationId).exec();
        if (!application) {
            return res.status(404).json({ error: "Application not found" });
        }
        if (!canAccessApplication(authReq, application)) {
            return res.status(403).json({ error: "Forbidden" });
        }
        const job = await job_model_1.JobModel.findById(application.job).exec();
        if (!job || !job.interviewConfig || !job.interviewConfig.enabled) {
            return res.status(400).json({ error: "Interview is not enabled for this job" });
        }
        const lang = languageCode || job.interviewConfig.languageCode || "en";
        const answer = {
            questionId,
            questionText,
            languageCode: lang,
            transcript,
            createdAt: new Date(),
        };
        await application_model_1.ApplicationModel.updateOne({ _id: application._id }, {
            $set: {
                "interviewResult.enabledAtRun": true,
                "interviewResult.languageCode": lang,
            },
            $push: {
                "interviewResult.answers": answer,
            },
        }).exec();
        return res.status(201).json({
            enabledAtRun: true,
            languageCode: lang,
            appended: answer,
        });
    }
    catch (error) {
        console.error("[applications] interview answer-text error", error);
        return res.status(500).json({ error: "Failed to save interview answer" });
    }
});
// Final scoring of the interview once all answers are collected
router.post("/:applicationId/interview/score", (0, auth_middleware_1.requireAuth)(["candidate", "recruiter", "owner"]), async (req, res) => {
    try {
        const authReq = req;
        const { applicationId } = req.params;
        const application = await application_model_1.ApplicationModel.findById(applicationId).exec();
        if (!application) {
            return res.status(404).json({ error: "Application not found" });
        }
        if (!canAccessApplication(authReq, application)) {
            return res.status(403).json({ error: "Forbidden" });
        }
        if (!application.interviewResult || !application.interviewResult.answers.length) {
            return res.status(400).json({ error: "No interview answers to score" });
        }
        const job = await job_model_1.JobModel.findById(application.job).exec();
        if (!job) {
            return res.status(404).json({ error: "Job not found" });
        }
        const scores = await (0, interviewScoring_1.scoreInterview)(job, application, application.interviewResult);
        const completedAt = new Date();
        await application_model_1.ApplicationModel.updateOne({ _id: application._id }, {
            $set: {
                "interviewResult.scores": scores,
                "interviewResult.completedAt": completedAt,
            },
        }).exec();
        return res.json({
            ...application.interviewResult,
            scores,
            completedAt,
        });
    }
    catch (error) {
        console.error("[applications] interview score error", error);
        return res.status(500).json({ error: "Failed to score interview" });
    }
});
//# sourceMappingURL=application.routes.js.map