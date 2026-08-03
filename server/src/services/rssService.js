"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchRssFeed = fetchRssFeed;
const rss_parser_1 = __importDefault(require("rss-parser"));
const parser = new rss_parser_1.default();
/**
 * Fetches an RSS feed and extracts the raw articles.
 * We extract title, link (sourceUrl), and the raw content/snippet.
 */
async function fetchRssFeed(feedUrl) {
    try {
        console.log(`[RSS] Fetching feed: ${feedUrl}`);
        const feed = await parser.parseURL(feedUrl);
        // Map the raw RSS items into our intermediate ParsedArticle format
        const articles = feed.items.map((item) => ({
            title: item.title || "Untitled",
            sourceUrl: item.link || feedUrl,
            // RSS feeds usually put content in 'content', 'content:encoded', or 'contentSnippet'
            originalContent: item["content:encoded"] || item.content || item.contentSnippet || "",
        }));
        console.log(`[RSS] Successfully parsed ${articles.length} articles from ${feedUrl}`);
        return articles;
    }
    catch (error) {
        console.error(`[RSS] Error fetching feed ${feedUrl}:`, error);
        return [];
    }
}
//# sourceMappingURL=rssService.js.map