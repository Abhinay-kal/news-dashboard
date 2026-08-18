import dotenv from "dotenv";
import mongoose from "mongoose";
import axios from "axios";
import Article from "./models/Article";
import { fetchRssFeed } from "./services/rssService";
import { findStoryCluster } from "./services/deduplicationService";
import {
	determineCategory,
	generateSummary,
} from "./services/summarizationService";
import { evaluateArticleRelevance, isArticleRecent } from "./services/filteringService";
import { normalizeText } from "./utils/textNormalizer";

dotenv.config();

/**
 * BACKGROUND WORKER
 * This process runs completely independently of the Express API server.
 */

import fs from "fs";
import path from "path";

// Load configuration file
const feedsConfigPath = path.join(__dirname, "../config/feeds.json");
const feedsConfig = JSON.parse(fs.readFileSync(feedsConfigPath, "utf-8"));

const RSS_FEEDS: string[] = [];

// Helper to generate feed URLs for each keyword
function generateFeedUrls(keyword: string) {
	if (keyword.startsWith("http")) {
		// It's a direct RSS feed URL (like a YouTube channel RSS)
		RSS_FEEDS.push(keyword);
		return;
	}

	const encoded = encodeURIComponent(keyword);
	// 1. Google News Search (covers websites, PIBs, news outlets)
	RSS_FEEDS.push(`https://news.google.com/rss/search?q=${encoded}&hl=en-IN&gl=IN&ceid=IN:en`);
	

}

// Iterate through all categories in our feeds.json and build the master array
const twitterHandles: string[] = [];

for (const category in feedsConfig) {
	const keywords: string[] = feedsConfig[category];
	
	if (category === "Twitter_Accounts") {
		for (const url of keywords) {
			const handle = url.split("/").pop();
			if (handle) twitterHandles.push(handle);
		}
		continue;
	}

	for (const keyword of keywords) {
		generateFeedUrls(keyword);
	}
}

async function scrapeTwitterWithRapidAPI(runDate: string) {
	if (!process.env.RAPIDAPI_KEY || twitterHandles.length === 0) {
		console.log("[Worker] No RAPIDAPI_KEY found, skipping RapidAPI Twitter scrape.");
		return;
	}

	console.log(`[Worker] Starting RapidAPI Twitter scrape for ${twitterHandles.length} handles...`);

	let consecutiveRateLimits = 0;
	
	for (const handle of twitterHandles) {
		if (consecutiveRateLimits >= 2) {
			console.error("[Worker] RapidAPI rate limit hit repeatedly. Aborting remaining Twitter scrape.");
			break;
		}

		try {
			console.log(`[Worker] Fetching timeline for @${handle} via RapidAPI...`);
			const options = {
				method: 'GET',
				url: 'https://twitter-api45.p.rapidapi.com/timeline.php',
				params: { screenname: handle },
				headers: {
					'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
					'X-RapidAPI-Host': 'twitter-api45.p.rapidapi.com'
				}
			};

			const response = await axios.request(options);
			const timeline = response.data?.timeline;

			if (!Array.isArray(timeline)) {
				const message = response.data?.message || "no timeline key in response";
				console.error(`[Worker] Unexpected RapidAPI response for @${handle}: ${message}`);
				consecutiveRateLimits++;
				continue;
			}
			consecutiveRateLimits = 0;

			console.log(`[Worker] Found ${timeline.length} tweets for @${handle}`);
			
			for (const tweet of timeline.slice(0, 3)) { // fetch latest 3 tweets per handle
				const text = tweet.text || "";
				const tweetId = tweet.tweet_id;
				const url = `https://twitter.com/${handle}/status/${tweetId}`;
				
				if (!text || !tweetId) continue;

				console.log(`Processing Tweet: ${url}`);
				const normalizedText = normalizeText(text);
				const relevance = evaluateArticleRelevance(normalizedText, normalizedText);
				if (!relevance.isRelevant) {
					console.log(`  -> Filtered out: ${relevance.reason}`);
					continue;
				}
				console.log(`  -> Accepted: ${relevance.reason}`);

				// Date Check (48 hours, same window as RSS path)
				console.log(`  -> Validating Date for: ${url}`);
				const dateCheck = await isArticleRecent(tweet.created_at);
				if (!dateCheck.isRecent) {
					console.log(`  -> Rejected (Old tweet): ${dateCheck.reason}`);
					continue;
				}

				const category = determineCategory(normalizedText);
				const summary = await generateSummary(normalizedText);

				const articleData = {
					title: text.length > 200 ? text.substring(0, 197) + "..." : text,
					sourceUrl: url,
					link: url,
					topicCategory: category,
					summary: summary,
					status: "PENDING",
					runDate: runDate,
				};
				
				await Article.findOneAndUpdate(
					{ sourceUrl: articleData.sourceUrl },
					articleData,
					{ upsert: true }
				);
			}
			
			// Sleep for 2 seconds between handles to avoid rate limits
			await new Promise(r => setTimeout(r, 2000));
		} catch (error: any) {
			if (error.response?.status === 429) {
				consecutiveRateLimits++;
				console.error(`[Worker] Rate limited for @${handle}, backing off 15s...`);
				await new Promise(r => setTimeout(r, 15000));
				continue;
			}
			if (error.response?.status === 401 || error.response?.status === 403) {
				console.error(`[Worker] RapidAPI auth error for @${handle}. Aborting Twitter scrape.`);
				break;
			}
			console.error(`[Worker] RapidAPI scraping error for ${handle}:`, error.message);
		}
	}
}

