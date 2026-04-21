import { Router, type Request, type Response } from "express";
import multer from "multer";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { ApplicationModel } from "../models/application.model";
import { JobModel } from "../models/job.model";
import { generateScreeningExplanation } from "../ai/screeningGraph";
import { generateInterviewQuestions } from "../ai/interviewQuestionGenerator";
import { generateInterviewFollowupQuestion } from "../ai/interviewFollowupGenerator";
import { scoreInterview } from "../ai/interviewScoring";
import { extractTextFromUploadedFile } from "../services/fileParsing.service";
import { extractStructuredProfile } from "../services/profileExtraction.service";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.middleware";

const router = Router();

function fingerprintResume(resumeText: string, coverLetterText?: string): string {
  const source = `${resumeText}\n---\n${coverLetterText || ""}`;
  return createHash("sha256").update(source).digest("hex");
}

function canAccessApplication(req: AuthenticatedRequest, application: any): boolean {
  if (!req.userId || !req.userRole) return false;
  if (req.userRole === "owner") return true;
  if (req.userRole === "candidate") {
    return String(application.candidateUserId || "") === String(req.userId);
  }
  return false;
}

function canRecruiterAccessJob(req: AuthenticatedRequest, job: any): boolean {
  if (!req.userId || !req.userRole) return false;
  if (req.userRole === "owner") return true;
  if (req.userRole === "recruiter") {
    return String(job?.createdBy || "") === String(req.userId);
  }
  return false;
}

function normalizeLinkedInUrl(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().replace(/[\s\u00A0]+/g, " ");
  if (!trimmed) return undefined;

  const cleaned = trimmed
    .replace(/^@+/, "")
    .replace(/[),.;]+$/, "");

  const withScheme = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error("Invalid LinkedIn URL");
  }

  const hostname = url.hostname.toLowerCase();
  if (!(hostname === "linkedin.com" || hostname.endsWith(".linkedin.com"))) {
    throw new Error("LinkedIn URL must be a linkedin.com URL");
  }

  return url.toString();
}

function parseJsonField<T>(value: unknown): T | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return undefined;
  }
}

function inferEvidenceName(originalName: string, fallback: string): string {
  const noExt = originalName.replace(/\.[a-z0-9]+$/i, "");
  const cleaned = noExt
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

function saveUploadedImage(buffer: Buffer, originalname: string): { imageUrl: string; originalName: string } {
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const ext = path.extname(originalname || "").toLowerCase() || ".jpg";
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
  const fullPath = path.join(uploadsDir, safeName);
  fs.writeFileSync(fullPath, buffer);
  return {
    imageUrl: `/uploads/${safeName}`,
    originalName: originalname,
  };
}

function ensureImageMime(file: { mimetype: string }): boolean {
  return file.mimetype.startsWith("image/");
}

// In-memory file storage for resume / cover letter uploads
const upload = multer({ storage: multer.memoryStorage() });

// Candidate: list own applications
router.get(
  "/candidate/applications",
  requireAuth(["candidate"]),
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const applications = await (ApplicationModel as any)
      .find({ candidateUserId: userId })
      .populate("job", "title companyName location employmentType interviewConfig")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ applications });
  } catch (error) {
    console.error("Error fetching candidate applications", error);
    return res.status(500).json({ message: "Failed to fetch applications" });
  }
});

