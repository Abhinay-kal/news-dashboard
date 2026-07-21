import Parser from 'rss-parser';

const parser = new Parser();

export interface ParsedArticle {
  title: string;
  sourceUrl: string;
  originalContent: string;
}

/**
 * Fetches an RSS feed and extracts the raw articles.
 * We extract title, link (sourceUrl), and the raw content/snippet.
 */
export async function fetchRssFeed(feedUrl: string): Promise<ParsedArticle[]> {
  try {
    console.log(`[RSS] Fetching feed: ${feedUrl}`);
    const feed = await parser.parseURL(feedUrl);
    
    // Map the raw RSS items into our intermediate ParsedArticle format
    const articles: ParsedArticle[] = feed.items.map(item => ({
      title: item.title || 'Untitled',
      sourceUrl: item.link || feedUrl,
      // RSS feeds usually put content in 'content', 'content:encoded', or 'contentSnippet'
      originalContent: item['content:encoded'] || item.content || item.contentSnippet || '',
    }));

    console.log(`[RSS] Successfully parsed ${articles.length} articles from ${feedUrl}`);
    return articles;
  } catch (error) {
    console.error(`[RSS] Error fetching feed ${feedUrl}:`, error);
    return [];
  }
}
