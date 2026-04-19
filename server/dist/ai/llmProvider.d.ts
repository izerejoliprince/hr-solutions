interface LlmInvokeOptions {
    retries?: number;
    temperature?: number;
    timeoutMs?: number;
}
export declare function invokeWithFallback(prompt: string, options?: LlmInvokeOptions): Promise<string>;
export declare function parseJsonLoose<T>(raw: string): T;
export {};
//# sourceMappingURL=llmProvider.d.ts.map