import type { Job } from "../models/job.model";
import type { CandidateProfile, ScreeningResult } from "../models/application.model";
export interface ParsedSkill {
    name: string;
    level?: string;
    years?: number;
}
export interface ParsedExperience {
    role: string;
    company: string;
    startDate?: string;
    endDate?: string | null;
    description?: string;
}
export interface ParsedEducation {
    institution: string;
    degree?: string;
    fieldOfStudy?: string;
    startYear?: number;
    endYear?: number;
}
export interface ParsedProject {
    name: string;
    description?: string;
    technologies?: string[];
    link?: string;
}
export interface ParsedCertification {
    name: string;
    issuer?: string;
    year?: number;
}
export interface ParsedProfile {
    skills: ParsedSkill[];
    experiences: ParsedExperience[];
    education: ParsedEducation[];
    projects: ParsedProject[];
    certifications: ParsedCertification[];
}
export interface NormalizedSkill extends ParsedSkill {
    isRelevantToJob?: boolean;
    relevanceScore?: number;
}
export interface NormalizedExperience extends ParsedExperience {
    isRelevantToJob?: boolean;
    relevanceScore?: number;
}
export interface NormalizedEducation extends ParsedEducation {
    isRelevantToJob?: boolean;
    relevanceScore?: number;
}
export interface NormalizedProject extends ParsedProject {
    isRelevantToJob?: boolean;
    relevanceScore?: number;
}
export interface NormalizedCertification extends ParsedCertification {
    isRelevantToJob?: boolean;
    relevanceScore?: number;
}
export interface NormalizedProfile {
    skills: NormalizedSkill[];
    experiences: NormalizedExperience[];
    education: NormalizedEducation[];
    projects: NormalizedProject[];
    certifications: NormalizedCertification[];
    totalExperienceYears: number;
}
export interface ScreeningState {
    jobId: string;
    applicationId: string;
    job?: Job;
    candidateProfile?: CandidateProfile;
    parsedProfile?: ParsedProfile;
    normalizedProfile?: NormalizedProfile;
    screeningResult?: ScreeningResult;
    explanation?: string;
    explanationRequired?: boolean;
}
//# sourceMappingURL=screeningTypes.d.ts.map