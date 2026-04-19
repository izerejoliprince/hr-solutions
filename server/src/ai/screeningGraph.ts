import { Annotation, StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import type { ScreeningState, ParsedProfile, NormalizedProfile } from "./screeningTypes";
import type { Job } from "../models/job.model";
import type { CandidateProfile } from "../models/application.model";
import { computeScreeningResult } from "../services/scoring.service";
import { invokeWithFallback, parseJsonLoose } from "./llmProvider";
import { extractStructuredProfile } from "../services/profileExtraction.service";

// 1) Define the LangGraph state using Annotation.Root
export const ScreeningStateAnnotation = Annotation.Root({
  jobId: Annotation<string>(),
  applicationId: Annotation<string>(),
  job: Annotation<Job | null>(),
  candidateProfile: Annotation<CandidateProfile | null>(),
  parsedProfile: Annotation<ParsedProfile | null>(),
  parseWarnings: Annotation<string[] | null>(),
  normalizedProfile: Annotation<NormalizedProfile | null>(),
  screeningResult: Annotation<ReturnType<typeof computeScreeningResult> | null>(),
  explanation: Annotation<string | null>(),
  explanationRequired: Annotation<boolean>(),
});

export type ScreeningGraphState = typeof ScreeningStateAnnotation.State;

const SkillSchema = z.object({
  name: z.string().min(1),
  level: z.string().optional(),
  years: z.coerce.number().optional(),
});

const ExperienceSchema = z.object({
  role: z.string().min(1),
  company: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().nullable().optional(),
  description: z.string().optional(),
});

const EducationSchema = z.object({
  institution: z.string().min(1),
  degree: z.string().optional(),
  fieldOfStudy: z.string().optional(),
  startYear: z.coerce.number().optional(),
  endYear: z.coerce.number().optional(),
});

const ProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  technologies: z.array(z.string()).optional(),
  link: z.string().optional(),
});

const CertificationSchema = z.object({
  name: z.string().min(1),
  issuer: z.string().optional(),
  year: z.coerce.number().optional(),
});

const SkillsSchema = z.array(SkillSchema);
const ExperiencesSchema = z.array(ExperienceSchema);
const EducationListSchema = z.array(EducationSchema);
const ProjectsSchema = z.array(ProjectSchema);
const CertificationsSchema = z.array(CertificationSchema);

const ParsedProfileSchema = z.object({
  skills: SkillsSchema.default([]),
  experiences: ExperiencesSchema.default([]),
  education: EducationListSchema.default([]),
  projects: ProjectsSchema.default([]),
  certifications: CertificationsSchema.default([]),
});

const NormalizedProfileSchema = z.object({
  skills: z.array(z.object({
    name: z.string().min(1),
    level: z.string().optional(),
    years: z.coerce.number().optional(),
    isRelevantToJob: z.boolean().optional(),
    relevanceScore: z.coerce.number().min(0).max(1).optional(),
  })).default([]),
  experiences: z.array(z.object({
    role: z.string().min(1),
    company: z.string().min(1),
    startDate: z.string().optional(),
    endDate: z.string().nullable().optional(),
    description: z.string().optional(),
    isRelevantToJob: z.boolean().optional(),
    relevanceScore: z.coerce.number().min(0).max(1).optional(),
  })).default([]),
  education: z.array(z.object({
    institution: z.string().min(1),
    degree: z.string().optional(),
    fieldOfStudy: z.string().optional(),
    startYear: z.coerce.number().optional(),
    endYear: z.coerce.number().optional(),
    isRelevantToJob: z.boolean().optional(),
    relevanceScore: z.coerce.number().min(0).max(1).optional(),
  })).default([]),
  projects: z.array(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    technologies: z.array(z.string()).optional(),
    link: z.string().optional(),
    isRelevantToJob: z.boolean().optional(),
    relevanceScore: z.coerce.number().min(0).max(1).optional(),
  })).default([]),
  certifications: z.array(z.object({
    name: z.string().min(1),
    issuer: z.string().optional(),
    year: z.coerce.number().optional(),
    isRelevantToJob: z.boolean().optional(),
    relevanceScore: z.coerce.number().min(0).max(1).optional(),
  })).default([]),
  totalExperienceYears: z.coerce.number().optional(),
});

