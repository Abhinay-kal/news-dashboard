import Parser from "rss-parser";

// Configure parser to extract YouTube's media elements
const parser = new Parser({
	customFields: {
		item: [
			["media:group", "mediaGroup"]
		],
	}
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
		console.log(`[RSS] Fetching feed: ${feedUrl}`);
		const feed = await parser.parseURL(feedUrl);

		// Map the raw RSS items into our intermediate ParsedArticle format
		const articles: ParsedArticle[] = feed.items.map((item: any) => {
			let thumbnailUrl = "";
			
			// YouTube RSS natively uses media:group -> media:thumbnail
			if (item.mediaGroup && item.mediaGroup["media:thumbnail"] && item.mediaGroup["media:thumbnail"][0] && item.mediaGroup["media:thumbnail"][0].$) {
				thumbnailUrl = item.mediaGroup["media:thumbnail"][0].$.url;
			}
			
			return {
				title: item.title || "Untitled",
				sourceUrl: item.link || feedUrl,
				// RSS feeds usually put content in 'content', 'content:encoded', or 'contentSnippet'
				originalContent: item["content:encoded"] || item.content || item.contentSnippet || "",
				thumbnailUrl,
				pubDate: item.pubDate || item.isoDate || undefined,
			};
		});

		console.log(
			`[RSS] Successfully parsed ${articles.length} articles from ${feedUrl}`,
		);
		return articles;
	} catch (error) {
		console.error(`[RSS] Error fetching feed ${feedUrl}:`, error);
		return [];
	}
}
