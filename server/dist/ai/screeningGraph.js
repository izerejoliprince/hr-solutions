"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.screeningGraph = exports.ScreeningStateAnnotation = void 0;
exports.generateScreeningExplanation = generateScreeningExplanation;
const dotenv_1 = __importDefault(require("dotenv"));
const langgraph_1 = require("@langchain/langgraph");
const zod_1 = require("zod");
const scoring_service_1 = require("../services/scoring.service");
const llmProvider_1 = require("./llmProvider");
const profileExtraction_service_1 = require("../services/profileExtraction.service");
dotenv_1.default.config();
// 1) Define the LangGraph state using Annotation.Root
exports.ScreeningStateAnnotation = langgraph_1.Annotation.Root({
    jobId: (0, langgraph_1.Annotation)(),
    applicationId: (0, langgraph_1.Annotation)(),
    job: (0, langgraph_1.Annotation)(),
    candidateProfile: (0, langgraph_1.Annotation)(),
    parsedProfile: (0, langgraph_1.Annotation)(),
    parseWarnings: (0, langgraph_1.Annotation)(),
    normalizedProfile: (0, langgraph_1.Annotation)(),
    screeningResult: (0, langgraph_1.Annotation)(),
    explanation: (0, langgraph_1.Annotation)(),
    explanationRequired: (0, langgraph_1.Annotation)(),
});
const SkillSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    level: zod_1.z.string().optional(),
    years: zod_1.z.coerce.number().optional(),
});
const ExperienceSchema = zod_1.z.object({
    role: zod_1.z.string().min(1),
    company: zod_1.z.string().min(1),
    startDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().nullable().optional(),
    description: zod_1.z.string().optional(),
});
const EducationSchema = zod_1.z.object({
    institution: zod_1.z.string().min(1),
    degree: zod_1.z.string().optional(),
    fieldOfStudy: zod_1.z.string().optional(),
    startYear: zod_1.z.coerce.number().optional(),
    endYear: zod_1.z.coerce.number().optional(),
});
const ProjectSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    technologies: zod_1.z.array(zod_1.z.string()).optional(),
    link: zod_1.z.string().optional(),
});
const CertificationSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    issuer: zod_1.z.string().optional(),
    year: zod_1.z.coerce.number().optional(),
});
const SkillsSchema = zod_1.z.array(SkillSchema);
const ExperiencesSchema = zod_1.z.array(ExperienceSchema);
const EducationListSchema = zod_1.z.array(EducationSchema);
const ProjectsSchema = zod_1.z.array(ProjectSchema);
const CertificationsSchema = zod_1.z.array(CertificationSchema);
const ParsedProfileSchema = zod_1.z.object({
    skills: SkillsSchema.default([]),
    experiences: ExperiencesSchema.default([]),
    education: EducationListSchema.default([]),
    projects: ProjectsSchema.default([]),
    certifications: CertificationsSchema.default([]),
});
const NormalizedProfileSchema = zod_1.z.object({
    skills: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string().min(1),
        level: zod_1.z.string().optional(),
        years: zod_1.z.coerce.number().optional(),
        isRelevantToJob: zod_1.z.boolean().optional(),
        relevanceScore: zod_1.z.coerce.number().min(0).max(1).optional(),
    })).default([]),
    experiences: zod_1.z.array(zod_1.z.object({
        role: zod_1.z.string().min(1),
        company: zod_1.z.string().min(1),
        startDate: zod_1.z.string().optional(),
        endDate: zod_1.z.string().nullable().optional(),
        description: zod_1.z.string().optional(),
        isRelevantToJob: zod_1.z.boolean().optional(),
        relevanceScore: zod_1.z.coerce.number().min(0).max(1).optional(),
    })).default([]),
    education: zod_1.z.array(zod_1.z.object({
        institution: zod_1.z.string().min(1),
        degree: zod_1.z.string().optional(),
        fieldOfStudy: zod_1.z.string().optional(),
        startYear: zod_1.z.coerce.number().optional(),
        endYear: zod_1.z.coerce.number().optional(),
        isRelevantToJob: zod_1.z.boolean().optional(),
        relevanceScore: zod_1.z.coerce.number().min(0).max(1).optional(),
    })).default([]),
    projects: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string().min(1),
        description: zod_1.z.string().optional(),
        technologies: zod_1.z.array(zod_1.z.string()).optional(),
        link: zod_1.z.string().optional(),
        isRelevantToJob: zod_1.z.boolean().optional(),
        relevanceScore: zod_1.z.coerce.number().min(0).max(1).optional(),
    })).default([]),
    certifications: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string().min(1),
        issuer: zod_1.z.string().optional(),
        year: zod_1.z.coerce.number().optional(),
        isRelevantToJob: zod_1.z.boolean().optional(),
        relevanceScore: zod_1.z.coerce.number().min(0).max(1).optional(),
    })).default([]),
    totalExperienceYears: zod_1.z.coerce.number().optional(),
});
function hasCachedStructuredProfile(profile) {
    if (profile.structuredSource !== "ai")
        return false;
    return (Array.isArray(profile.skills) && profile.skills.length > 0 ||
        Array.isArray(profile.experiences) && profile.experiences.length > 0 ||
        Array.isArray(profile.education) && profile.education.length > 0 ||
        Array.isArray(profile.projects) && profile.projects.length > 0 ||
        Array.isArray(profile.certifications) && profile.certifications.length > 0);
}
function mapCandidateProfileToParsed(profile) {
    return {
        skills: (profile.skills ?? []).map((s) => {
            const mapped = { name: s.name };
            if (s.level)
                mapped.level = s.level;
            if (typeof s.years === "number")
                mapped.years = s.years;
            return mapped;
        }),
        experiences: (profile.experiences ?? []).map((e) => {
            const mapped = {
                role: e.role,
                company: e.company,
            };
            if (e.startDate)
                mapped.startDate = new Date(e.startDate).toISOString();
            if (e.endDate)
                mapped.endDate = new Date(e.endDate).toISOString();
            if (e.endDate === null)
                mapped.endDate = null;
            if (e.description)
                mapped.description = e.description;
            return mapped;
        }),
        education: (profile.education ?? []).map((e) => {
            const mapped = { institution: e.institution };
            if (e.degree)
                mapped.degree = e.degree;
            if (e.fieldOfStudy)
                mapped.fieldOfStudy = e.fieldOfStudy;
            if (typeof e.startYear === "number")
                mapped.startYear = e.startYear;
            if (typeof e.endYear === "number")
                mapped.endYear = e.endYear;
            return mapped;
        }),
        projects: (profile.projects ?? []).map((p) => {
            const mapped = { name: p.name };
            if (p.description)
                mapped.description = p.description;
            if (p.technologies)
                mapped.technologies = p.technologies;
            if (p.link)
                mapped.link = p.link;
            return mapped;
        }),
        certifications: (profile.certifications ?? []).map((c) => {
            const mapped = { name: c.name };
            if (c.issuer)
                mapped.issuer = c.issuer;
            if (typeof c.year === "number")
                mapped.year = c.year;
            return mapped;
        }),
    };
}
// 2) Parsing Agent: extract skills, experiences, education, projects, certifications from text
async function parsingNode(state) {
    const job = state.job;
    const profile = state.candidateProfile;
    if (!job || !profile) {
        throw new Error("Missing job or candidateProfile in parsingNode");
    }
    if (hasCachedStructuredProfile(profile)) {
        return {
            parsedProfile: mapCandidateProfileToParsed(profile),
            parseWarnings: [],
        };
    }
    const resumeText = profile.resumeText;
    const coverLetterText = profile.coverLetterText ?? "";
    const prompt = `You are a resume parsing engine for an AI recruitment system.\n\nJob title: ${job.title}\nJob description: ${job.description}\nJob required skills: ${(job.requiredSkills ?? []).join(", ")}\n\nCandidate resume text:\n${resumeText}\n\nCandidate cover letter (optional):\n${coverLetterText}\n\nExtract the following as JSON only, with these keys: skills, experiences, education, projects, certifications.\nEach skill should have: name, level (if present), years (if clear).\nEach experience: role, company, startDate, endDate, description.\nEach education: institution, degree, fieldOfStudy, startYear, endYear.\nEach project: name, description, technologies (array of strings), link (if any).\nEach certification: name, issuer, year.\nReturn ONLY valid JSON with that structure, no extra text.`;
    let raw = "";
    try {
        raw = await (0, llmProvider_1.invokeWithFallback)(prompt, { retries: 3 });
    }
    catch {
        // Keep screening moving even if both providers fail.
        const fallback = (0, profileExtraction_service_1.extractStructuredProfile)(resumeText, coverLetterText);
        return {
            parsedProfile: {
                skills: fallback.skills.map((s) => {
                    const mapped = { name: s.name };
                    if (s.level)
                        mapped.level = s.level;
                    if (typeof s.years === "number")
                        mapped.years = s.years;
                    return mapped;
                }),
                experiences: fallback.experiences.map((e) => {
                    const mapped = {
                        role: e.role,
                        company: e.company,
                    };
                    if (e.startDate)
                        mapped.startDate = new Date(e.startDate).toISOString();
                    if (e.endDate)
                        mapped.endDate = new Date(e.endDate).toISOString();
                    if (e.description)
                        mapped.description = e.description;
                    return mapped;
                }),
                education: fallback.education.map((e) => {
                    const mapped = { institution: e.institution };
                    if (e.degree)
                        mapped.degree = e.degree;
                    if (e.fieldOfStudy)
                        mapped.fieldOfStudy = e.fieldOfStudy;
                    if (typeof e.startYear === "number")
                        mapped.startYear = e.startYear;
                    if (typeof e.endYear === "number")
                        mapped.endYear = e.endYear;
                    return mapped;
                }),
                projects: fallback.projects.map((p) => {
                    const mapped = { name: p.name };
                    if (p.description)
                        mapped.description = p.description;
                    if (p.technologies)
                        mapped.technologies = p.technologies;
                    if (p.link)
                        mapped.link = p.link;
                    return mapped;
                }),
                certifications: fallback.certifications.map((c) => {
                    const mapped = { name: c.name };
                    if (c.issuer)
                        mapped.issuer = c.issuer;
                    if (typeof c.year === "number")
                        mapped.year = c.year;
                    return mapped;
                }),
            },
            parseWarnings: ["llm_parse_unavailable: used_heuristic_fallback"],
        };
    }
    let parsed;
    const parseWarnings = [];
    try {
        const parsedCandidate = (0, llmProvider_1.parseJsonLoose)(raw);
        const validatedWhole = ParsedProfileSchema.safeParse(parsedCandidate);
        if (validatedWhole.success) {
            parsed = validatedWhole.data;
        }
        else {
            const candidateRecord = parsedCandidate && typeof parsedCandidate === "object"
                ? parsedCandidate
                : null;
            if (!candidateRecord) {
                parseWarnings.push("top_level_invalid_json_shape");
            }
            const validatedSkills = SkillsSchema.safeParse(candidateRecord?.skills);
            const validatedExperiences = ExperiencesSchema.safeParse(candidateRecord?.experiences);
            const validatedEducation = EducationListSchema.safeParse(candidateRecord?.education);
            const validatedProjects = ProjectsSchema.safeParse(candidateRecord?.projects);
            const validatedCerts = CertificationsSchema.safeParse(candidateRecord?.certifications);
            if (!validatedSkills.success)
                parseWarnings.push("skills_validation_failed");
            if (!validatedExperiences.success)
                parseWarnings.push("experiences_validation_failed");
            if (!validatedEducation.success)
                parseWarnings.push("education_validation_failed");
            if (!validatedProjects.success)
                parseWarnings.push("projects_validation_failed");
            if (!validatedCerts.success)
                parseWarnings.push("certifications_validation_failed");
            parsed = {
                skills: validatedSkills.success
                    ? validatedSkills.data.map((s) => {
                        const mapped = { name: s.name };
                        if (s.level)
                            mapped.level = s.level;
                        if (typeof s.years === "number")
                            mapped.years = s.years;
                        return mapped;
                    })
                    : [],
                experiences: validatedExperiences.success
                    ? validatedExperiences.data.map((e) => {
                        const mapped = {
                            role: e.role,
                            company: e.company,
                        };
                        if (e.startDate)
                            mapped.startDate = e.startDate;
                        if (e.endDate !== undefined)
                            mapped.endDate = e.endDate;
                        if (e.description)
                            mapped.description = e.description;
                        return mapped;
                    })
                    : [],
                education: validatedEducation.success
                    ? validatedEducation.data.map((e) => {
                        const mapped = { institution: e.institution };
                        if (e.degree)
                            mapped.degree = e.degree;
                        if (e.fieldOfStudy)
                            mapped.fieldOfStudy = e.fieldOfStudy;
                        if (typeof e.startYear === "number")
                            mapped.startYear = e.startYear;
                        if (typeof e.endYear === "number")
                            mapped.endYear = e.endYear;
                        return mapped;
                    })
                    : [],
                projects: validatedProjects.success
                    ? validatedProjects.data.map((p) => {
                        const mapped = { name: p.name };
                        if (p.description)
                            mapped.description = p.description;
                        if (p.technologies)
                            mapped.technologies = p.technologies;
                        if (p.link)
                            mapped.link = p.link;
                        return mapped;
                    })
                    : [],
                certifications: validatedCerts.success
                    ? validatedCerts.data.map((c) => {
                        const mapped = { name: c.name };
                        if (c.issuer)
                            mapped.issuer = c.issuer;
                        if (typeof c.year === "number")
                            mapped.year = c.year;
                        return mapped;
                    })
                    : [],
            };
            const recoveredCount = parsed.skills.length +
                parsed.experiences.length +
                parsed.education.length +
                parsed.projects.length +
                parsed.certifications.length;
            if (recoveredCount === 0) {
                const fallback = (0, profileExtraction_service_1.extractStructuredProfile)(resumeText, coverLetterText);
                parsed = {
                    skills: fallback.skills.map((s) => {
                        const mapped = { name: s.name };
                        if (s.level)
                            mapped.level = s.level;
                        if (typeof s.years === "number")
                            mapped.years = s.years;
                        return mapped;
                    }),
                    experiences: fallback.experiences.map((e) => {
                        const mapped = {
                            role: e.role,
                            company: e.company,
                        };
                        if (e.startDate)
                            mapped.startDate = new Date(e.startDate).toISOString();
                        if (e.endDate)
                            mapped.endDate = new Date(e.endDate).toISOString();
                        if (e.description)
                            mapped.description = e.description;
                        return mapped;
                    }),
                    education: fallback.education.map((e) => {
                        const mapped = { institution: e.institution };
                        if (e.degree)
                            mapped.degree = e.degree;
                        if (e.fieldOfStudy)
                            mapped.fieldOfStudy = e.fieldOfStudy;
                        if (typeof e.startYear === "number")
                            mapped.startYear = e.startYear;
                        if (typeof e.endYear === "number")
                            mapped.endYear = e.endYear;
                        return mapped;
                    }),
                    projects: fallback.projects.map((p) => {
                        const mapped = { name: p.name };
                        if (p.description)
                            mapped.description = p.description;
                        if (p.technologies)
                            mapped.technologies = p.technologies;
                        if (p.link)
                            mapped.link = p.link;
                        return mapped;
                    }),
                    certifications: fallback.certifications.map((c) => {
                        const mapped = { name: c.name };
                        if (c.issuer)
                            mapped.issuer = c.issuer;
                        if (typeof c.year === "number")
                            mapped.year = c.year;
                        return mapped;
                    }),
                };
                parseWarnings.push("all_sections_failed: used_heuristic_fallback");
            }
        }
    }
    catch {
        parsed = {
            skills: [],
            experiences: [],
            education: [],
            projects: [],
            certifications: [],
        };
        parseWarnings.push("json_parse_failed");
    }
    return {
        parsedProfile: parsed,
        parseWarnings,
    };
}
// 3) Relevance + Structuring Agent: mark which items are relevant to this job and normalize
async function relevanceNode(state) {
    const job = state.job;
    const profile = state.candidateProfile;
    const parsed = state.parsedProfile;
    if (!job || !profile || !parsed) {
        throw new Error("Missing job, candidateProfile, or parsedProfile in relevanceNode");
    }
    const prompt = `You are an AI relevance engine for recruitment.\n\nJob title: ${job.title}\nJob description: ${job.description}\nJob requirements: ${job.requirements ?? ""}\nRequired skills: ${(job.requiredSkills ?? []).join(", ")}\nNice-to-have skills: ${(job.niceToHaveSkills ?? []).join(", ")}\n\nParsed candidate data (JSON):\n${JSON.stringify(parsed)}\n\nYour task: For each skill, experience, education entry, project, and certification, decide how relevant it is to this specific job.\nOutput JSON ONLY with this structure:\n{\n  "skills": [{ "name": string, "level"?: string, "years"?: number, "isRelevantToJob"?: boolean, "relevanceScore"?: number }],\n  "experiences": [{ "role": string, "company": string, "startDate"?: string, "endDate"?: string | null, "description"?: string, "isRelevantToJob"?: boolean, "relevanceScore"?: number }],\n  "education": [{ "institution": string, "degree"?: string, "fieldOfStudy"?: string, "startYear"?: number, "endYear"?: number, "isRelevantToJob"?: boolean, "relevanceScore"?: number }],\n  "projects": [{ "name": string, "description"?: string, "technologies"?: string[], "link"?: string, "isRelevantToJob"?: boolean, "relevanceScore"?: number }],\n  "certifications": [{ "name": string, "issuer"?: string, "year"?: number, "isRelevantToJob"?: boolean, "relevanceScore"?: number }],\n  "totalExperienceYears"?: number\n}\n\nSet relevanceScore between 0 and 1. Focus on how each item supports the job requirements. Return ONLY JSON.`;
    let response;
    try {
        response = await (0, llmProvider_1.invokeWithFallback)(prompt, { retries: 3 });
    }
    catch {
        // Deterministic fallback when model is rate-limited.
        const reqSkills = new Set((job.requiredSkills ?? []).map((s) => s.toLowerCase()));
        const niceSkills = new Set((job.niceToHaveSkills ?? []).map((s) => s.toLowerCase()));
        const normalizedFallback = {
            skills: (parsed.skills ?? []).map((s) => {
                const n = s.name.toLowerCase();
                const relevant = reqSkills.has(n) || niceSkills.has(n);
                return { ...s, isRelevantToJob: relevant, relevanceScore: relevant ? 0.9 : 0.2 };
            }),
            experiences: (parsed.experiences ?? []).map((e) => ({ ...e, isRelevantToJob: true, relevanceScore: 0.7 })),
            education: (parsed.education ?? []).map((e) => ({ ...e, isRelevantToJob: true, relevanceScore: 0.6 })),
            projects: (parsed.projects ?? []).map((p) => ({ ...p, isRelevantToJob: true, relevanceScore: 0.7 })),
            certifications: (parsed.certifications ?? []).map((c) => ({ ...c, isRelevantToJob: true, relevanceScore: 0.6 })),
            totalExperienceYears: profile.totalExperienceYears ?? 0,
        };
        return { normalizedProfile: normalizedFallback };
    }
    const raw = String(response);
    let normalized;
    try {
        const normalizedCandidate = (0, llmProvider_1.parseJsonLoose)(raw);
        const validated = NormalizedProfileSchema.safeParse(normalizedCandidate);
        normalized = validated.success
            ? {
                ...validated.data,
                totalExperienceYears: validated.data.totalExperienceYears ?? profile.totalExperienceYears ?? 0,
            }
            : {
                skills: [],
                experiences: [],
                education: [],
                projects: [],
                certifications: [],
                totalExperienceYears: profile.totalExperienceYears ?? 0,
            };
    }
    catch {
        normalized = {
            skills: [],
            experiences: [],
            education: [],
            projects: [],
            certifications: [],
            totalExperienceYears: profile.totalExperienceYears ?? 0,
        };
    }
    return {
        normalizedProfile: normalized,
    };
}
// 4) Scoring Agent: deterministic scoring using our engine, weighting relevance
async function scoringNode(state) {
    const job = state.job;
    const normalized = state.normalizedProfile;
    if (!job || !normalized) {
        throw new Error("Missing job or normalizedProfile in scoringNode");
    }
    const screeningResult = (0, scoring_service_1.computeScreeningResult)(job, {
        // The deterministic engine consumes semantic evidence + relevance metadata.
        // LLM decides relevance; deterministic decides strength/aggregation.
        fullName: state.candidateProfile?.fullName ?? "",
        firstName: state.candidateProfile?.firstName,
        lastName: state.candidateProfile?.lastName,
        email: state.candidateProfile?.email ?? "",
        headline: state.candidateProfile?.headline,
        bio: state.candidateProfile?.bio,
        location: state.candidateProfile?.location,
        totalExperienceYears: normalized.totalExperienceYears ?? state.candidateProfile?.totalExperienceYears,
        skills: (normalized.skills ?? []).map((s) => ({
            name: s.name,
            level: s.level,
            years: s.years,
            ...(typeof s.isRelevantToJob === "boolean" ? { isRelevantToJob: s.isRelevantToJob } : {}),
            ...(typeof s.relevanceScore === "number" ? { relevanceScore: s.relevanceScore } : {}),
        })),
        experiences: (normalized.experiences ?? []).map((e) => ({
            role: e.role,
            company: e.company,
            startDate: e.startDate ? new Date(e.startDate) : undefined,
            endDate: e.endDate ? new Date(e.endDate) : undefined,
            description: e.description,
            ...(typeof e.isRelevantToJob === "boolean" ? { isRelevantToJob: e.isRelevantToJob } : {}),
            ...(typeof e.relevanceScore === "number" ? { relevanceScore: e.relevanceScore } : {}),
        })),
        education: (normalized.education ?? []).map((edu) => ({
            institution: edu.institution,
            degree: edu.degree,
            fieldOfStudy: edu.fieldOfStudy,
            startYear: edu.startYear,
            endYear: edu.endYear,
            ...(typeof edu.isRelevantToJob === "boolean" ? { isRelevantToJob: edu.isRelevantToJob } : {}),
            ...(typeof edu.relevanceScore === "number" ? { relevanceScore: edu.relevanceScore } : {}),
        })),
        projects: (normalized.projects ?? []).map((p) => ({
            name: p.name,
            description: p.description,
            technologies: p.technologies,
            link: p.link,
            ...(typeof p.isRelevantToJob === "boolean" ? { isRelevantToJob: p.isRelevantToJob } : {}),
            ...(typeof p.relevanceScore === "number" ? { relevanceScore: p.relevanceScore } : {}),
        })),
        certifications: (normalized.certifications ?? []).map((c) => ({
            name: c.name,
            issuer: c.issuer,
            year: c.year,
            ...(typeof c.isRelevantToJob === "boolean" ? { isRelevantToJob: c.isRelevantToJob } : {}),
            ...(typeof c.relevanceScore === "number" ? { relevanceScore: c.relevanceScore } : {}),
        })),
        languages: state.candidateProfile?.languages ?? [],
        availability: state.candidateProfile?.availability,
        socialLinks: state.candidateProfile?.socialLinks,
        resumeText: state.candidateProfile?.resumeText ?? "",
        coverLetterText: state.candidateProfile?.coverLetterText,
        linkedInUrl: state.candidateProfile?.linkedInUrl,
    });
    return {
        screeningResult,
    };
}
// 5) Explanation Agent: LLM turns scores + profile into human-readable explanation
async function explanationNode(state) {
    const job = state.job;
    const normalized = state.normalizedProfile;
    const result = state.screeningResult;
    const explanationRequired = state.explanationRequired;
    if (!job || !normalized || !result) {
        throw new Error("Missing job, normalizedProfile, or screeningResult in explanationNode");
    }
    if (!explanationRequired) {
        return { explanation: "" };
    }
    const prompt = `You are an AI assistant explaining candidate-job fit to a recruiter.\n\nJob title: ${job.title}\nJob description: ${job.description}\nRequired skills: ${(job.requiredSkills ?? []).join(", ")}\nNice-to-have skills: ${(job.niceToHaveSkills ?? []).join(", ")}\n\nScreening scores (0-100):\n- Overall matchScore: ${result.matchScore}\n- Skills score: ${result.skillsScore}\n- Experience score: ${result.experienceScore}\n- Education score: ${result.educationScore}\n- Project score: ${result.projectScore}\n\nStrengths identified:\n${(result.strengths ?? []).join("\n")}\n\nGaps identified:\n${(result.gaps ?? []).join("\n")}\n\nThis score is deterministic and computed from LLM relevance evidence.\nWrite a concise explanation (3-6 sentences) that:\n- Summarizes why the candidate is a strong/medium/weak match.\n- Points to the most influential strengths and gaps.\n- Ends with a recommendation phrase aligned with: ${result.overallRecommendation}.`;
    let response;
    try {
        response = await (0, llmProvider_1.invokeWithFallback)(prompt, { retries: 3 });
    }
    catch {
        const explanationFallback = `Candidate scored ${result.matchScore}% overall with deterministic scoring (skills ${result.skillsScore}, experience ${result.experienceScore}, education ${result.educationScore}, projects ${result.projectScore}). Strengths: ${(result.strengths ?? []).slice(0, 2).join("; ") || "no major strengths identified"}. Gaps: ${(result.gaps ?? []).slice(0, 2).join("; ") || "no major gaps identified"}. Recommendation: ${result.overallRecommendation}.`;
        return { explanation: explanationFallback };
    }
    const explanation = String(response);
    return {
        explanation,
    };
}
// 6) Build and export the full graph
exports.screeningGraph = new langgraph_1.StateGraph(exports.ScreeningStateAnnotation)
    .addNode("parsing", parsingNode)
    .addNode("relevance", relevanceNode)
    .addNode("scoring", scoringNode)
    .addNode("explanationAgent", explanationNode)
    .addEdge("__start__", "parsing")
    .addEdge("parsing", "relevance")
    .addEdge("relevance", "scoring")
    .addEdge("scoring", "explanationAgent")
    .addEdge("explanationAgent", "__end__")
    .compile();
