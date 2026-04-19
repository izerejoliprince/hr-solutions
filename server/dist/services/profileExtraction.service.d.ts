import type { CandidateCertification, CandidateEducation, CandidateExperience, CandidateProject, CandidateSkill } from "../models/application.model";
interface ExtractedProfile {
    skills: CandidateSkill[];
    experiences: CandidateExperience[];
    education: CandidateEducation[];
    projects: CandidateProject[];
    certifications: CandidateCertification[];
}
interface ExtractionContext {
    headline?: string | undefined;
    bio?: string | undefined;
}
export declare function extractStructuredProfile(resumeText: string, coverLetterText?: string, context?: ExtractionContext): ExtractedProfile;
export {};
//# sourceMappingURL=profileExtraction.service.d.ts.map