function hasCachedStructuredProfile(profile: CandidateProfile): boolean {
  if (profile.structuredSource !== "ai") return false;

  return (
    Array.isArray(profile.skills) && profile.skills.length > 0 ||
    Array.isArray(profile.experiences) && profile.experiences.length > 0 ||
    Array.isArray(profile.education) && profile.education.length > 0 ||
    Array.isArray(profile.projects) && profile.projects.length > 0 ||
    Array.isArray(profile.certifications) && profile.certifications.length > 0
  );
}

function mapCandidateProfileToParsed(profile: CandidateProfile): ParsedProfile {
  return {
    skills: (profile.skills ?? []).map((s) => {
      const mapped: ParsedProfile["skills"][number] = { name: s.name };
      if (s.level) mapped.level = s.level;
      if (typeof s.years === "number") mapped.years = s.years;
      return mapped;
    }),
    experiences: (profile.experiences ?? []).map((e) => {
      const mapped: ParsedProfile["experiences"][number] = {
        role: e.role,
        company: e.company,
      };
      if (e.startDate) mapped.startDate = new Date(e.startDate).toISOString();
      if (e.endDate) mapped.endDate = new Date(e.endDate).toISOString();
      if (e.endDate === null) mapped.endDate = null;
      if (e.description) mapped.description = e.description;
      return mapped;
    }),
    education: (profile.education ?? []).map((e) => {
      const mapped: ParsedProfile["education"][number] = { institution: e.institution };
      if (e.degree) mapped.degree = e.degree;
      if (e.fieldOfStudy) mapped.fieldOfStudy = e.fieldOfStudy;
      if (typeof e.startYear === "number") mapped.startYear = e.startYear;
      if (typeof e.endYear === "number") mapped.endYear = e.endYear;
      return mapped;
    }),
    projects: (profile.projects ?? []).map((p) => {
      const mapped: ParsedProfile["projects"][number] = { name: p.name };
      if (p.description) mapped.description = p.description;
      if (p.technologies) mapped.technologies = p.technologies;
      if (p.link) mapped.link = p.link;
      return mapped;
    }),
    certifications: (profile.certifications ?? []).map((c) => {
      const mapped: ParsedProfile["certifications"][number] = { name: c.name };
      if (c.issuer) mapped.issuer = c.issuer;
      if (typeof c.year === "number") mapped.year = c.year;
      return mapped;
    }),
  };
}

