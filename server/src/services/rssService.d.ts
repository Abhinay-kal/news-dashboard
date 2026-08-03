export interface ParsedArticle {
    title: string;
    sourceUrl: string;
    originalContent: string;
}
/**
 * Fetches an RSS feed and extracts the raw articles.
 * We extract title, link (sourceUrl), and the raw content/snippet.
 */
export declare function fetchRssFeed(feedUrl: string): Promise<ParsedArticle[]>;
//# sourceMappingURL=rssService.d.ts.map