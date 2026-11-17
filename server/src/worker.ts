import dotenv from "dotenv";
import mongoose from "mongoose";
import axios from "axios";
import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import Article from "./models/Article";
import { fetchRssFeed } from "./services/rssService";
import { findStoryCluster } from "./services/deduplicationService";
import { generateSummary } from "./services/summarizationService";
import { determineCategory, trainCategorizer } from "./services/categorizationService";
import { normalizeText } from "./utils/textNormalizer";
import { extractThumbnailUrl } from "./services/imageExtractionService";
import { calculateUrgencyScore } from "./services/sentimentService";
import { evaluateArticleRelevance, isArticleRecent, evaluateMainSiteRelevance } from "./services/filteringService";
import logger from "./utils/logger";

dotenv.config();

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", { maxRetriesPerRequest: null });

/**
 * BACKGROUND WORKER
 * This process runs completely independently of the Express API server.
 */

import fs from "fs";
import path from "path";

// Load configuration file
const feedsConfigPath = path.join(__dirname, "../config/feeds.json");
const feedsConfig = JSON.parse(fs.readFileSync(feedsConfigPath, "utf-8"));

const RSS_FEEDS: { url: string; category: string; keyword: string }[] = [];

// Helper to generate feed URLs for each keyword
function generateFeedUrls(keyword: string, category: string) {
	if (keyword.startsWith("http")) {
		// It's a direct RSS feed URL (like a YouTube channel RSS)
		RSS_FEEDS.push({ url: keyword, category, keyword });
		return;
	}

	const encoded = encodeURIComponent(keyword);
	// 1. Google News Search (covers websites, PIBs, news outlets)
	RSS_FEEDS.push({
		url: `https://news.google.com/rss/search?q=${encoded}&hl=en-IN&gl=IN&ceid=IN:en`,
		category,
		keyword,
	});
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
		generateFeedUrls(keyword, category);
	}
}

async function scrapeTwitterWithRapidAPI(runDate: string, job: Job, currentSource: number, totalSources: number) {
	if (!process.env.RAPIDAPI_KEY || twitterHandles.length === 0) {
		logger.info("[Worker] No RAPIDAPI_KEY found, skipping RapidAPI Twitter scrape.");
		return;
	}

	logger.info(`[Worker] Starting RapidAPI Twitter scrape for ${twitterHandles.length} handles...`);

	let consecutiveRateLimits = 0;

	for (const handle of twitterHandles) {
		currentSource++;
		await job.updateProgress({ message: `${currentSource}/${totalSources} sources` });

		if (consecutiveRateLimits >= 2) {
			logger.error("[Worker] RapidAPI rate limit hit repeatedly. Aborting remaining Twitter scrape.");
			break;
		}

		try {
			logger.info(`[Worker] Fetching timeline for @${handle} via RapidAPI...`);
			const options = {
				method: "GET",
				url: "https://twitter-api45.p.rapidapi.com/timeline.php",
				params: { screenname: handle },
				headers: {
					"X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
					"X-RapidAPI-Host": "twitter-api45.p.rapidapi.com",
				},
			};

			const response = await axios.request(options);
			const timeline = response.data?.timeline;

			if (!Array.isArray(timeline)) {
				const message = response.data?.message || "no timeline key in response";
				logger.error(`[Worker] Unexpected RapidAPI response for @${handle}: ${message}`);
				consecutiveRateLimits++;
				continue;
			}
			consecutiveRateLimits = 0;

			logger.info(`[Worker] Found ${timeline.length} tweets for @${handle}`);

			for (const tweet of timeline.slice(0, 3)) {
				// fetch latest 3 tweets per handle
				const text = tweet.text || "";
				const tweetId = tweet.tweet_id;
				const url = `https://twitter.com/${handle}/status/${tweetId}`;

				if (!text || !tweetId) continue;

				logger.info(`Processing Tweet: ${url}`);
				const normalizedText = normalizeText(text);
				const relevance = await evaluateArticleRelevance(normalizedText, normalizedText);
				if (!relevance.isRelevant) {
					logger.info(`  -> Filtered out: ${relevance.reason}`);
					continue;
				}
				logger.info(`  -> Accepted: ${relevance.reason}`);

				// Date Check (48 hours, same window as RSS path)
				logger.info(`  -> Validating Date for: ${url}`);
				const dateCheck = await isArticleRecent(tweet.created_at);
				if (!dateCheck.isRecent) {
					logger.info(`  -> Rejected (Old tweet): ${dateCheck.reason}`);
					continue;
				}

				const summary = await generateSummary(normalizedText);
				
				const officialHandles = ["nta_exams", "eduminofindia", "cbseindia29", "ugc_india", "aicte_india", "nmc_bharat", "mohfw_india"];
				let category = "General";
				if (officialHandles.includes(handle.toLowerCase())) {
					category = "Main_Site_News";
				} else {
					category = determineCategory(text.length > 200 ? text.substring(0, 197) + "..." : text, summary);
				}
				const urgencyScore = calculateUrgencyScore(text, summary);

				const articleData = {
					title: text.length > 200 ? text.substring(0, 197) + "..." : text,
					sourceUrl: url,
					link: url,
					topicCategory: category,
					summary: summary,
					status: "PENDING",
					runDate: runDate,
					urgencyScore,
				};

				await Article.findOneAndUpdate({ sourceUrl: articleData.sourceUrl }, articleData, { upsert: true });
				await connection.del(`articles_${runDate}`);
			}

			// Sleep for 2 seconds between handles to avoid rate limits
			await new Promise((r) => setTimeout(r, 2000));
		} catch (error: any) {
			if (error.response?.status === 429) {
				consecutiveRateLimits++;
				logger.error(`[Worker] Rate limited for @${handle}, backing off 15s...`);
				await new Promise((r) => setTimeout(r, 15000));
				continue;
			}
			if (error.response?.status === 401 || error.response?.status === 403) {
				logger.error(`[Worker] RapidAPI auth error for @${handle}. Aborting Twitter scrape.`);
				break;
			}
			logger.error({ error: error.message }, `[Worker] RapidAPI scraping error for ${handle}:`);
		}
	}
}