// DTO type for creating an application
interface CreateApplicationBody {
  jobId: string;
  candidateProfile: {
    fullName: string;
    firstName?: string;
    lastName?: string;
    email: string;
    headline?: string;
    bio?: string;
    location?: string;
    totalExperienceYears?: number;
    skills?: {
      name: string;
      level?: "beginner" | "intermediate" | "advanced" | "expert";
      years?: number;
    }[];
    languages?: {
      name: string;
      proficiency?: "basic" | "conversational" | "fluent" | "native";
    }[];
    experiences?: {
      role: string;
      company: string;
      startDate?: string;
      endDate?: string | null;
      description?: string;
    }[];
    education?: {
      institution: string;
      degree?: string;
      fieldOfStudy?: string;
      startYear?: number;
      endYear?: number;
    }[];
    projects?: {
      name: string;
      description?: string;
      technologies?: string[];
      link?: string;
    }[];
    certifications?: {
      name: string;
      issuer?: string;
      year?: number;
      issueDate?: string;
    }[];
    availability?: {
      status?: "available" | "open_to_opportunities" | "not_available";
      type?: "full_time" | "part_time" | "contract";
      startDate?: string;
    };
    socialLinks?: {
      linkedin?: string;
      github?: string;
      portfolio?: string;
      [key: string]: string | undefined;
    };
    resumeText: string;
    coverLetterText?: string;
    linkedInUrl?: string;
  };
}

// Create a new application
router.post("/", async (req: Request, res: Response) => {
  try {
    const body = req.body as CreateApplicationBody;
    const authReq = req as AuthenticatedRequest;

    if (!body.jobId || !body.candidateProfile || !body.candidateProfile.fullName || !body.candidateProfile.email || !body.candidateProfile.resumeText) {
      return res.status(400).json({ error: "Missing required application fields" });
    }

    if (authReq.userId) {
      const existing = await ApplicationModel.findOne({
        job: body.jobId,
        candidateUserId: authReq.userId,
      }).exec();
      if (existing) {
        return res.status(409).json({ error: "You already applied to this job" });
      }
    } else {
      const existingByEmail = await ApplicationModel.findOne({
        job: body.jobId,
        "candidateProfile.email": body.candidateProfile.email,
      }).exec();
      if (existingByEmail) {
        return res.status(409).json({ error: "Application already exists for this email on the selected job" });
      }
    }

    const structured = extractStructuredProfile(
      body.candidateProfile.resumeText,
      body.candidateProfile.coverLetterText,
      {
        ...(body.candidateProfile.headline ? { headline: body.candidateProfile.headline } : {}),
        ...(body.candidateProfile.bio ? { bio: body.candidateProfile.bio } : {}),
      },
    );

    let normalizedLinkedIn: string | undefined;
    try {
      normalizedLinkedIn = normalizeLinkedInUrl(body.candidateProfile.linkedInUrl);
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || "Invalid LinkedIn URL" });
    }

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
      skills:
        profileInput.skills && profileInput.skills.length > 0
          ? profileInput.skills
          : structured.skills,
      experiences:
        profileInput.experiences && profileInput.experiences.length > 0
          ? profileInput.experiences
          : structured.experiences,
      education:
        profileInput.education && profileInput.education.length > 0
          ? profileInput.education
          : structured.education,
      projects:
        profileInput.projects && profileInput.projects.length > 0
          ? profileInput.projects
          : structured.projects,
      certifications:
        profileInput.certifications && profileInput.certifications.length > 0
          ? profileInput.certifications
          : structured.certifications,
      languages: profileInput.languages ?? [],
      ...(profileInput.availability ? { availability: profileInput.availability } : {}),
      ...(profileInput.socialLinks ? { socialLinks: profileInput.socialLinks } : {}),
      resumeText: profileInput.resumeText,
      ...(profileInput.coverLetterText ? { coverLetterText: profileInput.coverLetterText } : {}),
      ...(normalizedLinkedIn ? { linkedInUrl: normalizedLinkedIn } : {}),
      structuredExtractedAt: new Date(),
      resumeFingerprint: fingerprintResume(
        profileInput.resumeText,
        profileInput.coverLetterText,
      ),
      structuredSource: "heuristic" as const,
    };

    const application = await ApplicationModel.create({
      job: body.jobId,
      ...(authReq.userId ? { candidateUserId: authReq.userId } : {}),
      candidateProfile: candidateProfilePayload,
    });

    return res.status(201).json(application);
  } catch (error) {
    console.error("[applications] create error", error);
    return res.status(500).json({ error: "Failed to create application" });
  }
});

