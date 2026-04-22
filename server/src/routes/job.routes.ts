import { Router, type Request, type Response } from "express";
import { createHash } from "crypto";
import { JobModel, type InterviewConfig } from "../models/job.model";
import { ApplicationModel } from "../models/application.model";
import { UserModel } from "../models/user.model";
import { generateScreeningExplanation, screeningGraph } from "../ai/screeningGraph";
import type { ParsedProfile } from "../ai/screeningTypes";
import { requireAuth } from "../middleware/auth.middleware";
import { extractStructuredProfile } from "../services/profileExtraction.service";

const router = Router();

function getExplanationLimit(openings: number): number {
  if (openings <= 2) return 10;
  if (openings <= 5) return 20;
  return 30;
}

function fingerprintResume(resumeText: string, coverLetterText?: string): string {
  const source = `${resumeText}\n---\n${coverLetterText || ""}`;
  return createHash("sha256").update(source).digest("hex");
}

function normalizeSkillLevel(level?: string): "beginner" | "intermediate" | "advanced" | "expert" | undefined {
  if (!level) return undefined;
  const normalized = level.trim().toLowerCase();
  if (normalized === "beginner" || normalized === "intermediate" || normalized === "advanced" || normalized === "expert") {
    return normalized;
  }
  if (normalized.includes("junior") || normalized.includes("novice") || normalized.includes("basic") || normalized.includes("intro")) return "beginner";
  if (normalized.includes("mid") || normalized.includes("working") || normalized.includes("intermed")) return "intermediate";
  if (normalized.includes("senior") || normalized.includes("strong")) return "advanced";
  if (normalized.includes("lead") || normalized.includes("principal") || normalized.includes("master")) return "expert";
  return undefined;
}

function sanitizeCandidateProfileForSchema(candidateProfile: any): any {
  if (!candidateProfile) return candidateProfile;

  return {
    ...candidateProfile,
    skills: Array.isArray(candidateProfile.skills)
      ? candidateProfile.skills.map((s: any) => ({
          ...s,
          name: String(s?.name ?? "Detected skill").trim() || "Detected skill",
          ...(normalizeSkillLevel(s?.level) ? { level: normalizeSkillLevel(s?.level) } : {}),
        }))
      : [],
    experiences: Array.isArray(candidateProfile.experiences)
      ? candidateProfile.experiences.map((e: any) => ({
          ...e,
          role: String(e?.role ?? "Detected professional experience").trim() || "Detected professional experience",
          company: String(e?.company ?? "From resume").trim() || "From resume",
        }))
      : [],
    education: Array.isArray(candidateProfile.education)
      ? candidateProfile.education.map((e: any) => ({
          ...e,
          institution: String(e?.institution ?? "From resume").trim() || "From resume",
        }))
      : [],
    projects: Array.isArray(candidateProfile.projects)
      ? candidateProfile.projects.map((p: any) => ({
          ...p,
          name: String(p?.name ?? "Detected project work").trim() || "Detected project work",
        }))
      : [],
    certifications: Array.isArray(candidateProfile.certifications)
      ? candidateProfile.certifications.map((c: any) => ({
          ...c,
          name: String(c?.name ?? "Detected certification").trim() || "Detected certification",
        }))
      : [],
  };
}

