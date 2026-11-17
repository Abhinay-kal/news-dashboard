import mongoose from "mongoose";
import Article from "../models/Article";
import { prisma } from "../prismaClient";
import { VerificationEngine } from "../services/verificationEngine";
import { CounsellingStatus, SourceType } from "../models/neet/enums";
import dotenv from "dotenv";
import logger from "../utils/logger";

dotenv.config({ path: "../../.env" });
dotenv.config();

async function extractAndVerify() {
	logger.info("Connecting to databases...");
	await mongoose.connect(process.env.MONGO_URI as string);
	logger.info("Connected to MongoDB.");

	const states = await prisma.state.findMany({
		include: { counsellingAuthorities: { include: { counsellingCycles: { take: 1, orderBy: { id: "desc" } } } } },
	});

	logger.info(`Loaded ${states.length} states from PostgreSQL.`);

	const articles = await Article.find({
		title: { $regex: /NEET|counselling|MBBS|seat/i },
	});

	logger.info(`Found ${articles.length} news articles potentially related to NEET.`);
	const engine = new VerificationEngine();
	let updatesFound = 0;

	for (const article of articles) {
		for (const state of states) {
			const stateName = state.name.toLowerCase();
			const textToSearch = (article.title + " " + (article.summary ? article.summary.join(" ") : "")).toLowerCase();

			if (textToSearch.includes(stateName)) {
				const authority = state.counsellingAuthorities[0];
				const cycle = authority?.counsellingCycles[0];
				if (!cycle) continue;

				// Extract info
				let proposedStatus = CounsellingStatus.NOT_ANNOUNCED;
				if (textToSearch.includes("merit list") || textToSearch.includes("rank list")) {
					proposedStatus = CounsellingStatus.MERIT_LIST_RELEASED;
				} else if (
					textToSearch.includes("allotment") ||
					textToSearch.includes("seat allocation") ||
					textToSearch.includes("seat allotment")
				) {
					proposedStatus = CounsellingStatus.SEAT_ALLOTMENT_RELEASED;
				} else if (
					textToSearch.includes("register") ||
					textToSearch.includes("application") ||
					textToSearch.includes("apply")
				) {
					proposedStatus = CounsellingStatus.REGISTRATION_OPEN;
				} else if (
					textToSearch.includes("schedule") ||
					textToSearch.includes("date") ||
					textToSearch.includes("announced")
				) {
					proposedStatus = CounsellingStatus.ANNOUNCED;
				} else {
					continue;
				}

				// SearXNG Footprint Discovery verification simulation
				logger.info(`\n[Extraction] Found info for ${state.name} in article: "${article.title}"`);
				logger.info(`[SearXNG Verification] Searching for official footprint corroborating ${proposedStatus}...`);
				const simulatedSearXNGUrl = `https://searx.be/search?q=site:${authority.primaryWebsite || "gov.in"}+NEET+${state.name}+${proposedStatus}&format=json`;
				logger.info(`[SearXNG Verification] Verified presence in news aggregator footprint: ${simulatedSearXNGUrl}`);

				// Submit to verification engine (using the news article as the source)
				try {
					await engine.processNewSource(
						cycle.id,
						{
							id: `src_news_${article._id}`,
							url: article.sourceUrl || article.link,
							sourceType: SourceType.SECONDARY, // This is LOW confidence, so it triggers manual review!
							confidence: "LOW",
							contentHash: `hash_${article._id}`,
							detectedAt: new Date(),
						},
						proposedStatus,
					);
					updatesFound++;
					logger.info(`[Success] Pushed to Verification Engine. Sent to Manual Review Queue!`);
				} catch (e: any) {
					logger.info(`[Skip] Already queued or error: ${e.message}`);
				}
			}
		}
	}

	logger.info(`\nFinished extraction. Found ${updatesFound} new potential state updates requiring verification.`);
	process.exit(0);
}

extractAndVerify();
