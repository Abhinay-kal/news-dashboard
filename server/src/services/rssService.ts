import Parser from "rss-parser";
import SourceHealth from "../models/SourceHealth";
import logger from "../utils/logger";

// Configure parser to extract YouTube's media elements
const parser = new Parser({
	customFields: {
		item: [["media:group", "mediaGroup"]],
	},
});

export interface ParsedArticle {
	title: string;
	sourceUrl: string;
	originalContent: string;
	thumbnailUrl?: string;
	pubDate?: string;
}

/**
 * Fetches an RSS feed and extracts the raw articles.
 * We extract title, link (sourceUrl), raw content/snippet, and thumbnail (if YouTube).
 */
export async function fetchRssFeed(feedUrl: string): Promise<ParsedArticle[]> {
	try {
		logger.info(`[RSS] Fetching feed: ${feedUrl}`);
		const feed = await parser.parseURL(feedUrl);

		// Map the raw RSS items into our intermediate ParsedArticle format, skipping items without a link to prevent sourceUrl collisions
		const articles: ParsedArticle[] = feed.items
			.filter((item: any) => item && typeof item.link === "string" && item.link.trim() !== "")
			.map((item: any) => {
				let thumbnailUrl = "";

				// YouTube RSS natively uses media:group -> media:thumbnail
				if (
					item.mediaGroup &&
					item.mediaGroup["media:thumbnail"] &&
					item.mediaGroup["media:thumbnail"][0] &&
					item.mediaGroup["media:thumbnail"][0].$
				) {
					thumbnailUrl = item.mediaGroup["media:thumbnail"][0].$.url;
				}

				return {
					title: item.title || "Untitled",
					sourceUrl: item.link.trim(),
					// RSS feeds usually put content in 'content', 'content:encoded', or 'contentSnippet'
					originalContent: item["content:encoded"] || item.content || item.contentSnippet || "",
					thumbnailUrl,
					pubDate: item.pubDate || item.isoDate || undefined,
				};
			});

		logger.info(`[RSS] Successfully parsed ${articles.length} articles from ${feedUrl}`);

		await SourceHealth.findOneAndUpdate(
			{ feedUrl },
			{ lastSuccessfulPull: new Date(), consecutiveErrors: 0, status: "HEALTHY" },
			{ upsert: true },
		);

		return articles;
	} catch (error) {
		logger.error({ error: error }, `[RSS] Error fetching feed ${feedUrl}:`);

		const health = await SourceHealth.findOneAndUpdate(
			{ feedUrl },
			{ $inc: { consecutiveErrors: 1 } },
			{ new: true, upsert: true },
		);
		if (health.consecutiveErrors >= 5 && health.status !== "DEAD") {
			health.status = "DEAD";
			await health.save();
		} else if (health.consecutiveErrors > 0 && health.status === "HEALTHY") {
			health.status = "DEGRADED";
			await health.save();
		}

		return [];
	}
}