async function generateScreeningExplanation(job, result) {
    const prompt = `You are an AI assistant explaining candidate-job fit to a recruiter.\n\nJob title: ${job.title}\nJob description: ${job.description}\nRequired skills: ${(job.requiredSkills ?? []).join(", ")}\nNice-to-have skills: ${(job.niceToHaveSkills ?? []).join(", ")}\n\nScreening scores (0-100):\n- Overall matchScore: ${result.matchScore}\n- Skills score: ${result.skillsScore}\n- Experience score: ${result.experienceScore}\n- Education score: ${result.educationScore}\n- Project score: ${result.projectScore}\n\nStrengths identified:\n${(result.strengths ?? []).join("\n")}\n\nGaps identified:\n${(result.gaps ?? []).join("\n")}\n\nThis score is deterministic and computed from LLM relevance evidence.\nWrite a concise explanation (3-6 sentences) that:\n- Summarizes why the candidate is a strong/medium/weak match.\n- Points to the most influential strengths and gaps.\n- Ends with a recommendation phrase aligned with: ${result.overallRecommendation}.`;
    try {
        return await (0, llmProvider_1.invokeWithFallback)(prompt, { retries: 3 });
    }
    catch {
        return `Candidate scored ${result.matchScore}% overall with deterministic scoring (skills ${result.skillsScore}, experience ${result.experienceScore}, education ${result.educationScore}, projects ${result.projectScore}). Strengths: ${(result.strengths ?? []).slice(0, 2).join("; ") || "no major strengths identified"}. Gaps: ${(result.gaps ?? []).slice(0, 2).join("; ") || "no major gaps identified"}. Recommendation: ${result.overallRecommendation}.`;
    }
}
//# sourceMappingURL=screeningGraph.js.map