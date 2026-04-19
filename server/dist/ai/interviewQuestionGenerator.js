"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInterviewQuestions = generateInterviewQuestions;
const llmProvider_1 = require("./llmProvider");
const zod_1 = require("zod");
const QUESTION_GENERATION_TIMEOUT_MS = 12000;
const QuestionSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
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
const QuestionsSchema = zod_1.z.array(QuestionSchema);
function buildFallbackQuestions(maxQuestions) {
    const fallback = [
        {
            id: "q1",
            text: "Can you briefly introduce yourself and your background?",
            category: "communication",
        },
        {
            id: "q2",
            text: "What about this role and company motivates you the most?",
            category: "motivation_interest",
        },
        {
            id: "q3",
            text: "Tell me about a recent project where you used the key skills required for this role.",
            category: "practical_knowledge",
        },
        {
            id: "q4",
            text: "How do you typically approach a new problem you have never seen before?",
            category: "problem_understanding",
        },
        {
            id: "q5",
            text: "Why do you think you are a strong fit for this specific role?",
            category: "relevance_to_role",
        },
    ];
    return fallback.slice(0, maxQuestions);
}
async function generateInterviewQuestions(job, languageCode, maxQuestions = 5, maxDurationMinutes = 10) {
    const prompt = `You are an AI interviewer for a recruitment platform.

Job title: ${job.title}
Company: ${job.companyName}
Job description: ${job.description}
Required skills: ${(job.requiredSkills ?? []).join(", ")}
Nice to have skills: ${(job.niceToHaveSkills ?? []).join(", ")}
Language code: ${languageCode}
Max duration in minutes: ${maxDurationMinutes}

Design ${maxQuestions} concise pre-screen interview questions (each <= 22 words) so the full interview can finish in about ${maxDurationMinutes} minutes.
Target questions directly to the job requirements and practical responsibilities.

For each question, decide which dimension it mainly measures, choosing one of these categories exactly:
- communication
- problem_understanding
- relevance_to_role
- motivation_interest
- practical_knowledge

Return ONLY valid JSON as an array of objects like:
[
  { "id": "q1", "text": "...", "category": "communication" },
  ...
]

Do not include any free text outside the JSON.`;
    let raw = "";
    try {
        raw = await Promise.race([
            (0, llmProvider_1.invokeWithFallback)(prompt, { retries: 2 }),
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error("Interview question generation timeout")), QUESTION_GENERATION_TIMEOUT_MS);
            }),
        ]);
    }
    catch {
        return buildFallbackQuestions(maxQuestions);
    }
    try {
        const parsedCandidate = (0, llmProvider_1.parseJsonLoose)(raw);
        const validated = QuestionsSchema.safeParse(parsedCandidate);
        if (!validated.success) {
            throw new Error("Question schema validation failed");
        }
        const parsed = validated.data;
        const mapped = parsed
            .slice(0, maxQuestions)
            .map((q, idx) => ({
            id: q.id || `q${idx + 1}`,
            text: q.text.trim(),
            category: q.category ?? "communication",
        }));
        if (mapped.length > 0) {
            return mapped;
        }
    }
    catch {
        // fall through to fallback
    }
    return buildFallbackQuestions(maxQuestions);
}
//# sourceMappingURL=interviewQuestionGenerator.js.map