"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractStructuredProfile = extractStructuredProfile;
function uniq(arr, key) {
    const seen = new Set();
    const out = [];
    for (const item of arr) {
        const k = key(item);
        if (!k || seen.has(k))
            continue;
        seen.add(k);
        out.push(item);
    }
    return out;
}
const SKILL_DICTIONARY = [
    "python", "sql", "excel", "power bi", "tableau", "pandas", "numpy", "scikit-learn",
    "xgboost", "streamlit", "flask", "django", "fastapi", "react", "next.js", "typescript",
    "node.js", "express", "git", "github", "machine learning", "data analysis", "data cleaning",
    "feature engineering", "eda", "kpi tracking", "financial reporting", "api integration",
    "matplotlib", "plotly", "chart.js", "business analysis", "requirements gathering",
];
function extractStructuredProfile(resumeText, coverLetterText, context) {
    const text = `${resumeText}\n${coverLetterText || ""}\n${context?.headline || ""}\n${context?.bio || ""}`.toLowerCase();
    const skills = SKILL_DICTIONARY
        .filter((skill) => text.includes(skill))
        .map((name) => ({ name }));
    const education = [];
    if (/bachelor|b\.sc|master|phd|degree|college|university/.test(text)) {
        education.push({ institution: "From resume", degree: "Detected from resume" });
    }
    const projects = [];
    if (/project|dashboard|prediction|rag|assistant|hackathon/.test(text)) {
        projects.push({ name: "Detected project work", description: "Parsed from resume text" });
    }
    const experiences = [];
    if (/intern|analyst|developer|leader|vice president|experience/.test(text)) {
        experiences.push({ role: "Detected professional experience", company: "From resume" });
    }
    const certifications = [];
    if (/certificate|certification|aws certified|google certified|microsoft certified/.test(text)) {
        certifications.push({ name: "Detected certification", issuer: "From resume" });
    }
    return {
        skills: uniq(skills, (s) => s.name.toLowerCase()),
        experiences,
        education,
        projects,
        certifications,
    };
}
//# sourceMappingURL=profileExtraction.service.js.map