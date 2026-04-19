"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeScreeningResult = computeScreeningResult;
function normalizeSkill(name) {
    return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9+.#]+/g, " ")
        .replace(/\s+/g, " ");
}
function tokenizeSkill(text) {
    const stop = new Set([
        "and",
        "or",
        "with",
        "using",
        "for",
        "to",
        "of",
        "in",
        "on",
        "the",
        "a",
        "an",
        "skills",
        "skill",
        "experience",
        "knowledge",
        "ability",
    ]);
    return normalizeSkill(text)
        .split(" ")
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && !stop.has(t));
}
function splitRequirementPhrases(skills) {
    return skills
        .flatMap((s) => s.split(/[;\n|]+/g))
        .flatMap((chunk) => {
        const trimmed = chunk.trim();
        if (!trimmed.includes(","))
            return [trimmed];
        const commaParts = trimmed
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean);
        // Split comma-separated requirements only when they look like a compact skills list.
        const looksLikeCompactList = commaParts.length > 1 && commaParts.every((p) => tokenizeSkill(p).length <= 4);
        return looksLikeCompactList ? commaParts : [trimmed];
    })
        .map((s) => normalizeSkill(s))
        .filter(Boolean);
}
function requirementMatchesEvidence(requirement, evidence) {
    const req = normalizeSkill(requirement);
    if (!req)
        return false;
    const reqTokens = tokenizeSkill(req);
    return evidence.some((ev) => {
        const candidate = normalizeSkill(ev);
        if (!candidate)
            return false;
        if (candidate === req || candidate.includes(req) || req.includes(candidate)) {
            return true;
        }
        const candTokens = tokenizeSkill(candidate);
        if (reqTokens.length === 0 || candTokens.length === 0)
            return false;
        const overlap = reqTokens.filter((t) => candTokens.includes(t));
        if (reqTokens.length === 1) {
            return overlap.length === 1;
        }
        const overlapRatio = overlap.length / reqTokens.length;
        return overlap.length >= 2 || overlapRatio >= 0.6;
    });
}
function clampScore(value) {
    return Math.max(0, Math.min(100, value));
}
function jobRequiresProjectEvidence(job) {
    const text = [
        job.title ?? "",
        job.description ?? "",
        job.requirements ?? "",
        ...(job.requiredSkills ?? []),
        ...(job.niceToHaveSkills ?? []),
    ]
        .join(" ")
        .toLowerCase();
    return [
        "project",
        "portfolio",
        "github",
        "case study",
        "capstone",
        "research",
        "publication",
    ].some((k) => text.includes(k));
}
function getComponentWeights(job) {
    const requiresProjects = jobRequiresProjectEvidence(job);
    const base = {
        skillsWeight: 0.6,
        expWeight: job.minExperienceYears ? 0.2 : 0,
        eduWeight: 0.1,
        projWeight: requiresProjects ? 0.1 : 0,
    };
    const sum = base.skillsWeight + base.expWeight + base.eduWeight + base.projWeight;
    return {
        skillsWeight: base.skillsWeight / sum,
        expWeight: base.expWeight / sum,
        eduWeight: base.eduWeight / sum,
        projWeight: base.projWeight / sum,
    };
}
function relevanceWeight(item) {
    if (typeof item.relevanceScore === "number" && Number.isFinite(item.relevanceScore)) {
        return Math.max(0, Math.min(1, item.relevanceScore));
    }
    if (item.isRelevantToJob === true)
        return 1;
    if (item.isRelevantToJob === false)
        return 0;
    return 0.7;
}
function computeSkillsScore(job, profile) {
    const requiredSkills = splitRequirementPhrases(job.requiredSkills ?? []);
    const niceSkills = splitRequirementPhrases(job.niceToHaveSkills ?? []);
    const relevantSkillEvidence = (profile.skills ?? [])
        .filter((s) => relevanceWeight(s) >= 0.3)
        .map((s) => normalizeSkill(s.name))
        .filter(Boolean);
    const projectTechEvidence = (profile.projects ?? [])
        .filter((p) => relevanceWeight(p) >= 0.3)
        .flatMap((p) => (p.technologies ?? []).map((t) => normalizeSkill(t)))
        .filter(Boolean);
    const certificationEvidence = (profile.certifications ?? [])
        .filter((c) => relevanceWeight(c) >= 0.3)
        .map((c) => normalizeSkill(c.name))
        .filter(Boolean);
    const candidateEvidence = new Set([
        ...relevantSkillEvidence,
        ...projectTechEvidence,
        ...certificationEvidence,
    ]);
    const candidateEvidenceList = [...candidateEvidence].filter(Boolean);
    const matchedRequired = [];
    const missingRequired = [];
    for (const skill of requiredSkills) {
        if (requirementMatchesEvidence(skill, candidateEvidenceList))
            matchedRequired.push(skill);
        else
            missingRequired.push(skill);
    }
    const matchedNice = [];
    for (const skill of niceSkills) {
        if (requirementMatchesEvidence(skill, candidateEvidenceList))
            matchedNice.push(skill);
    }
    const requiredScore = requiredSkills.length > 0
        ? (matchedRequired.length / requiredSkills.length) * 100
        : 100;
    const niceScore = niceSkills.length > 0 ? (matchedNice.length / niceSkills.length) * 100 : 0;
    const skillStrength = (profile.skills ?? [])
        .filter((s) => relevanceWeight(s) >= 0.3)
        .map((s) => {
        const yearsWeight = typeof s.years === "number" ? Math.max(0, Math.min(1, s.years / 5)) : 0.5;
        const relWeight = relevanceWeight(s);
        return yearsWeight * 0.6 + relWeight * 0.4;
    });
    const strengthScore = skillStrength.length > 0
        ? (skillStrength.reduce((sum, n) => sum + n, 0) / skillStrength.length) * 100
        : 0;
    // Required skills remain the base denominator; nice-to-have and depth are bonus signals.
    const niceBonus = (niceScore / 100) * 15;
    const depthBonus = (strengthScore / 100) * 10;
    const combinedSkillsScore = clampScore(requiredScore + niceBonus + depthBonus);
    return {
        requiredScore,
        niceScore,
        strengthScore,
        combinedSkillsScore,
        matchedRequired,
        missingRequired,
        matchedNice,
    };
}
function computeExperienceScore(job, profile) {
    if (!job.minExperienceYears) {
        return { score: 100 };
    }
    const candidateYears = profile.totalExperienceYears ?? 0;
    const ratio = Math.min(candidateYears / job.minExperienceYears, 1);
    const baseScore = ratio * 100;
    const qualityWeights = (profile.experiences ?? [])
        .filter((e) => relevanceWeight(e) >= 0.3)
        .map((e) => relevanceWeight(e));
    const qualityBoost = qualityWeights.length > 0
        ? (qualityWeights.reduce((sum, n) => sum + n, 0) / qualityWeights.length) * 10
        : 0;
    const score = clampScore(baseScore + qualityBoost);
    return { score };
}
function computeEducationScore(job, profile) {
    const educations = profile.education ?? [];
    if (!job.educationLevel) {
        return { score: 100 };
    }
    const level = job.educationLevel.toLowerCase();
    const hasRelevant = educations.some((edu) => {
        const degree = (edu.degree ?? "").toLowerCase();
        const field = (edu.fieldOfStudy ?? "").toLowerCase();
        return degree.includes(level) || field.includes(level);
    });
    if (hasRelevant)
        return { score: 100 };
    if (educations.length > 0)
        return { score: 55 };
    return { score: 20 };
}
function computeProjectScore(job, profile) {
    if (!jobRequiresProjectEvidence(job)) {
        return { score: 100, isRequired: false };
    }
    const projects = (profile.projects ?? [])
        .filter((p) => relevanceWeight(p) >= 0.3)
        .sort((a, b) => relevanceWeight(b) - relevanceWeight(a))
        .slice(0, 3);
    if (projects.length === 0)
        return { score: 0, isRequired: true };
    const projectDenominator = 3;
    const projectEvidence = projects.map((p) => {
        const techDepth = Math.min((p.technologies?.length ?? 0) / 5, 1);
        const rel = relevanceWeight(p);
        return {
            weight: Math.max(0.1, rel),
            quality: rel * 0.7 + techDepth * 0.3,
        };
    });
    const weightSum = projectEvidence.reduce((sum, item) => sum + item.weight, 0);
    const weightedQuality = projectEvidence.reduce((sum, item) => sum + item.quality * item.weight, 0) /
        Math.max(weightSum, 0.1);
    const qualityScore = weightedQuality * 100;
    const coverageScore = Math.min(projects.length / projectDenominator, 1) * 100;
    const score = clampScore(qualityScore * 0.7 + coverageScore * 0.3);
    return { score, isRequired: true };
}
function computeScreeningResult(job, profile, _options = {}) {
    const semanticProfile = profile;
    const strengths = [];
    const gaps = [];
    const skills = computeSkillsScore(job, semanticProfile);
    const exp = computeExperienceScore(job, semanticProfile);
    const edu = computeEducationScore(job, semanticProfile);
    const proj = computeProjectScore(job, semanticProfile);
    const { skillsWeight, expWeight, eduWeight, projWeight } = getComponentWeights(job);
    const combinedSkillsScore = skills.combinedSkillsScore;
    const deterministicRaw = combinedSkillsScore * skillsWeight +
        exp.score * expWeight +
        edu.score * eduWeight +
        proj.score * projWeight;
    const deterministicScore = Math.round(clampScore(deterministicRaw));
    const matchScore = deterministicScore;
    if (skills.matchedRequired.length > 0) {
        strengths.push(`Matches required skills: ${skills.matchedRequired.join(", ")}`);
    }
    if (skills.matchedNice.length > 0) {
        strengths.push(`Has nice-to-have skills: ${skills.matchedNice.join(", ")}`);
    }
    if (skills.strengthScore >= 70) {
        strengths.push("Relevant skills show strong depth based on tenure/evidence quality");
    }
    if (skills.missingRequired.length > 0) {
        gaps.push(`Missing required skills: ${skills.missingRequired.join(", ")}`);
    }
    if (!job.minExperienceYears) {
        strengths.push("No minimum experience requirement specified by recruiter (experience component set to 100)");
    }
    else if (exp.score >= 80) {
        strengths.push("Meets or exceeds required years of experience");
    }
    else {
        gaps.push("Below required years of experience");
    }
    if (!job.educationLevel) {
        strengths.push("No specific education level required by recruiter (education component set to 100)");
    }
    else if (edu.score >= 80) {
        strengths.push("Has relevant education level");
    }
    else {
        gaps.push("Education may not match required level");
    }
    if (!proj.isRequired) {
        strengths.push("No project or portfolio requirement specified by recruiter (project component set to 100)");
    }
    else if (proj.score >= 60) {
        strengths.push("Has relevant projects showcasing practical skills");
    }
    else {
        gaps.push("Limited relevant project/portfolio evidence for this role");
    }
    let overallRecommendation = "consider";
    if (matchScore >= 80 && skills.missingRequired.length === 0) {
        overallRecommendation = "strong_match";
    }
    else if (matchScore < 50 || skills.requiredScore < 50) {
        overallRecommendation = "not_recommended";
    }
    const result = {
        matchScore,
        skillsScore: Math.round(combinedSkillsScore),
        experienceScore: Math.round(exp.score),
        educationScore: Math.round(edu.score),
        projectScore: Math.round(proj.score),
        deterministicScore,
        strengths,
        gaps,
        overallRecommendation,
        rawExplanation: [
            `Deterministic score ${deterministicScore}/100 ` +
                `(skills=${Math.round(combinedSkillsScore)}, experience=${Math.round(exp.score)}, ` +
                `education=${Math.round(edu.score)}, projects=${Math.round(proj.score)}).`,
            strengths.length > 0 ? `Strengths: ${strengths.join(". ")}.` : "",
            gaps.length > 0 ? `Gaps: ${gaps.join(". ")}.` : "",
        ]
            .filter(Boolean)
            .join(" "),
        lastRunAt: new Date(),
    };
    return result;
}
//# sourceMappingURL=scoring.service.js.map