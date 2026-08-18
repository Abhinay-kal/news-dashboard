import dotenv from "dotenv";
import { ApifyClient } from "apify-client";

dotenv.config();

async function scrapeTwitterWithApify() {
	const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });
	
	try {
		console.log("[Worker] Testing microworlds/twitter-scraper");
		const run = await client.actor("microworlds/twitter-scraper").call({
			searchMode: "live",
			maxTweets: 2,
			urls: ["https://twitter.com/ALLENkota"]
		});
		const { items } = await client.dataset(run.defaultDatasetId).listItems();
		console.log(`[Worker] returned ${items.length} items`);
		console.log(items.length > 0 ? items[0] : "No items");
	} catch (error) {
		console.error("Error with microworlds:", error.message);
	}
}

scrapeTwitterWithApify();