// 2) Parsing Agent: extract skills, experiences, education, projects, certifications from text
async function parsingNode(state: ScreeningGraphState) {
  const job = state.job;
  const profile = state.candidateProfile;

  if (!job || !profile) {
    throw new Error("Missing job or candidateProfile in parsingNode");
  }

  if (hasCachedStructuredProfile(profile)) {
    return {
      parsedProfile: mapCandidateProfileToParsed(profile),
      parseWarnings: [],
    } satisfies Partial<ScreeningGraphState>;
  }

  const resumeText = profile.resumeText;
  const coverLetterText = profile.coverLetterText ?? "";

  const prompt = `You are a resume parsing engine for an AI recruitment system.\n\nJob title: ${job.title}\nJob description: ${job.description}\nJob required skills: ${(job.requiredSkills ?? []).join(", ")}\n\nCandidate resume text:\n${resumeText}\n\nCandidate cover letter (optional):\n${coverLetterText}\n\nExtract the following as JSON only, with these keys: skills, experiences, education, projects, certifications.\nEach skill should have: name, level (if present), years (if clear).\nEach experience: role, company, startDate, endDate, description.\nEach education: institution, degree, fieldOfStudy, startYear, endYear.\nEach project: name, description, technologies (array of strings), link (if any).\nEach certification: name, issuer, year.\nReturn ONLY valid JSON with that structure, no extra text.`;

  let raw = "";
  try {
    raw = await invokeWithFallback(prompt, { retries: 3 });
  } catch {
    // Keep screening moving even if both providers fail.
    const fallback = extractStructuredProfile(resumeText, coverLetterText);
    return {
      parsedProfile: {
        skills: fallback.skills.map((s) => {
          const mapped: ParsedProfile["skills"][number] = { name: s.name };
          if (s.level) mapped.level = s.level;
          if (typeof s.years === "number") mapped.years = s.years;
          return mapped;
        }),
        experiences: fallback.experiences.map((e) => {
          const mapped: ParsedProfile["experiences"][number] = {
            role: e.role,
            company: e.company,
          };
          if (e.startDate) mapped.startDate = new Date(e.startDate).toISOString();
          if (e.endDate) mapped.endDate = new Date(e.endDate).toISOString();
          if (e.description) mapped.description = e.description;
          return mapped;
        }),
        education: fallback.education.map((e) => {
          const mapped: ParsedProfile["education"][number] = { institution: e.institution };
          if (e.degree) mapped.degree = e.degree;
          if (e.fieldOfStudy) mapped.fieldOfStudy = e.fieldOfStudy;
          if (typeof e.startYear === "number") mapped.startYear = e.startYear;
          if (typeof e.endYear === "number") mapped.endYear = e.endYear;
          return mapped;
        }),
        projects: fallback.projects.map((p) => {
          const mapped: ParsedProfile["projects"][number] = { name: p.name };
          if (p.description) mapped.description = p.description;
          if (p.technologies) mapped.technologies = p.technologies;
          if (p.link) mapped.link = p.link;
          return mapped;
        }),
        certifications: fallback.certifications.map((c) => {
          const mapped: ParsedProfile["certifications"][number] = { name: c.name };
          if (c.issuer) mapped.issuer = c.issuer;
          if (typeof c.year === "number") mapped.year = c.year;
          return mapped;
        }),
      },
      parseWarnings: ["llm_parse_unavailable: used_heuristic_fallback"],
    } satisfies Partial<ScreeningGraphState>;
  }

  let parsed: ParsedProfile;
  const parseWarnings: string[] = [];
  try {
    const parsedCandidate = parseJsonLoose<unknown>(raw);
    const validatedWhole = ParsedProfileSchema.safeParse(parsedCandidate);
    if (validatedWhole.success) {
      parsed = validatedWhole.data as ParsedProfile;
    } else {
      const candidateRecord =
        parsedCandidate && typeof parsedCandidate === "object"
          ? (parsedCandidate as Record<string, unknown>)
          : null;

      if (!candidateRecord) {
        parseWarnings.push("top_level_invalid_json_shape");
      }

      const validatedSkills = SkillsSchema.safeParse(candidateRecord?.skills);
      const validatedExperiences = ExperiencesSchema.safeParse(candidateRecord?.experiences);
      const validatedEducation = EducationListSchema.safeParse(candidateRecord?.education);
      const validatedProjects = ProjectsSchema.safeParse(candidateRecord?.projects);
      const validatedCerts = CertificationsSchema.safeParse(candidateRecord?.certifications);

      if (!validatedSkills.success) parseWarnings.push("skills_validation_failed");
      if (!validatedExperiences.success) parseWarnings.push("experiences_validation_failed");
      if (!validatedEducation.success) parseWarnings.push("education_validation_failed");
      if (!validatedProjects.success) parseWarnings.push("projects_validation_failed");
      if (!validatedCerts.success) parseWarnings.push("certifications_validation_failed");

      parsed = {
        skills: validatedSkills.success
          ? validatedSkills.data.map((s) => {
              const mapped: ParsedProfile["skills"][number] = { name: s.name };
              if (s.level) mapped.level = s.level;
              if (typeof s.years === "number") mapped.years = s.years;
              return mapped;
            })
          : [],
        experiences: validatedExperiences.success
          ? validatedExperiences.data.map((e) => {
              const mapped: ParsedProfile["experiences"][number] = {
                role: e.role,
                company: e.company,
              };
              if (e.startDate) mapped.startDate = e.startDate;
              if (e.endDate !== undefined) mapped.endDate = e.endDate;
              if (e.description) mapped.description = e.description;
              return mapped;
            })
          : [],
        education: validatedEducation.success
          ? validatedEducation.data.map((e) => {
              const mapped: ParsedProfile["education"][number] = { institution: e.institution };
              if (e.degree) mapped.degree = e.degree;
              if (e.fieldOfStudy) mapped.fieldOfStudy = e.fieldOfStudy;
              if (typeof e.startYear === "number") mapped.startYear = e.startYear;
              if (typeof e.endYear === "number") mapped.endYear = e.endYear;
              return mapped;
            })
          : [],
        projects: validatedProjects.success
          ? validatedProjects.data.map((p) => {
              const mapped: ParsedProfile["projects"][number] = { name: p.name };
              if (p.description) mapped.description = p.description;
              if (p.technologies) mapped.technologies = p.technologies;
              if (p.link) mapped.link = p.link;
              return mapped;
            })
          : [],
        certifications: validatedCerts.success
          ? validatedCerts.data.map((c) => {
              const mapped: ParsedProfile["certifications"][number] = { name: c.name };
              if (c.issuer) mapped.issuer = c.issuer;
              if (typeof c.year === "number") mapped.year = c.year;
              return mapped;
            })
          : [],
      };

      const recoveredCount =
        parsed.skills.length +
        parsed.experiences.length +
        parsed.education.length +
        parsed.projects.length +
        parsed.certifications.length;

      if (recoveredCount === 0) {
        const fallback = extractStructuredProfile(resumeText, coverLetterText);
        parsed = {
          skills: fallback.skills.map((s) => {
            const mapped: ParsedProfile["skills"][number] = { name: s.name };
            if (s.level) mapped.level = s.level;
            if (typeof s.years === "number") mapped.years = s.years;
            return mapped;
          }),
          experiences: fallback.experiences.map((e) => {
            const mapped: ParsedProfile["experiences"][number] = {
              role: e.role,
              company: e.company,
            };
            if (e.startDate) mapped.startDate = new Date(e.startDate).toISOString();
            if (e.endDate) mapped.endDate = new Date(e.endDate).toISOString();
            if (e.description) mapped.description = e.description;
            return mapped;
          }),
          education: fallback.education.map((e) => {
            const mapped: ParsedProfile["education"][number] = { institution: e.institution };
            if (e.degree) mapped.degree = e.degree;
            if (e.fieldOfStudy) mapped.fieldOfStudy = e.fieldOfStudy;
            if (typeof e.startYear === "number") mapped.startYear = e.startYear;
            if (typeof e.endYear === "number") mapped.endYear = e.endYear;
            return mapped;
          }),
          projects: fallback.projects.map((p) => {
            const mapped: ParsedProfile["projects"][number] = { name: p.name };
            if (p.description) mapped.description = p.description;
            if (p.technologies) mapped.technologies = p.technologies;
            if (p.link) mapped.link = p.link;
            return mapped;
          }),
          certifications: fallback.certifications.map((c) => {
            const mapped: ParsedProfile["certifications"][number] = { name: c.name };
            if (c.issuer) mapped.issuer = c.issuer;
            if (typeof c.year === "number") mapped.year = c.year;
            return mapped;
          }),
        };
        parseWarnings.push("all_sections_failed: used_heuristic_fallback");
      }
    }
  } catch {
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
  } satisfies Partial<ScreeningGraphState>;
}

