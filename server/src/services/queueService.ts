import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import logger from "../utils/logger";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", { maxRetriesPerRequest: null });

export const scrapingQueue = new Queue("scrapingQueue", { connection });

// We define the worker logic in the file that actually runs it (e.g., worker.ts).
// But we export the connection and queue here so the API can add jobs.

/**
 * Adds a job to the scraping queue if one isn't already active.
 */
export async function triggerScrapeJob() {
	const activeJobs = await scrapingQueue.getActiveCount();
	const waitingJobs = await scrapingQueue.getWaitingCount();

	if (activeJobs > 0 || waitingJobs > 0) {
		logger.warn("Scrape job is already queued or active. Skipping.");
		return false;
	}

	await scrapingQueue.add("runScraping", {}, { removeOnComplete: true, removeOnFail: false });
	logger.info("Scrape job added to the queue.");
	return true;
}

/**
 * Returns the current status of the queue.
 */
export async function getScrapingStatus() {
	const activeCount = await scrapingQueue.getActiveCount();
	const waitingCount = await scrapingQueue.getWaitingCount();
	const failedCount = await scrapingQueue.getFailedCount();

	const activeJobs = await scrapingQueue.getActive();
	let message = "";
	if (activeJobs.length > 0) {
		const job = activeJobs[0];
		if (job.progress && typeof job.progress === "object" && "message" in job.progress) {
			message = (job.progress as any).message;
		} else if (typeof job.progress === "number") {
			message = `Progress: ${job.progress}%`;
		}
	}

	return {
		isScraping: activeCount > 0,
		waiting: waitingCount,
		failed: failedCount,
		message: message,
	};
}
