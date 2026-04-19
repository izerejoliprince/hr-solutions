import type { ParsedProfile, NormalizedProfile } from "./screeningTypes";
import type { Job } from "../models/job.model";
import type { CandidateProfile } from "../models/application.model";
import { computeScreeningResult } from "../services/scoring.service";
export declare const ScreeningStateAnnotation: import("@langchain/langgraph").AnnotationRoot<{
    jobId: import("@langchain/langgraph").LastValue<string>;
    applicationId: import("@langchain/langgraph").LastValue<string>;
    job: import("@langchain/langgraph").LastValue<Job | null>;
    candidateProfile: import("@langchain/langgraph").LastValue<CandidateProfile | null>;
    parsedProfile: import("@langchain/langgraph").LastValue<ParsedProfile | null>;
    parseWarnings: import("@langchain/langgraph").LastValue<string[] | null>;
    normalizedProfile: import("@langchain/langgraph").LastValue<NormalizedProfile | null>;
    screeningResult: import("@langchain/langgraph").LastValue<import("../models/application.model").ScreeningResult | null>;
    explanation: import("@langchain/langgraph").LastValue<string | null>;
    explanationRequired: import("@langchain/langgraph").LastValue<boolean>;
}>;
export type ScreeningGraphState = typeof ScreeningStateAnnotation.State;
export declare const screeningGraph: import("@langchain/langgraph").CompiledStateGraph<{
    jobId: string;
    applicationId: string;
    job: Job | null;
    candidateProfile: CandidateProfile | null;
    parsedProfile: ParsedProfile | null;
    parseWarnings: string[] | null;
    normalizedProfile: NormalizedProfile | null;
    screeningResult: import("../models/application.model").ScreeningResult | null;
    explanation: string | null;
    explanationRequired: boolean;
}, {
    jobId?: string;
    applicationId?: string;
    job?: Job | null;
    candidateProfile?: CandidateProfile | null;
    parsedProfile?: ParsedProfile | null;
    parseWarnings?: string[] | null;
    normalizedProfile?: NormalizedProfile | null;
    screeningResult?: import("../models/application.model").ScreeningResult | null;
    explanation?: string | null;
    explanationRequired?: boolean;
}, "__start__" | "parsing" | "relevance" | "scoring" | "explanationAgent", {
    jobId: import("@langchain/langgraph").LastValue<string>;
    applicationId: import("@langchain/langgraph").LastValue<string>;
    job: import("@langchain/langgraph").LastValue<Job | null>;
    candidateProfile: import("@langchain/langgraph").LastValue<CandidateProfile | null>;
    parsedProfile: import("@langchain/langgraph").LastValue<ParsedProfile | null>;
    parseWarnings: import("@langchain/langgraph").LastValue<string[] | null>;
    normalizedProfile: import("@langchain/langgraph").LastValue<NormalizedProfile | null>;
    screeningResult: import("@langchain/langgraph").LastValue<import("../models/application.model").ScreeningResult | null>;
    explanation: import("@langchain/langgraph").LastValue<string | null>;
    explanationRequired: import("@langchain/langgraph").LastValue<boolean>;
}, {
    jobId: import("@langchain/langgraph").LastValue<string>;
    applicationId: import("@langchain/langgraph").LastValue<string>;
    job: import("@langchain/langgraph").LastValue<Job | null>;
    candidateProfile: import("@langchain/langgraph").LastValue<CandidateProfile | null>;
    parsedProfile: import("@langchain/langgraph").LastValue<ParsedProfile | null>;
    parseWarnings: import("@langchain/langgraph").LastValue<string[] | null>;
    normalizedProfile: import("@langchain/langgraph").LastValue<NormalizedProfile | null>;
    screeningResult: import("@langchain/langgraph").LastValue<import("../models/application.model").ScreeningResult | null>;
    explanation: import("@langchain/langgraph").LastValue<string | null>;
    explanationRequired: import("@langchain/langgraph").LastValue<boolean>;
}, import("@langchain/langgraph").StateDefinition, {
    parsing: {
        parsedProfile: {
            skills: import("./screeningTypes").ParsedSkill[];
            experiences: import("./screeningTypes").ParsedExperience[];
            education: import("./screeningTypes").ParsedEducation[];
            projects: import("./screeningTypes").ParsedProject[];
            certifications: import("./screeningTypes").ParsedCertification[];
        };
        parseWarnings: string[];
    };
    relevance: {
        normalizedProfile: NormalizedProfile;
    };
    scoring: {
        screeningResult: import("../models/application.model").ScreeningResult;
    };
    explanationAgent: {
        explanation: string;
    };
}, unknown, unknown>;
export declare function generateScreeningExplanation(job: Job, result: ReturnType<typeof computeScreeningResult>): Promise<string>;
//# sourceMappingURL=screeningGraph.d.ts.map