async function runScrapingJob() {
	console.log(`[Worker] Starting scraping job at ${new Date().toISOString()}`);
	console.log(`[Worker] Loaded ${RSS_FEEDS.length} dynamic feed URLs from configuration.`);

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

					const relevance = evaluateArticleRelevance(
						raw.title,
						raw.originalContent || "",
					);

					if (relevance.isRelevant) {
						// Date Check
						console.log(`  -> Validating Date for: ${raw.title}`);
						const dateCheck = await isArticleRecent(raw.pubDate, raw.sourceUrl);
						if (!dateCheck.isRecent) {
							console.log(`  -> Rejected (Old News): ${dateCheck.reason}`);
							continue; // Skip this old article
						}

						console.log(`  -> Accepted: ${relevance.reason} and is Recent.`);

						const category = determineCategory(raw.originalContent || raw.title);
						const summary = await generateSummary(raw.originalContent || raw.title);
						
						// Deduplication clustering
						console.log(`  -> Finding Story Cluster...`);
						const clusterResult = await findStoryCluster(raw.title, raw.originalContent || raw.title);
						const finalStoryId = clusterResult === "NEW" ? new mongoose.Types.ObjectId().toString() : clusterResult;
						console.log(`  -> Assigned Story ID: ${finalStoryId}`);

						const articleData = {
							title: raw.title,
							sourceUrl: raw.sourceUrl,
							link: raw.sourceUrl,
							topicCategory: category,
							summary: summary,
							status: "PENDING",
							runDate: runDate,
							thumbnailUrl: raw.thumbnailUrl || "",
							storyId: finalStoryId
						};
						allProcessedArticles.push(articleData);
						
						// Save incrementally so UI updates immediately
						await Article.findOneAndUpdate(
							{ sourceUrl: articleData.sourceUrl },
							articleData,
							{ upsert: true }
						);
					} else {
						console.log(`  -> Filtered out: ${relevance.reason}`);
						continue; // Skip this article
					}
				}
			} catch (feedError) {
				console.error(`[Worker] Error processing feed ${feedUrl}:`, feedError);
			}
		}

		console.log(`[Worker] RSS Job completed. Saved ${allProcessedArticles.length} articles.`);

		// After RSS, run RapidAPI for Twitter
		await scrapeTwitterWithRapidAPI(runDate);

	} catch (error) {
		console.error("[Worker] Error during scraping job:", error);
	} finally {
		await mongoose.disconnect();
		console.log("[Worker] Job completed.");
	}
}

runScrapingJob();
