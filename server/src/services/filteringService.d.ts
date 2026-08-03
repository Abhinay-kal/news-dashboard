export declare const POSITIVE_KEYWORDS: string[];
export declare const NEGATIVE_KEYWORDS: string[];
/**
 * Evaluates whether an article is relevant based on positive and negative keyword matching.
 * Returns an object with `isRelevant` boolean and a `reason` string for logging.
 */
export declare function evaluateArticleRelevance(title: string, contentSnippet: string): {
    isRelevant: boolean;
    reason: string;
};
//# sourceMappingURL=filteringService.d.ts.map