"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreInterview = scoreInterview;
const llmProvider_1 = require("./llmProvider");
const zod_1 = require("zod");
const ScoringSchema = zod_1.z.object({
    communicationClarity: zod_1.z.coerce.number().min(0).max(100),
    problemUnderstanding: zod_1.z.coerce.number().min(0).max(100),
    relevanceToRole: zod_1.z.coerce.number().min(0).max(100),
    motivationInterest: zod_1.z.coerce.number().min(0).max(100),
    practicalKnowledge: zod_1.z.coerce.number().min(0).max(100),
    overall: zod_1.z.coerce.number().min(0).max(100),
    explanation: zod_1.z.string().min(1),
});
function clampScore(value) {
    return Math.max(0, Math.min(100, value));
}
function getTrustWeights(gap) {
    if (gap > 40)
        return { llmWeight: 0.3, detWeight: 0.7, confidence: "low" };
    if (gap > 25)
        return { llmWeight: 0.5, detWeight: 0.5, confidence: "medium" };
    return { llmWeight: 0.7, detWeight: 0.3, confidence: "high" };
}
function scoreDeterministically(job, interview) {
    const transcripts = (interview.answers ?? [])
        .map((a) => String(a.transcript ?? "").trim())
        .filter((t) => t.length > 0);
    const combined = transcripts.join(" ");
    const words = combined.length > 0 ? combined.split(/\s+/).filter(Boolean) : [];
    const wordCount = words.length;
    if (wordCount === 0) {
        return {
            communicationClarity: 15,
            problemUnderstanding: 15,
            relevanceToRole: 15,
            motivationInterest: 15,
            practicalKnowledge: 15,
            overall: 15,
            explanation: "Interview responses were too limited to assess reliably. Ask the candidate to provide fuller answers with concrete examples.",
        };
    }
    const normalizedText = combined.toLowerCase();
    const jobSkills = [...(job.requiredSkills ?? []), ...(job.niceToHaveSkills ?? [])]
        .map((s) => s.toLowerCase().trim())
        .filter(Boolean);
    const matchedSkills = jobSkills.filter((s) => normalizedText.includes(s)).length;
    const skillCoverage = jobSkills.length > 0 ? matchedSkills / jobSkills.length : 0.4;
    const motivationTerms = ["motivat", "interested", "because", "learn", "grow", "passion"];
    const practicalTerms = ["built", "implemented", "designed", "developed", "project", "used", "delivered"];
    const problemTerms = ["problem", "analy", "approach", "debug", "resolve", "improve", "challenge"];
    const containsAny = (terms) => terms.some((t) => normalizedText.includes(t));
    const communicationClarity = Math.max(25, Math.min(92, 30 + Math.round(wordCount * 0.4)));
    const relevanceToRole = Math.max(20, Math.min(95, Math.round(25 + skillCoverage * 70)));
    const practicalKnowledge = Math.max(20, Math.min(95, Math.round(30 + skillCoverage * 45 + (containsAny(practicalTerms) ? 15 : 0))));
    const problemUnderstanding = Math.max(20, Math.min(92, Math.round(30 + skillCoverage * 35 + (containsAny(problemTerms) ? 15 : 0))));
    const motivationInterest = Math.max(20, Math.min(92, Math.round(28 + (containsAny(motivationTerms) ? 22 : 8) + skillCoverage * 25)));
    const overall = Math.round(communicationClarity * 0.2 +
        problemUnderstanding * 0.2 +
        relevanceToRole * 0.25 +
        motivationInterest * 0.15 +
        practicalKnowledge * 0.2);
    return {
        communicationClarity,
        problemUnderstanding,
        relevanceToRole,
        motivationInterest,
        practicalKnowledge,
        overall,
        explanation: "Scores use interview content length, job-skill alignment, and practical evidence in responses. Encourage specific examples for stronger relevance and practical knowledge scores.",
    };
}
async function scoreInterview(job, application, interview) {
    const qaBlocks = interview.answers
        .map((ans, idx) => {
        const qNum = idx + 1;
        const transcript = ans.transcript ?? "";
        return `Q${qNum}: ${ans.questionText}\nA${qNum}: ${transcript}`;
    })
        .join("\n\n");
    const prompt = `You are an AI interviewer assistant.

Your task is to score a candidate's short pre-screen interview on five dimensions between 0 and 100, and provide a short explanation.

Job title: ${job.title}
Company: ${job.companyName}
Job description: ${job.description}
Required skills: ${(job.requiredSkills ?? []).join(", ")}
Nice to have skills: ${(job.niceToHaveSkills ?? []).join(", ")}

Candidate basic info:
- Name: ${application.candidateProfile.fullName}
- Headline: ${application.candidateProfile.headline ?? "(none)"}
- Location: ${application.candidateProfile.location ?? "(unknown)"}

Interview Q&A transcripts:
${qaBlocks}

Score strictly from 0 to 100 for each dimension:
- communicationClarity
- problemUnderstanding
- relevanceToRole
- motivationInterest
- practicalKnowledge
Then compute an overall score (0–100) that roughly averages these but you may weight relevance and practical knowledge slightly more.

Return ONLY valid JSON with this exact shape:
{
  "communicationClarity": number,
  "problemUnderstanding": number,
  "relevanceToRole": number,
  "motivationInterest": number,
  "practicalKnowledge": number,
  "overall": number,
  "explanation": string
}
No extra commentary, no markdown, just JSON.`;
    const raw = await (0, llmProvider_1.invokeWithFallback)(prompt, { retries: 3 });
    let parsed = null;
    try {
        const candidate = (0, llmProvider_1.parseJsonLoose)(raw);
        const validated = ScoringSchema.safeParse(candidate);
        if (validated.success) {
            parsed = validated.data;
        }
    }
    catch {
        parsed = null;
    }
    const deterministic = scoreDeterministically(job, interview);
    const hasLlmScore = Boolean(parsed);
    const llmOverall = hasLlmScore ? Math.round(clampScore(parsed.overall)) : undefined;
    const deterministicOverall = Math.round(clampScore(deterministic.overall));
    const agreementGap = typeof llmOverall === "number"
        ? Math.abs(llmOverall - deterministicOverall)
        : 100;
    const trust = typeof llmOverall === "number"
        ? getTrustWeights(agreementGap)
        : { llmWeight: 0, detWeight: 1, confidence: "low" };
    const blend = (llm, det) => {
        if (typeof llm !== "number")
            return Math.round(clampScore(det));
        return Math.round(clampScore(llm * trust.llmWeight + det * trust.detWeight));
    };
    const scores = {
        communicationClarity: blend(parsed?.communicationClarity, deterministic.communicationClarity),
        problemUnderstanding: blend(parsed?.problemUnderstanding, deterministic.problemUnderstanding),
        relevanceToRole: blend(parsed?.relevanceToRole, deterministic.relevanceToRole),
        motivationInterest: blend(parsed?.motivationInterest, deterministic.motivationInterest),
        practicalKnowledge: blend(parsed?.practicalKnowledge, deterministic.practicalKnowledge),
        overall: blend(parsed?.overall, deterministic.overall),
        deterministicOverall,
        agreementGap,
        confidenceLevel: trust.confidence,
        ...(typeof llmOverall === "number" ? { llmOverall } : {}),
        explanation: typeof parsed?.explanation === "string"
            ? `${parsed.explanation} Hybrid trust: llm=${llmOverall ?? "n/a"}, deterministic=${deterministicOverall}, gap=${agreementGap}, confidence=${trust.confidence}.`
            : `${deterministic.explanation} Hybrid trust: llm unavailable, deterministic-only mode.`,
    };
    const screeningScore = application.screeningResult?.matchScore;
    if (typeof screeningScore === "number") {
        const blended = screeningScore * 0.7 + scores.overall * 0.3;
        scores.overallWithScreening = Math.round(Math.max(0, Math.min(100, blended)));
    }
    return scores;
}
//# sourceMappingURL=interviewScoring.js.map