async function runScrapingJob(job: Job) {
	logger.info(`[Worker] Starting scraping job at ${new Date().toISOString()}`);
	logger.info(`[Worker] Loaded ${RSS_FEEDS.length} dynamic feed URLs from configuration.`);

	try {
		if (mongoose.connection.readyState !== 1) {
			await mongoose.connect(process.env.MONGO_URI as string);
			logger.info("[Worker] Connected to database.");
		}
		await trainCategorizer();

		const runDate = new Date().toISOString().split("T")[0] as string; // YYYY-MM-DD
		const allProcessedArticles: any[] = [];
		const totalSources = RSS_FEEDS.length + twitterHandles.length;
		let currentSource = 0;

		for (const feed of RSS_FEEDS) {
			currentSource++;
			await job.updateProgress({ message: `${currentSource}/${totalSources} sources` });
			logger.info(`[Worker] Fetching articles from ${feed.url}...`);
			try {
				const rawArticles = await fetchRssFeed(feed.url);
				logger.info(`[Worker] Processing ${rawArticles.length} articles from ${feed.url}...`);

				// Limit to 10 per feed for now since many will be filtered out
				for (const raw of rawArticles.slice(0, 10)) {
					logger.info(`Processing: ${raw.title}`);

					const relevance = await evaluateArticleRelevance(raw.title, raw.originalContent || "");

					if (relevance.isRelevant) {
						// Date Check
						logger.info(`  -> Validating Date for: ${raw.title}`);
						const maxHours = feed.category === "Main_Site_News" ? 48 : 48;
						const dateCheck = await isArticleRecent(raw.pubDate, raw.sourceUrl, maxHours);
						if (!dateCheck.isRecent) {
							logger.info(`  -> Rejected (Old News): ${dateCheck.reason}`);
							continue; // Skip this old article
						}

						logger.info(`  -> Accepted: ${relevance.reason} and is Recent.`);

						const summary = await generateSummary(raw.originalContent || raw.title, !!raw.originalContent);
						
						let category = "General";
						if (
							feed.category === "Main_Site_News" || 
							relevance.reason.includes("P0 override keyword") ||
							evaluateMainSiteRelevance(raw.title, Array.isArray(summary) ? summary.join(" ") : (summary || ""))
						) {
							category = "Main_Site_News";
						} else {
							category = determineCategory(raw.title, summary);
						}

						// Deduplication clustering
						logger.info(`  -> Finding Story Cluster...`);
						const clusterResult = await findStoryCluster(raw.title, raw.originalContent || raw.title);
						const finalStoryId = clusterResult === "NEW" ? new mongoose.Types.ObjectId().toString() : clusterResult;
						logger.info(`  -> Assigned Story ID: ${finalStoryId}`);

						const finalThumbnailUrl = await extractThumbnailUrl(raw.sourceUrl, raw.thumbnailUrl);
						const urgencyScore = calculateUrgencyScore(raw.title, summary);

						const articleData = {
							title: raw.title,
							sourceUrl: raw.sourceUrl,
							link: raw.sourceUrl,
							topicCategory: category,
							summary: summary,
							status: "PENDING",
							runDate: runDate,
							thumbnailUrl: finalThumbnailUrl,
							storyId: finalStoryId,
							urgencyScore,
						};
						allProcessedArticles.push(articleData);

						// Save incrementally so UI updates immediately
						await Article.findOneAndUpdate({ sourceUrl: articleData.sourceUrl }, articleData, { upsert: true });
				await connection.del(`articles_${runDate}`);
					} else {
						logger.info(`  -> Filtered out: ${relevance.reason}`);
						continue; // Skip this article
					}
				}
			} catch (feedError) {
				logger.error({ error: feedError }, `[Worker] Error processing feed ${feed.url}:`);
			}
		}

		logger.info(`[Worker] RSS Job completed. Saved ${allProcessedArticles.length} articles.`);

		// After RSS, run RapidAPI for Twitter
		await scrapeTwitterWithRapidAPI(runDate, job, currentSource, totalSources);
	} catch (error) {
		logger.error({ error }, "[Worker] Error during scraping job");
	} finally {
		logger.info("[Worker] Job completed.");
	}
}

// Initialize BullMQ Worker with extended lock duration and auto-renewal to prevent stalled job errors
let scrapingWorker: Worker | null = null;

export function initScrapingWorker(): Worker {
	if (scrapingWorker) return scrapingWorker;

	scrapingWorker = new Worker(
		"scrapingQueue",
		async (job) => {
			logger.info(`[Worker] Picked up job ${job.id}. Initiating scrape...`);
			await runScrapingJob(job);
		},
		{
			connection,
			lockDuration: 300000, // 5 minutes to prevent premature job stalling
			lockRenewTime: 60000, // renew lock every minute
			stalledInterval: 60000,
			maxStalledCount: 3,
		},
	);

	scrapingWorker.on("completed", (job) => {
		logger.info(`[Worker] Job ${job.id} completed successfully`);
	});

	scrapingWorker.on("failed", (job, err) => {
		logger.error({ err }, `[Worker] Job ${job?.id} failed`);
	});

	logger.info("[Worker] Listening for jobs on scrapingQueue...");
	return scrapingWorker;
}

// Auto-start if invoked directly via CLI (e.g. npx ts-node src/worker.ts)
if (require.main === module) {
	initScrapingWorker();
}