function mapParsedToCandidateProfile(parsed: ParsedProfile) {
  const safeText = (value: unknown, fallback: string): string => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? text : fallback;
  };

  return {
    skills: (parsed.skills ?? []).map((s) => {
      const normalizedLevel = normalizeSkillLevel(s.level);
      return {
        name: safeText(s.name, "Detected skill"),
        ...(normalizedLevel ? { level: normalizedLevel } : {}),
        ...(typeof s.years === "number" ? { years: s.years } : {}),
      };
    }),
    experiences: (parsed.experiences ?? []).map((e) => ({
      role: safeText(e.role, "Detected professional experience"),
      company: safeText(e.company, "From resume"),
      ...(e.startDate ? { startDate: e.startDate } : {}),
      ...(e.endDate !== undefined ? { endDate: e.endDate } : {}),
      ...(e.description ? { description: e.description } : {}),
    })),
    education: (parsed.education ?? []).map((e) => ({
      institution: safeText(e.institution, "From resume"),
      ...(e.degree ? { degree: e.degree } : {}),
      ...(e.fieldOfStudy ? { fieldOfStudy: e.fieldOfStudy } : {}),
      ...(typeof e.startYear === "number" ? { startYear: e.startYear } : {}),
      ...(typeof e.endYear === "number" ? { endYear: e.endYear } : {}),
    })),
    projects: (parsed.projects ?? []).map((p) => ({
      name: safeText(p.name, "Detected project work"),
      ...(p.description ? { description: p.description } : {}),
      ...(Array.isArray(p.technologies) ? { technologies: p.technologies } : {}),
      ...(p.link ? { link: p.link } : {}),
    })),
    certifications: (parsed.certifications ?? []).map((c) => ({
      name: safeText(c.name, "Detected certification"),
      ...(c.issuer ? { issuer: c.issuer } : {}),
      ...(typeof c.year === "number" ? { year: c.year } : {}),
    })),
  };
}

async function runWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  let index = 0;

  const runNext = async (): Promise<void> => {
    const current = index;
    index += 1;
    if (current >= items.length) return;
    const item = items[current]!;
    await worker(item);
    await runNext();
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runNext()));
}

// DTO type for creating a job
interface CreateJobBody {
  title: string;
  companyName: string;
  location?: string;
  employmentType?: "full_time" | "part_time" | "contract" | "internship" | "temporary";
  description: string;
  responsibilities?: string;
  requirements?: string;
  requiredSkills: string[];
  niceToHaveSkills?: string[];
  openings?: number;
  minExperienceYears?: number;
  educationLevel?: string;
  rollingBasis?: boolean;
  applicationDeadline?: string;
  salaryMin?: number;
  salaryMax?: number;
}

interface InterviewConfigBody {
  enabled?: boolean;
  languageCode?: string;
  mode?: "manual" | "auto";
  allowAiFollowups?: boolean;
  maxDurationMinutes?: number;
  maxQuestions?: number;
  questions?: Array<{
    id: string;
    text: string;
    category:
      | "communication"
      | "problem_understanding"
      | "relevance_to_role"
      | "motivation_interest"
      | "practical_knowledge";
  }>;
}