// Create a new application from uploaded resume / cover letter files (PDF/DOCX)
router.post(
  "/upload",
  requireAuth(["candidate"]),
  upload.fields([
    { name: "resumeFile", maxCount: 1 },
    { name: "coverLetterFile", maxCount: 1 },
    { name: "projectImages", maxCount: 8 },
    { name: "certificateImages", maxCount: 8 },
  ]),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const {
        jobId,
        fullName,
        firstName,
        lastName,
        email,
        headline,
        bio,
        location,
        linkedInUrl,
        availability,
        socialLinks,
      } = req.body;

      const parsedAvailability = parseJsonField<CreateApplicationBody["candidateProfile"]["availability"]>(availability);
      const parsedSocialLinks = parseJsonField<CreateApplicationBody["candidateProfile"]["socialLinks"]>(socialLinks);

      if (!jobId || !fullName || !email) {
        return res.status(400).json({ error: "Missing required fields: jobId, fullName, email" });
      }

      if (authReq.userId) {
        const existing = await ApplicationModel.findOne({
          job: jobId,
          candidateUserId: authReq.userId,
        }).exec();
        if (existing) {
          return res.status(409).json({ error: "You already applied to this job" });
        }
      }

      const anyReq = req as any;
      const files = anyReq.files as
        | {
            [fieldname: string]: {
              buffer: Buffer;
              mimetype: string;
              originalname: string;
            }[];
          }
        | undefined;

      const resumeFile = files?.resumeFile?.[0];
      const coverLetterFile = files?.coverLetterFile?.[0];
      const projectImageFiles = files?.projectImages ?? [];
      const certificateImageFiles = files?.certificateImages ?? [];

      let resumeText = "";
      let coverLetterText: string | undefined = undefined;

      if (resumeFile) {
        resumeText = await extractTextFromUploadedFile(resumeFile);
      }

      if (coverLetterFile) {
        coverLetterText = await extractTextFromUploadedFile(coverLetterFile);
      }

      if (!resumeText) {
        return res.status(400).json({ error: "Could not extract text from resume file" });
      }

      for (const file of [...projectImageFiles, ...certificateImageFiles]) {
        if (!ensureImageMime(file)) {
          return res.status(400).json({ error: "Project and certificate uploads must be image files" });
        }
      }

      const projectAssets = projectImageFiles.map((file) =>
        saveUploadedImage(file.buffer, file.originalname),
      );
      const certificationAssets = certificateImageFiles.map((file) =>
        saveUploadedImage(file.buffer, file.originalname),
      );

      let normalizedLinkedIn: string | undefined;
      try {
        normalizedLinkedIn = normalizeLinkedInUrl(linkedInUrl);
      } catch (error: any) {
        return res.status(400).json({ error: error?.message || "Invalid LinkedIn URL" });
      }

      const structured = extractStructuredProfile(resumeText, coverLetterText, {
        ...(headline ? { headline } : {}),
        ...(bio ? { bio } : {}),
      });

      const inferredProjects = projectImageFiles.map((file) => ({
        name: inferEvidenceName(file.originalname, "Project evidence"),
        description: "Uploaded project proof image",
      }));

      const inferredCertifications = certificateImageFiles.map((file) => ({
        name: inferEvidenceName(file.originalname, "Certificate evidence"),
        issuer: "Uploaded by candidate",
      }));

      const application = await ApplicationModel.create({
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
          projects: [...structured.projects, ...inferredProjects],
          projectAssets,
          certifications: [...structured.certifications, ...inferredCertifications],
          certificationAssets,
          ...(parsedAvailability ? { availability: parsedAvailability } : {}),
          ...(parsedSocialLinks ? { socialLinks: parsedSocialLinks } : {}),
          resumeText,
          coverLetterText,
          ...(normalizedLinkedIn ? { linkedInUrl: normalizedLinkedIn } : {}),
          structuredExtractedAt: new Date(),
          resumeFingerprint: fingerprintResume(resumeText, coverLetterText),
          structuredSource: "heuristic",
        },
      } as any);

      return res.status(201).json(application);
    } catch (error) {
      console.error("[applications/upload] create error", error);
      return res
        .status(500)
        .json({ error: "Failed to create application from uploaded files" });
    }
  },
);
// Fetch a single application with basic job context for recruiter views
router.get("/:applicationId", requireAuth(["owner", "recruiter"]), async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { applicationId } = req.params;

    const application = await ApplicationModel.findById(applicationId)
      .populate({ path: "job", select: "title companyName description requiredSkills createdAt" })
      .populate({ path: "candidateUserId", select: "profilePhotoUrl name" })
      .exec();

    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    if (authReq.userRole === "recruiter") {
      const job = await JobModel.findById(application.job).select("createdBy").lean().exec();
      if (!job || String(job.createdBy) !== String(authReq.userId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    return res.json(application);
  } catch (error) {
    console.error("[applications] get one error", error);
    return res.status(500).json({ error: "Failed to fetch application" });
  }
});

router.post(
  "/:applicationId/screening/explanation",
  requireAuth(["owner", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      const { applicationId } = req.params;
      const application = await ApplicationModel.findById(applicationId).exec();

      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      if (!application.screeningResult) {
        return res.status(400).json({ error: "Screening result does not exist yet" });
      }

      const job = await JobModel.findById(application.job).exec();
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const explanation = await generateScreeningExplanation(job as any, application.screeningResult as any);
      application.screeningResult.rawExplanation = explanation;
      await application.save();

      return res.json({
        applicationId: String(application._id),
        explanation,
      });
    } catch (error) {
      console.error("[applications] generate explanation error", error);
      return res.status(500).json({ error: "Failed to generate screening explanation" });
    }
  },
);

export const applicationRouter = router;

// Fetch interview questions for a given application based on its job's interviewConfig
router.get("/:applicationId/interview-questions", requireAuth(["candidate", "recruiter", "owner"]), async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { applicationId } = req.params;
    const application = await ApplicationModel.findById(applicationId).exec();
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    if (!canAccessApplication(authReq, application)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const job = await JobModel.findById(application.job).exec();
    if (!job || !job.interviewConfig || !job.interviewConfig.enabled) {
      return res.status(400).json({ error: "Interview is not enabled for this job" });
    }

    if (!canRecruiterAccessJob(authReq, job)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const cfg = job.interviewConfig;
    const languageCode = cfg.languageCode || "en";

    const maxDurationMinutes = Math.max(3, Math.min(15, cfg.maxDurationMinutes ?? 10));
    const maxQuestions = Math.max(3, Math.min(10, cfg.maxQuestions ?? 6));

    let questions = cfg.questions;
    if ((!questions || questions.length === 0) || cfg.mode === "auto") {
      questions = await generateInterviewQuestions(job as any, languageCode, maxQuestions, maxDurationMinutes);
    }

    questions = questions.slice(0, maxQuestions);

    await ApplicationModel.updateOne(
      { _id: application._id },
      {
        $set: {
          "interviewResult.enabledAtRun": true,
          "interviewResult.languageCode": languageCode,
        },
        $setOnInsert: {
          "interviewResult.answers": [],
        },
      },
    ).exec();

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
  } catch (error) {
    console.error("[applications] interview-questions error", error);
    return res.status(500).json({ error: "Failed to fetch interview questions" });
  }
});

router.post(
  "/:applicationId/interview/followup-question",
  requireAuth(["candidate", "recruiter", "owner"]),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { applicationId } = req.params;
      const { questionText, answerTranscript, category, languageCode } = req.body as {
        questionText: string;
        answerTranscript: string;
        category?:
          | "communication"
          | "problem_understanding"
          | "relevance_to_role"
          | "motivation_interest"
          | "practical_knowledge";
        languageCode?: string;
      };

      if (!questionText || !answerTranscript) {
        return res.status(400).json({ error: "Missing questionText or answerTranscript" });
      }

      const application = await ApplicationModel.findById(applicationId).exec();
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      if (!canAccessApplication(authReq, application)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const job = await JobModel.findById(application.job).exec();
      if (!job || !job.interviewConfig || !job.interviewConfig.enabled) {
        return res.status(400).json({ error: "Interview is not enabled for this job" });
      }

      if (!canRecruiterAccessJob(authReq, job)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (!job.interviewConfig.allowAiFollowups) {
        return res.status(400).json({ error: "AI follow-up questions are disabled for this job" });
      }

      const maxQuestions = Math.max(3, Math.min(10, job.interviewConfig.maxQuestions ?? 6));
      const answeredCount = application.interviewResult?.answers?.length ?? 0;
      if (answeredCount >= maxQuestions) {
        return res.status(400).json({ error: "Maximum interview question limit reached" });
      }

      const followup = await generateInterviewFollowupQuestion(
        job as any,
        languageCode || job.interviewConfig.languageCode || "en",
        questionText,
        answerTranscript,
        category || "problem_understanding",
      );

      return res.json({ followup });
    } catch (error) {
      console.error("[applications] interview follow-up error", error);
      return res.status(500).json({ error: "Failed to generate follow-up question" });
    }
  },
);

// Append a transcript answer for a specific interview question (text-based for now)
router.post("/:applicationId/interview/answer-text", requireAuth(["candidate", "recruiter", "owner"]), async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { applicationId } = req.params;
    const { questionId, questionText, transcript, languageCode } = req.body as {
      questionId: string;
      questionText: string;
      transcript: string;
      languageCode?: string;
    };

    if (!questionId || !questionText || !transcript) {
      return res.status(400).json({ error: "Missing questionId, questionText, or transcript" });
    }

    const application = await ApplicationModel.findById(applicationId).exec();
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    if (!canAccessApplication(authReq, application)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const job = await JobModel.findById(application.job).exec();
    if (!job || !job.interviewConfig || !job.interviewConfig.enabled) {
      return res.status(400).json({ error: "Interview is not enabled for this job" });
    }

    if (!canRecruiterAccessJob(authReq, job)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const lang = languageCode || job.interviewConfig.languageCode || "en";

    const answer = {
      questionId,
      questionText,
      languageCode: lang,
      transcript,
      createdAt: new Date(),
    };

    await ApplicationModel.updateOne(
      { _id: application._id },
      {
        $set: {
          "interviewResult.enabledAtRun": true,
          "interviewResult.languageCode": lang,
        },
        $push: {
          "interviewResult.answers": answer,
        },
      },
    ).exec();

    return res.status(201).json({
      enabledAtRun: true,
      languageCode: lang,
      appended: answer,
    });
  } catch (error) {
    console.error("[applications] interview answer-text error", error);
    return res.status(500).json({ error: "Failed to save interview answer" });
  }
});

// Final scoring of the interview once all answers are collected
router.post("/:applicationId/interview/score", requireAuth(["candidate", "recruiter", "owner"]), async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { applicationId } = req.params;

    const application = await ApplicationModel.findById(applicationId).exec();
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    if (!canAccessApplication(authReq, application)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!application.interviewResult || !application.interviewResult.answers.length) {
      return res.status(400).json({ error: "No interview answers to score" });
    }

    const job = await JobModel.findById(application.job).exec();
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (!canRecruiterAccessJob(authReq, job)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const scores = await scoreInterview(job as any, application as any, application.interviewResult as any);

    const completedAt = new Date();
    await ApplicationModel.updateOne(
      { _id: application._id },
      {
        $set: {
          "interviewResult.scores": scores,
          "interviewResult.completedAt": completedAt,
        },
      },
    ).exec();

    return res.json({
      ...application.interviewResult,
      scores,
      completedAt,
    });
  } catch (error) {
    console.error("[applications] interview score error", error);
    return res.status(500).json({ error: "Failed to score interview" });
  }
});

