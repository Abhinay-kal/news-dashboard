import dotenv from "dotenv";
import mongoose from "mongoose";
import Article from "./models/Article";
import { fetchRssFeed } from "./services/rssService";
import {
	determineCategory,
	generateSummary,
} from "./services/summarizationService";
import { evaluateArticleRelevance } from "./services/filteringService";

dotenv.config();

/**
 * BACKGROUND WORKER
 * This process runs completely independently of the Express API server.
 */

const RSS_FEEDS = [
	// 1. Top National Education News
	"https://indianexpress.com/section/education/feed/",
	"https://feeds.feedburner.com/ndtvnews-education",
	"https://www.thehindu.com/education/feeder/default.rss",
	"https://www.livemint.com/rss/education",
	"https://www.hindustantimes.com/rss/education/rssfeed.xml",
	
	// 2. EdTech, Startups & Business
	"https://inc42.com/feed/",
	"https://entrackr.com/feed/",
	"https://yourstory.com/feed",
	"https://www.vccircle.com/feed",
	"https://economictimes.indiatimes.com/tech/startups/rssfeeds/83722894.cms",
	
	// 3. Dedicated Exam Aggregators
	"https://www.jagranjosh.com/rss/josh/articles.xml",
	"https://www.ndtv.com/rss/education",
	
	// 4. Custom Google News (Keywords)
	"https://news.google.com/rss/search?q=%22Matrix%20Academy%22%20OR%20%22Matrix%20JEE%22%20OR%20%22Matrix%20NEET%22&hl=en-IN&gl=IN&ceid=IN:en",
	"https://news.google.com/rss/search?q=%22Physics%20Wallah%22%20OR%20%22Allen%20Career%20Institute%22%20OR%20%22Aakash%22%20coaching&hl=en-IN&gl=IN&ceid=IN:en",
	"https://news.google.com/rss/search?q=%22NTA%22%20AND%20(%22JEE%22%20OR%20%22NEET%22)&hl=en-IN&gl=IN&ceid=IN:en",
	"https://news.google.com/rss/search?q=%22Sikar%22%20AND%20%22coaching%22&hl=en-IN&gl=IN&ceid=IN:en",
	
	// 5. Local Rajasthan & Hindi Intelligence
	"https://news.google.com/rss/search?q=%E0%A4%B8%E0%A5%80%E0%A4%95%E0%A4%B0%20%E0%A4%95%E0%A5%8B%E0%A4%9A%E0%A4%BF%E0%A4%82%E0%A4%97&hl=hi&gl=IN&ceid=IN:hi",
	"https://news.google.com/rss/search?q=%E0%A4%B0%E0%A4%BE%E0%A4%9C%E0%A4%B8%E0%A5%8D%E0%A4%A5%E0%A4%BE%E0%A4%A8%20%E0%A4%B6%E0%A4%BF%E0%A4%95%E0%A5%8D%E0%A4%B7%E0%A4%BE&hl=hi&gl=IN&ceid=IN:hi"
];

async function runScrapingJob() {
	console.log(`[Worker] Starting scraping job at ${new Date().toISOString()}`);

	try {
		await mongoose.connect(process.env.MONGO_URI as string);
		console.log("[Worker] Connected to database.");

		const runDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
		let allProcessedArticles: any[] = [];

		for (const feedUrl of RSS_FEEDS) {
			console.log(`[Worker] Fetching articles from ${feedUrl}...`);
			try {
				const rawArticles = await fetchRssFeed(feedUrl);
				console.log(`[Worker] Processing ${rawArticles.length} articles from ${feedUrl}...`);
				
				// Limit to 10 per feed for now since many will be filtered out
				for (const raw of rawArticles.slice(0, 10)) {
					console.log(`Processing: ${raw.title}`);

					const relevance = evaluateArticleRelevance(raw.title, raw.originalContent || "");
					if (!relevance.isRelevant) {
						console.log(`  -> Filtered out: ${relevance.reason}`);
						continue; // Skip this article
					}

					console.log(`  -> Accepted: ${relevance.reason}`);

					const category = determineCategory(raw.originalContent || raw.title);
					const summary = await generateSummary(raw.originalContent || raw.title);

					const articleData = {
						title: raw.title,
						sourceUrl: raw.sourceUrl,
						link: raw.sourceUrl,
						topicCategory: category,
						summary: summary,
						status: "PENDING",
						runDate: runDate,
					};
					allProcessedArticles.push(articleData);
					
					// Save incrementally so UI updates immediately
					await Article.findOneAndUpdate(
						{ sourceUrl: articleData.sourceUrl },
						articleData,
						{ upsert: true }
					);
				}
			} catch (feedError) {
				console.error(`[Worker] Error processing feed ${feedUrl}:`, feedError);
			}
		}

		console.log(`[Worker] Job completed. Saved ${allProcessedArticles.length} articles.`);
	} catch (error) {
		console.error("[Worker] Error during scraping job:", error);
	} finally {
		await mongoose.disconnect();
		console.log("[Worker] Job completed.");
	}
}

runScrapingJob();