// Create a new job
router.post("/", requireAuth(["owner", "recruiter"]), async (req: Request, res: Response) => {
  try {
    const body = req.body as CreateJobBody & { interviewConfig?: InterviewConfigBody };

    if (!body.title || !body.companyName || !body.description || !body.requiredSkills) {
      return res.status(400).json({ error: "Missing required job fields" });
    }

    if (body.rollingBasis === false && !body.applicationDeadline) {
      return res.status(400).json({ error: "applicationDeadline is required when rollingBasis is false" });
    }

    if (
      typeof body.salaryMin === "number" &&
      typeof body.salaryMax === "number" &&
      body.salaryMin > body.salaryMax
    ) {
      return res.status(400).json({ error: "salaryMin cannot be greater than salaryMax" });
    }

    const anyReq = req as any;
    const createdByUserId = anyReq.userId as string | undefined;

    if (!createdByUserId) {
      return res.status(401).json({ error: "Missing authenticated user" });
    }

    const creator = await UserModel.findById(createdByUserId).select("companyLogoUrl").lean().exec();

    const jobData: Record<string, unknown> = {
      title: body.title,
      companyName: body.companyName,
      description: body.description,
      requiredSkills: body.requiredSkills,
      createdBy: createdByUserId,
      ...(creator?.companyLogoUrl ? { companyLogoUrl: creator.companyLogoUrl } : {}),
    };

    if (body.location) jobData.location = body.location;
    if (body.employmentType) jobData.employmentType = body.employmentType;
    if (body.responsibilities) jobData.responsibilities = body.responsibilities;
    if (body.requirements) jobData.requirements = body.requirements;
    if (body.niceToHaveSkills) jobData.niceToHaveSkills = body.niceToHaveSkills;
    if (typeof body.openings === "number") jobData.openings = body.openings;
    if (body.minExperienceYears !== undefined) jobData.minExperienceYears = body.minExperienceYears;
    if (body.educationLevel) jobData.educationLevel = body.educationLevel;
    if (typeof body.rollingBasis === "boolean") jobData.rollingBasis = body.rollingBasis;
    if (body.applicationDeadline) {
      const parsedDeadline = new Date(body.applicationDeadline);
      if (Number.isNaN(parsedDeadline.getTime())) {
        return res.status(400).json({ error: "Invalid applicationDeadline" });
      }
      jobData.applicationDeadline = parsedDeadline;
    }
    if (typeof body.salaryMin === "number") jobData.salaryMin = body.salaryMin;
    if (typeof body.salaryMax === "number") jobData.salaryMax = body.salaryMax;

    if (body.interviewConfig) {
      const cfg = body.interviewConfig;
      const interviewConfig: InterviewConfig = {
        enabled: cfg.enabled ?? false,
        languageCode: cfg.languageCode ?? "en",
        mode: cfg.mode ?? "auto",
        allowAiFollowups: cfg.allowAiFollowups ?? true,
        maxDurationMinutes: Math.max(3, Math.min(15, cfg.maxDurationMinutes ?? 10)),
        maxQuestions: Math.max(3, Math.min(10, cfg.maxQuestions ?? 6)),
        questions: (cfg.questions ?? []).map((q) => ({
          id: q.id,
          text: q.text,
          category: q.category,
        })),
      };
      jobData.interviewConfig = interviewConfig;
    }

    const job = await JobModel.create(jobData);

    return res.status(201).json(job);
  } catch (error) {
    console.error("[jobs] create error", error);
    return res.status(500).json({ error: "Failed to create job" });
  }
});