// 3) Relevance + Structuring Agent: mark which items are relevant to this job and normalize
async function relevanceNode(state: ScreeningGraphState) {
  const job = state.job;
  const profile = state.candidateProfile;
  const parsed = state.parsedProfile;

  if (!job || !profile || !parsed) {
    throw new Error("Missing job, candidateProfile, or parsedProfile in relevanceNode");
  }

  const prompt = `You are an AI relevance engine for recruitment.\n\nJob title: ${job.title}\nJob description: ${job.description}\nJob requirements: ${job.requirements ?? ""}\nRequired skills: ${(job.requiredSkills ?? []).join(", ")}\nNice-to-have skills: ${(job.niceToHaveSkills ?? []).join(", ")}\n\nParsed candidate data (JSON):\n${JSON.stringify(parsed)}\n\nYour task: For each skill, experience, education entry, project, and certification, decide how relevant it is to this specific job.\nOutput JSON ONLY with this structure:\n{\n  "skills": [{ "name": string, "level"?: string, "years"?: number, "isRelevantToJob"?: boolean, "relevanceScore"?: number }],\n  "experiences": [{ "role": string, "company": string, "startDate"?: string, "endDate"?: string | null, "description"?: string, "isRelevantToJob"?: boolean, "relevanceScore"?: number }],\n  "education": [{ "institution": string, "degree"?: string, "fieldOfStudy"?: string, "startYear"?: number, "endYear"?: number, "isRelevantToJob"?: boolean, "relevanceScore"?: number }],\n  "projects": [{ "name": string, "description"?: string, "technologies"?: string[], "link"?: string, "isRelevantToJob"?: boolean, "relevanceScore"?: number }],\n  "certifications": [{ "name": string, "issuer"?: string, "year"?: number, "isRelevantToJob"?: boolean, "relevanceScore"?: number }],\n  "totalExperienceYears"?: number\n}\n\nSet relevanceScore between 0 and 1. Focus on how each item supports the job requirements. Return ONLY JSON.`;

  let response: any;
  try {
    response = await invokeWithFallback(prompt, { retries: 3 });
  } catch {
    // Deterministic fallback when model is rate-limited.
    const reqSkills = new Set((job.requiredSkills ?? []).map((s) => s.toLowerCase()));
    const niceSkills = new Set((job.niceToHaveSkills ?? []).map((s) => s.toLowerCase()));
    const normalizedFallback: NormalizedProfile = {
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

    return { normalizedProfile: normalizedFallback } satisfies Partial<ScreeningGraphState>;
  }

  const raw = String(response);

  let normalized: NormalizedProfile;
  try {
    const normalizedCandidate = parseJsonLoose<unknown>(raw);
    const validated = NormalizedProfileSchema.safeParse(normalizedCandidate);
    normalized = validated.success
      ? ({
          ...validated.data,
          totalExperienceYears:
            validated.data.totalExperienceYears ?? profile.totalExperienceYears ?? 0,
        } as NormalizedProfile)
      : {
          skills: [],
          experiences: [],
          education: [],
          projects: [],
          certifications: [],
          totalExperienceYears: profile.totalExperienceYears ?? 0,
        };
  } catch {
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
  } satisfies Partial<ScreeningGraphState>;
}

// 4) Scoring Agent: deterministic scoring using our engine, weighting relevance
async function scoringNode(state: ScreeningGraphState) {
  const job = state.job;
  const normalized = state.normalizedProfile;

  if (!job || !normalized) {
    throw new Error("Missing job or normalizedProfile in scoringNode");
  }

  const screeningResult = computeScreeningResult(job, {
    // The deterministic engine consumes semantic evidence + relevance metadata.
    // LLM decides relevance; deterministic decides strength/aggregation.
    fullName: state.candidateProfile?.fullName ?? "",
    firstName: state.candidateProfile?.firstName,
    lastName: state.candidateProfile?.lastName,
    email: state.candidateProfile?.email ?? "",
    headline: state.candidateProfile?.headline,
    bio: state.candidateProfile?.bio,
    location: state.candidateProfile?.location,
    totalExperienceYears:
      normalized.totalExperienceYears ?? state.candidateProfile?.totalExperienceYears,
    skills: (normalized.skills ?? []).map((s) => ({
      name: s.name,
      level: s.level as any,
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
  } as CandidateProfile);

  return {
    screeningResult,
  } satisfies Partial<ScreeningGraphState>;
}

// 5) Explanation Agent: LLM turns scores + profile into human-readable explanation
async function explanationNode(state: ScreeningGraphState) {
  const job = state.job;
  const normalized = state.normalizedProfile;
  const result = state.screeningResult;
  const explanationRequired = state.explanationRequired;

  if (!job || !normalized || !result) {
    throw new Error("Missing job, normalizedProfile, or screeningResult in explanationNode");
  }

  if (!explanationRequired) {
    return { explanation: "" } satisfies Partial<ScreeningGraphState>;
  }

  const prompt = `You are an AI assistant explaining candidate-job fit to a recruiter.\n\nJob title: ${job.title}\nJob description: ${job.description}\nRequired skills: ${(job.requiredSkills ?? []).join(", ")}\nNice-to-have skills: ${(job.niceToHaveSkills ?? []).join(", ")}\n\nScreening scores (0-100):\n- Overall matchScore: ${result.matchScore}\n- Skills score: ${result.skillsScore}\n- Experience score: ${result.experienceScore}\n- Education score: ${result.educationScore}\n- Project score: ${result.projectScore}\n\nStrengths identified:\n${(result.strengths ?? []).join("\n")}\n\nGaps identified:\n${(result.gaps ?? []).join("\n")}\n\nThis score is deterministic and computed from LLM relevance evidence.\nWrite a concise explanation (3-6 sentences) that:\n- Summarizes why the candidate is a strong/medium/weak match.\n- Points to the most influential strengths and gaps.\n- Ends with a recommendation phrase aligned with: ${result.overallRecommendation}.`;

  let response: string;
  try {
    response = await invokeWithFallback(prompt, { retries: 3 });
  } catch {
    const explanationFallback = `Candidate scored ${result.matchScore}% overall with deterministic scoring (skills ${result.skillsScore}, experience ${result.experienceScore}, education ${result.educationScore}, projects ${result.projectScore}). Strengths: ${(result.strengths ?? []).slice(0, 2).join("; ") || "no major strengths identified"}. Gaps: ${(result.gaps ?? []).slice(0, 2).join("; ") || "no major gaps identified"}. Recommendation: ${result.overallRecommendation}.`;
    return { explanation: explanationFallback } satisfies Partial<ScreeningGraphState>;
  }

  const explanation = String(response);

  return {
    explanation,
  } satisfies Partial<ScreeningGraphState>;
}

// 6) Build and export the full graph
export const screeningGraph = new StateGraph(ScreeningStateAnnotation)
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

export async function generateScreeningExplanation(
  job: Job,
  result: ReturnType<typeof computeScreeningResult>,
): Promise<string> {
  const prompt = `You are an AI assistant explaining candidate-job fit to a recruiter.\n\nJob title: ${job.title}\nJob description: ${job.description}\nRequired skills: ${(job.requiredSkills ?? []).join(", ")}\nNice-to-have skills: ${(job.niceToHaveSkills ?? []).join(", ")}\n\nScreening scores (0-100):\n- Overall matchScore: ${result.matchScore}\n- Skills score: ${result.skillsScore}\n- Experience score: ${result.experienceScore}\n- Education score: ${result.educationScore}\n- Project score: ${result.projectScore}\n\nStrengths identified:\n${(result.strengths ?? []).join("\n")}\n\nGaps identified:\n${(result.gaps ?? []).join("\n")}\n\nThis score is deterministic and computed from LLM relevance evidence.\nWrite a concise explanation (3-6 sentences) that:\n- Summarizes why the candidate is a strong/medium/weak match.\n- Points to the most influential strengths and gaps.\n- Ends with a recommendation phrase aligned with: ${result.overallRecommendation}.`;

  try {
    return await invokeWithFallback(prompt, { retries: 3 });
  } catch {
    return `Candidate scored ${result.matchScore}% overall with deterministic scoring (skills ${result.skillsScore}, experience ${result.experienceScore}, education ${result.educationScore}, projects ${result.projectScore}). Strengths: ${(result.strengths ?? []).slice(0, 2).join("; ") || "no major strengths identified"}. Gaps: ${(result.gaps ?? []).slice(0, 2).join("; ") || "no major gaps identified"}. Recommendation: ${result.overallRecommendation}.`;
  }
}
