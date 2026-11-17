import dotenv from "dotenv";
import { ApifyClient } from "apify-client";
import logger from "./utils/logger";

dotenv.config();

async function scrapeTwitterWithApify() {
	const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });

	try {
		logger.info("[Worker] Testing microworlds/twitter-scraper");
		const run = await client.actor("microworlds/twitter-scraper").call({
			searchMode: "live",
			maxTweets: 2,
			urls: ["https://twitter.com/ALLENkota"],
		});
		const { items } = await client.dataset(run.defaultDatasetId).listItems();
		logger.info(`[Worker] returned ${items.length} items`);
		logger.info(items.length > 0 ? items[0] : "No items");
	} catch (error) {
		logger.error({ error: error.message }, "Error with microworlds:");
	}
}

scrapeTwitterWithApify();
