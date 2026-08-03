/**
 * CATEGORIZATION (Keyword Matching)
 * A fast, cost-free way to assign a general topic based on common keywords.
 */
export declare function determineCategory(text: string): string;
/**
 * SUMMARIZATION (LLM)
 * Uses an AI API to read the full text and extract exactly 3 bullet points.
 */
export declare function generateSummary(text: string): Promise<string[]>;
//# sourceMappingURL=summarizationService.d.ts.map