// List jobs (basic listing for now)
router.get("/", async (_req: Request, res: Response) => {
  try {
    const jobs = await JobModel.find().sort({ createdAt: -1 }).exec();
    return res.json(jobs);
  } catch (error) {
    console.error("[jobs] list error", error);
    return res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

router.get("/my", requireAuth(["owner", "recruiter"]), async (req: Request, res: Response) => {
  try {
    const anyReq = req as any;
    const userId = anyReq.userId as string | undefined;
    const userRole = anyReq.userRole as string | undefined;

    if (!userId || !userRole) {
      return res.status(401).json({ error: "Missing authenticated user" });
    }

    const filter = userRole === "owner" ? {} : { createdBy: userId };
    const jobs = await JobModel.find(filter).sort({ createdAt: -1 }).exec();
    return res.json(jobs);
  } catch (error) {
    console.error("[jobs] my list error", error);
    return res.status(500).json({ error: "Failed to fetch recruiter jobs" });
  }
});

router.get("/:jobId", async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = await JobModel.findById(jobId).lean().exec();

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    return res.json(job);
  } catch (error) {
    console.error("[jobs] get job error", error);
    return res.status(500).json({ error: "Failed to fetch job" });
  }
});

router.get("/admin/overview", requireAuth(["owner"]), async (_req: Request, res: Response) => {
  try {
    const jobs = await JobModel.find().sort({ createdAt: -1 }).lean().exec();

    const applicationAgg = await ApplicationModel.aggregate([
      {
        $group: {
          _id: "$job",
          applicantCount: { $sum: 1 },
          screenedCount: {
            $sum: {
              $cond: [{ $ifNull: ["$screeningResult", false] }, 1, 0],
            },
          },
          interviewedCount: {
            $sum: {
              $cond: [{ $ifNull: ["$interviewResult.scores", false] }, 1, 0],
            },
          },
        },
      },
    ]);

    const countsByJobId = new Map<string, { applicantCount: number; screenedCount: number; interviewedCount: number }>();
    for (const row of applicationAgg) {
      countsByJobId.set(String(row._id), {
        applicantCount: Number(row.applicantCount ?? 0),
        screenedCount: Number(row.screenedCount ?? 0),
        interviewedCount: Number(row.interviewedCount ?? 0),
      });
    }

    const jobsWithCounts = jobs.map((job) => {
      const counts = countsByJobId.get(String(job._id)) ?? {
        applicantCount: 0,
        screenedCount: 0,
        interviewedCount: 0,
      };

      return {
        ...job,
        ...counts,
      };
    });

    const totals = jobsWithCounts.reduce(
      (acc, j) => {
        acc.jobs += 1;
        acc.applicants += j.applicantCount;
        acc.screened += j.screenedCount;
        acc.interviewed += j.interviewedCount;
        return acc;
      },
      { jobs: 0, applicants: 0, screened: 0, interviewed: 0 },
    );

    return res.json({
      totals,
      jobs: jobsWithCounts,
    });
  } catch (error) {
    console.error("[jobs] admin overview error", error);
    return res.status(500).json({ error: "Failed to fetch admin overview" });
  }
});

export const jobRouter = router;

// Update or create interview configuration for a job
router.put(
  "/:jobId/interview-config",
  requireAuth(["owner", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const body = req.body as InterviewConfigBody;

      const job = await JobModel.findById(jobId).exec();
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const anyReq = req as any;
      const userId = anyReq.userId as string | undefined;
      if (!userId || String(job.createdBy) !== String(userId)) {
        return res.status(403).json({ error: "Not allowed to modify this job" });
      }

      const current: InterviewConfig = job.interviewConfig ?? {
        enabled: false,
        languageCode: "en",
        mode: "auto",
        allowAiFollowups: true,
        maxDurationMinutes: 10,
        maxQuestions: 6,
        questions: [],
      };

      const updated: InterviewConfig = {
        enabled: body.enabled ?? current.enabled,
        languageCode: body.languageCode ?? current.languageCode,
        mode: body.mode ?? current.mode,
        allowAiFollowups: body.allowAiFollowups ?? current.allowAiFollowups,
        maxDurationMinutes:
          body.maxDurationMinutes !== undefined
            ? Math.max(3, Math.min(15, body.maxDurationMinutes))
            : current.maxDurationMinutes,
        maxQuestions:
          body.maxQuestions !== undefined
            ? Math.max(3, Math.min(10, body.maxQuestions))
            : current.maxQuestions,
        questions:
          body.questions?.map((q) => ({ id: q.id, text: q.text, category: q.category })) ??
          current.questions,
      };

      job.interviewConfig = updated;
      await job.save();

      return res.json(job.interviewConfig);
    } catch (error) {
      console.error("[jobs] update interview config error", error);
      return res.status(500).json({ error: "Failed to update interview config" });
    }
  },
);

// Run full LangGraph-based screening for all applications of a job
router.post("/:jobId/screen", requireAuth(["owner", "recruiter"]), async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const forceAll = Boolean((req.body as any)?.forceAll);

    const job = await JobModel.findById(jobId).exec();
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    const anyReq = req as any;
    const userId = anyReq.userId as string | undefined;
    const userRole = anyReq.userRole as string | undefined;
    if (!userId || !userRole) {
      return res.status(401).json({ error: "Missing authenticated user" });
    }
    if (userRole === "recruiter" && String(job.createdBy) !== String(userId)) {
      return res.status(403).json({ error: "Not allowed to screen this job" });
    }

    const applications = await ApplicationModel.find({ job: job._id as any }).exec();
    if (applications.length === 0) {
      return res
        .status(200)
        .json({ message: "No applications for this job yet", applications: [] });
    }

    const failedApplications: Array<{ applicationId: string; reason: string }> = [];

    const applicationsToProcess = forceAll
      ? applications
      : applications.filter((app) => {
          if (!app.screeningResult?.lastRunAt) return true;
          const profileUpdatedAt = app.candidateProfile.structuredExtractedAt;
          if (profileUpdatedAt && profileUpdatedAt > app.screeningResult.lastRunAt) return true;
          return false;
        });

    const skippedCount = applications.length - applicationsToProcess.length;

    await runWithConcurrency(applicationsToProcess, 4, async (app) => {
      const initialState: any = {
        jobId: String(jobId),
        applicationId: String(app._id),
        job,
        candidateProfile: app.candidateProfile,
        explanationRequired: false,
      };

      try {
        const finalState: any = await screeningGraph.invoke(initialState);
        app.candidateProfile = sanitizeCandidateProfileForSchema(app.candidateProfile);

        if (finalState.parsedProfile) {
          const parsedProfile = mapParsedToCandidateProfile(finalState.parsedProfile as ParsedProfile);
          app.candidateProfile = sanitizeCandidateProfileForSchema({
            ...sanitizeCandidateProfileForSchema(app.candidateProfile),
            ...parsedProfile,
            structuredExtractedAt: new Date(),
            resumeFingerprint: fingerprintResume(
              app.candidateProfile.resumeText,
              app.candidateProfile.coverLetterText,
            ),
            structuredSource: "ai",
          }) as any;
        }

        if (finalState.screeningResult) {
          app.screeningResult = finalState.screeningResult;
        }

        await app.save();
      } catch (err: any) {
        failedApplications.push({
          applicationId: String(app._id),
          reason: String(err?.message || "Screening temporarily unavailable"),
        });
      }
    });

    // Sort by matchScore descending
    const updated = [...applications].sort((a, b) => {
      const scoreA =
        a.interviewResult?.scores?.overallWithScreening ?? a.screeningResult?.matchScore ?? 0;
      const scoreB =
        b.interviewResult?.scores?.overallWithScreening ?? b.screeningResult?.matchScore ?? 0;
      return scoreB - scoreA;
    });

    const openings = Number(job.openings ?? 1);
    const explanationLimit = getExplanationLimit(openings);

    await runWithConcurrency(updated.slice(0, explanationLimit), 3, async (app) => {
      try {
        if (!app.screeningResult) return;
        app.candidateProfile = sanitizeCandidateProfileForSchema(app.candidateProfile);
        const explanation = await generateScreeningExplanation(job as any, app.screeningResult as any);
        app.screeningResult.rawExplanation = explanation;
        await app.save();
      } catch (err: any) {
        failedApplications.push({
          applicationId: String(app._id),
          reason: String(err?.message || "Failed to persist explanation"),
        });
      }
    });

    await runWithConcurrency(updated.slice(explanationLimit), 8, async (app) => {
      try {
        if (!app.screeningResult) return;
        app.candidateProfile = sanitizeCandidateProfileForSchema(app.candidateProfile);
        app.screeningResult.rawExplanation =
          "Detailed explanation intentionally skipped for cost control. Open candidate details to generate a targeted explanation on demand.";
        await app.save();
      } catch (err: any) {
        failedApplications.push({
          applicationId: String(app._id),
          reason: String(err?.message || "Failed to persist explanation placeholder"),
        });
      }
    });

    return res.json({
      jobId,
      totalApplications: updated.length,
      processedCount: applicationsToProcess.length,
      skippedCount,
      forceAll,
      explanationLimit,
      failedCount: failedApplications.length,
      failedApplications,
      message:
        applicationsToProcess.length === 0
          ? "No new or changed applications required screening."
          : failedApplications.length > 0
          ? "Some candidates are still processing due to temporary AI provider load. Please refresh in a few minutes."
          : "Screening completed successfully.",
      applications: updated,
    });
  } catch (error) {
    console.error("[jobs] screening error", error);
    return res.status(500).json({ error: "Failed to run screening" });
  }
});

