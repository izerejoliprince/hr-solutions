import type { Job } from "../models/job.model";
import type { CandidateProfile, ScreeningResult } from "../models/application.model";
type RelevanceConfidence = {
    isRelevantToJob?: boolean;
    relevanceScore?: number;
};
type SemanticSkill = CandidateProfile["skills"][number] & RelevanceConfidence;
type SemanticExperience = CandidateProfile["experiences"][number] & RelevanceConfidence;
type SemanticEducation = CandidateProfile["education"][number] & RelevanceConfidence;
type SemanticProject = CandidateProfile["projects"][number] & RelevanceConfidence;
type SemanticCertification = CandidateProfile["certifications"][number] & RelevanceConfidence;
export interface SemanticEvidenceProfile extends Omit<CandidateProfile, "skills" | "experiences" | "education" | "projects" | "certifications"> {
    skills: SemanticSkill[];
    experiences: SemanticExperience[];
    education: SemanticEducation[];
    projects: SemanticProject[];
    certifications: SemanticCertification[];
}
interface HybridOptions {
    llmOverall?: number;
    llmReason?: string;
}
export declare function computeScreeningResult(job: Job, profile: CandidateProfile | SemanticEvidenceProfile, _options?: HybridOptions): ScreeningResult;
export {};
//# sourceMappingURL=scoring.service.d.ts.map