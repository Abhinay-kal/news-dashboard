import { prisma } from "../prismaClient";
import { VerificationEngine } from "../services/verificationEngine";
import { CounsellingStatus, SourceType } from "../models/neet/enums";
import { NeetSourceMonitor } from "../services/neetScraperService";
import { inferCounsellingStatusSync } from "../services/regexStatusInference";
import dotenv from "dotenv";
import logger from "../utils/logger";

dotenv.config({ path: "../../.env" });
dotenv.config();

const STATUS_KEYS = Object.keys(CounsellingStatus);

async function extractFromPortals() {
	logger.info("Connecting to PostgreSQL...");

	const states = await prisma.state.findMany({
		include: { counsellingAuthorities: { include: { counsellingCycles: { take: 1, orderBy: { id: "desc" } } } } },
	});

	logger.info(`Loaded ${states.length} states from PostgreSQL.`);

	const engine = new VerificationEngine();
	const monitor = new NeetSourceMonitor();

	let updatesFound = 0;

	for (const state of states) {
		const authority = state.counsellingAuthorities[0];
		const cycle = authority?.counsellingCycles[0];
		if (!cycle || !authority?.primaryWebsite) continue;

		logger.info(`\n[Scraping] Fetching official portal for ${state.name}: ${authority.primaryWebsite}`);

		try {
			const result = await monitor.scrapeTarget({
				stateId: state.id,
				authorityName: authority.name,
				url: authority.primaryWebsite,
			});

			if (result.error || !result.extractedText) {
				logger.info(`[Error] Failed to extract text for ${state.name}: ${result.error || "Empty body"}`);
				continue;
			}

			logger.info(
				`[Inference] Analyzing ${result.extractedText.length} characters of text for counselling stage using regex...`,
			);

			const inferenceResult = inferCounsellingStatusSync(result.extractedText, authority.name);
			const proposedStatus = inferenceResult.status;

			if (proposedStatus && proposedStatus !== CounsellingStatus.UNKNOWN && STATUS_KEYS.includes(proposedStatus)) {
				logger.info(`[Extracted] Found status: ${proposedStatus}`);

				try {
					await engine.processNewSource(
						cycle.id,
						{
							id: `src_portal_${state.id}`,
							url: authority.primaryWebsite,
							sourceType: SourceType.GOVERNMENT, // HIGH confidence, bypasses queue if no conflict
							confidence: "HIGH",
							contentHash: result.contentHash,
							detectedAt: new Date(),
						},
						proposedStatus,
					);
					updatesFound++;
					logger.info(`[Success] Applied HIGH confidence update to Verification Engine.`);
				} catch (e: any) {
					logger.info(`[Info] Verification Engine logic: ${e.message}`);
				}
			} else {
				logger.info(`[No Status] LLM returned UNKNOWN or invalid status.`);
			}
		} catch (err: any) {
			logger.error(`[Fatal] Error processing ${state.name}: ${err.message}`);
		}
	}

	logger.info(`\nFinished extraction. Sent ${updatesFound} automated HIGH confidence updates.`);
	process.exit(0);
}

extractFromPortals();