// List applications for a job, sorted by screening match score (if available)
router.get(
  "/:jobId/applications",
  requireAuth(["owner", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;

      const job = await JobModel.findById(jobId).exec();
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const anyReq = req as any;
      const userId = anyReq.userId as string | undefined;
      const userRole = anyReq.userRole as string | undefined;
      if (!userId || !userRole) {
        return res.status(401).json({ error: "Missing authenticated user" });
      }
      if (userRole === "recruiter" && String(job.createdBy) !== String(userId)) {
        return res.status(403).json({ error: "Not allowed to access this job" });
      }

      const applications = await ApplicationModel.find({ job: job._id as any })
        .populate({ path: "candidateUserId", select: "profilePhotoUrl name" })
        .exec();

      applications.sort((a, b) => {
        const scoreA =
          a.interviewResult?.scores?.overallWithScreening ?? a.screeningResult?.matchScore ?? 0;
        const scoreB =
          b.interviewResult?.scores?.overallWithScreening ?? b.screeningResult?.matchScore ?? 0;
        if (scoreA === scoreB) {
          return (a.createdAt?.getTime?.() ?? 0) - (b.createdAt?.getTime?.() ?? 0);
        }
        return scoreB - scoreA;
      });

      return res.json({
        jobId,
        totalApplications: applications.length,
        applications,
      });
    } catch (error) {
      console.error("[jobs] list applications error", error);
      return res.status(500).json({ error: "Failed to fetch applications for job" });
    }
  },
);

