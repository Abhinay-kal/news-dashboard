import { Server } from "socket.io";
import { NeetSourceMonitor, SourceTarget } from "./neetScraperService";
import { VerificationEngine } from "./verificationEngine";
import { SourceType, CounsellingStatus } from "../models/neet/enums";
import { inferCounsellingStatusSync } from "./regexStatusInference";
import { DeduplicationService } from "./neetDeduplicationService";

import { prisma } from "../prismaClient";
import logger from "../utils/logger";

// Memory cache of previous hashes
const previousHashes: Record<string, string> = {};

export async function runNeetMonitoringJob(io: Server) {
	logger.info("[NEET Automation] Starting scheduled source monitoring...");

	const monitor = new NeetSourceMonitor();
	const verificationEngine = new VerificationEngine();

	try {
		// Fetch all authorities that have a primary website and a configured notice selector
		const authorities = await prisma.counsellingAuthority.findMany({
			where: {
				primaryWebsite: { not: null },
				noticeSelector: { not: null },
			},
			include: { state: true },
		});

		const activeTargets: SourceTarget[] = authorities.map((auth) => ({
			stateId: auth.state.id,
			authorityName: auth.name,
			url: auth.primaryWebsite!,
			noticeSelector: auth.noticeSelector!,
		}));

		if (activeTargets.length === 0) {
			logger.info("[NEET Automation] No active targets with selectors found in DB.");
			return;
		}

		// Step 1: Monitor targets for hash changes
		const changes = await monitor.checkTargetsForChanges(activeTargets, previousHashes);

		if (changes.length === 0) {
			logger.info("[NEET Automation] No changes detected across active states.");
			return;
		}

		// Step 2: Process any changes found
		for (const change of changes) {
			const oldText = previousHashes[change.url + "_text"] || "";
			// Update caches
			previousHashes[change.url] = change.contentHash;
			previousHashes[change.url + "_text"] = change.extractedText;
			if (change.etag) previousHashes[change.url + "_etag"] = change.etag;
			if (change.lastModified) previousHashes[change.url + "_lastModified"] = change.lastModified;

			const targetInfo = activeTargets.find((t) => t.url === change.url);
			if (!targetInfo) continue;

			logger.info(`[NEET Automation] Analyzing changes for ${targetInfo.authorityName}...`);

			// Compute diff: Only run regex on lines that are NEW
			const oldLines = new Set(oldText.split("\n"));
			const newLines = change.extractedText.split("\n");

			// Website Redesign Alerting (Self-Healing)
			if (oldLines.size > 20 && newLines.length < oldLines.size * 0.3) {
				logger.error(`[NEET Automation] Major website redesign detected for ${targetInfo.authorityName}!`);
				io.emit("neet-alert", {
					authority: targetInfo.authorityName,
					type: "REDESIGN",
					message: `Major website structure change detected (content dropped by >70%). Check selectors immediately.`,
				});
			}

			const diffLines = newLines.filter((line) => !oldLines.has(line));
			const diffText = diffLines.join("\n");

			// ---------------------------------------------------------
			// DEDUPLICATION MODULE (No Old News / No Duplicate News)
			// ---------------------------------------------------------
			const isDup = DeduplicationService.isDuplicateNews(targetInfo.authorityName, diffText);
			if (isDup && diffText.length > 0) {
				logger.info(`[Deduplication] Ignored duplicate/recycled news for ${targetInfo.authorityName}`);
				continue;
			}

			// Use regex strategy to determine the new stage ONLY on the diff
			// If it's the very first scrape (oldText is empty), diffText is the whole page
			const inferenceResult = inferCounsellingStatusSync(diffText, targetInfo.authorityName);
			const proposedStatus = inferenceResult.status;

			logger.info(`[NEET Automation] Regex proposed status for ${targetInfo.authorityName}: ${proposedStatus}`);
			if (inferenceResult.deadline) {
				logger.info(`[NEET Automation] Auto-extracted deadline: ${inferenceResult.deadline}`);
				// In full implementation, we'd save this to DB Schedule here.
			}

			const cycle = await prisma.counsellingCycle.findFirst({
				where: { authority: { name: targetInfo.authorityName }, year: 2026 },
			});

			if (!cycle) {
				logger.error(`[NEET Automation] Could not find 2026 cycle for ${targetInfo.authorityName}`);
				continue;
			}

			// Step 3: Run through the strict Verification Engine
			const validationStatus = await verificationEngine.processNewSource(
				cycle.id,
				{
					id: `src_${Date.now()}`,
					url: change.url,
					sourceType: SourceType.GOVERNMENT, // Derived from .gov.in/.nic.in in actual implementation
					confidence: verificationEngine.evaluateConfidence(change.url, SourceType.GOVERNMENT),
					contentHash: change.contentHash,
					detectedAt: change.detectedAt,
				},
				proposedStatus,
			);

			// Step 4: Alerting based on Verification Engine output
			if (validationStatus === "VERIFIED") {
				// High confidence official update! Alert the dashboard immediately.
				io.emit("neet-status-update", {
					stateId: targetInfo.stateId,
					authority: targetInfo.authorityName,
					newStatus: proposedStatus,
					url: change.url,
					message: `Official Update: ${targetInfo.authorityName} has transitioned to ${proposedStatus}`,
				});
			} else if (validationStatus === "CONFLICTING" || validationStatus === "NEEDS_VERIFICATION") {
				// Low confidence or conflicting. Send to manual review queue alert.
				io.emit("neet-manual-review-required", {
					stateId: targetInfo.stateId,
					authority: targetInfo.authorityName,
					url: change.url,
					message: `New notice detected on ${targetInfo.authorityName}, but requires manual verification.`,
				});
			}
		}
	} catch (error: any) {
		logger.error(`[NEET Automation] Fatal error during monitoring job: ${error.message}`);
	}
}
