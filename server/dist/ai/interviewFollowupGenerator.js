"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInterviewFollowupQuestion = generateInterviewFollowupQuestion;
const llmProvider_1 = require("./llmProvider");
const zod_1 = require("zod");
const FollowupSchema = zod_1.z.object({
    text: zod_1.z.string().min(1),
    category: zod_1.z
        .enum([
        "communication",
        "problem_understanding",
        "relevance_to_role",
        "motivation_interest",
        "practical_knowledge",
    ])
        .optional(),
});
async function generateInterviewFollowupQuestion(job, languageCode, originalQuestion, candidateAnswer, fallbackCategory = "problem_understanding") {
    const prompt = `You are an AI interviewer generating ONE follow-up question.

Job title: ${job.title}
Job description: ${job.description}
Required skills: ${(job.requiredSkills ?? []).join(", ")}
Nice to have skills: ${(job.niceToHaveSkills ?? []).join(", ")}
Language code: ${languageCode}

Original question: ${originalQuestion}
Candidate answer: ${candidateAnswer}

Generate exactly ONE concise follow-up question (<= 20 words) that digs deeper into evidence, motivation, or job relevance.
Return ONLY valid JSON with this shape:
{
  "text": string,
  "category": "communication" | "problem_understanding" | "relevance_to_role" | "motivation_interest" | "practical_knowledge"
}`;
    try {
        const raw = await (0, llmProvider_1.invokeWithFallback)(prompt, { retries: 3 });
        const candidate = (0, llmProvider_1.parseJsonLoose)(raw);
        const validated = FollowupSchema.safeParse(candidate);
        if (!validated.success) {
            throw new Error("Follow-up schema validation failed");
        }
        const parsed = validated.data;
        if (parsed?.text && parsed.text.trim()) {
            return {
                id: `fq_${Date.now()}`,
                text: parsed.text.trim(),
                category: parsed.category ?? fallbackCategory,
            };
        }
    }
    catch {
        // fallback below
    }
    return {
        id: `fq_${Date.now()}`,
        text: "Can you give one concrete example from your experience that proves this fit?",
        category: fallbackCategory,
    };
}
//# sourceMappingURL=interviewFollowupGenerator.js.map