router.post(
  "/:jobId/backfill-structured-profiles",
  requireAuth(["owner", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const job = await JobModel.findById(jobId).exec();

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const anyReq = req as any;
      const userId = anyReq.userId as string | undefined;
      const userRole = anyReq.userRole as string | undefined;
      if (!userId || !userRole) {
        return res.status(401).json({ error: "Missing authenticated user" });
      }
      if (userRole === "recruiter" && String(job.createdBy) !== String(userId)) {
        return res.status(403).json({ error: "Not allowed to access this job" });
      }

      const applications = await ApplicationModel.find({ job: job._id as any }).exec();
      let updatedCount = 0;

      for (const app of applications) {
        const profile = app.candidateProfile;
        if (!profile?.resumeText) continue;

        const fingerprint = fingerprintResume(profile.resumeText, profile.coverLetterText);
        const isCurrent = profile.resumeFingerprint === fingerprint;
        const hasStructuredData =
          (profile.skills?.length ?? 0) > 0 ||
          (profile.experiences?.length ?? 0) > 0 ||
          (profile.education?.length ?? 0) > 0 ||
          (profile.projects?.length ?? 0) > 0 ||
          (profile.certifications?.length ?? 0) > 0;

        if (isCurrent && hasStructuredData) {
          continue;
        }

        const structured = extractStructuredProfile(profile.resumeText, profile.coverLetterText, {
          ...(profile.headline ? { headline: profile.headline } : {}),
          ...(profile.bio ? { bio: profile.bio } : {}),
        });
        profile.skills = structured.skills;
        profile.experiences = structured.experiences;
        profile.education = structured.education;
        profile.projects = structured.projects;
        profile.certifications = structured.certifications;
        profile.resumeFingerprint = fingerprint;
        profile.structuredExtractedAt = new Date();

        await app.save();
        updatedCount += 1;
      }

      return res.json({
        jobId,
        totalApplications: applications.length,
        updatedCount,
      });
    } catch (error) {
      console.error("[jobs] backfill structured profiles error", error);
      return res.status(500).json({ error: "Failed to backfill structured profiles" });
    }
  },
);
