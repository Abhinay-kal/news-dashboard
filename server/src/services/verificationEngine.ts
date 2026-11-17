import { SourceModel, AuditModel, StateDashboardOverviewAPI } from "../models/neet/types";
import { ConfidenceEnum, ValidationStatus, CounsellingStatus, SourceType } from "../models/neet/enums";
import { prisma } from "../prismaClient";
import logger from "../utils/logger";

export class VerificationEngine {
	/**
	 * Assigns a confidence score strictly based on the source's provenance.
	 */
	public evaluateConfidence(url: string, sourceType: SourceType): ConfidenceEnum {
		const whitelistedDomains = [
			"amruhp.ac.in",
			"apdhte.nic.in",
			"bceceboard.bihar.gov.in",
			"bfuhs.ggsmch.org",
			"cee.kerala.gov.in",
			"cetcell.mahacet.org",
			"cetonline.karnataka.gov.in",
			"cgdme.in",
			"dgme.up.gov.in",
			"dhte.mizoram.gov.in",
			"dme.assam.gov.in",
			"dme.mponline.gov.in",
			"dmer.haryana.gov.in",
			"drntr.uhsap.in",
			"dte.goa.gov.in",
			"dte.nagaland.gov.in",
			"jceceb.jharkhand.gov.in",
			"manipurhealthdirectorate.mn.gov.in",
			"ojee.nic.in",
			"ruhsraj.org",
			"statequota.sikkim.gov.in",
			"tnmedicalselection.net",
			"trmcc.admissions.nic.in",
			"wbmcc.nic.in",
			"www.hnbumu.ac.in",
			"www.knruhs.telangana.gov.in",
			"www.medadmgujarat.org",
			"www.meghealth.gov.in",
			"hnbumu.ac.in",
			"knruhs.telangana.gov.in",
			"medadmgujarat.org",
			"meghealth.gov.in",
		];

		try {
			const urlObj = new URL(url);
			if (whitelistedDomains.includes(urlObj.hostname)) {
				return ConfidenceEnum.HIGH;
			}
		} catch (e) {
			// Ignore URL parse error
		}

		// Government and NIC domains are strictly High Confidence (Source of Truth)
		if (sourceType === SourceType.GOVERNMENT && (url.includes(".gov.in") || url.includes(".nic.in"))) {
			return ConfidenceEnum.HIGH;
		}
		// Institutional domains (.ac.in, .edu.in) are Medium Confidence
		if (sourceType === SourceType.INSTITUTIONAL && (url.includes(".ac.in") || url.includes(".edu.in"))) {
			return ConfidenceEnum.MEDIUM;
		}
		// News websites and third-party portals are always Low Confidence
		return ConfidenceEnum.LOW;
	}

	/**
	 * Converts a status string into an integer score for monotonic comparison.
	 */
	private getStatusScore(status: string): number {
		if (status === "UNKNOWN" || status === "NOT_ANNOUNCED") return 0;
		if (status === "COUNSELLING_COMPLETED") return 999999;

		let score = 0;

		if (status.includes("ROUND_1")) score += 10000;
		else if (status.includes("ROUND_2")) score += 20000;
		else if (status.includes("ROUND_3")) score += 30000;
		else if (status.includes("STRAY_VACANCY")) score += 40000;

		if (status.includes("REGISTRATION")) score += 100;
		else if (status.includes("PROVISIONAL_SEAT_MATRIX")) score += 200;
		else if (status.includes("FINAL_SEAT_MATRIX")) score += 300;
		else if (status.includes("CHOICE_FILLING")) score += 400;
		else if (status.includes("CHOICE_LOCKING")) score += 500;
		else if (status.includes("PROVISIONAL_MERIT_LIST")) score += 600;
		else if (status.includes("GRIEVANCE")) score += 700;
		else if (status.includes("FINAL_MERIT_LIST")) score += 800;
		else if (status.includes("SEAT_ALLOCATION_REPORTING")) score += 900;

		if (status.includes("CLOSED") || status.includes("RELEASED")) score += 50;

		return score;
	}

	/**
	 * Determines if a new proposed status can override the current status based on confidence and monotonic timeline.
	 */
	private canOverride(
		currentStatus: string,
		proposedStatus: CounsellingStatus,
		newConfidence: string,
		currentConfidence: string,
	): boolean {
		const currentScore = this.getStatusScore(currentStatus);
		const proposedScore = this.getStatusScore(proposedStatus as string);

		// 1. Monotonic Enforcement: Never allow the state to go backwards chronologically
		if (proposedScore < currentScore) {
			logger.info(
				`[Verification] ANTI-REGRESSION TRIGGERED: Preventing fallback from ${currentStatus} to ${proposedStatus}.`,
			);
			return false;
		}

		// 2. High confidence sources can always override (as long as it doesn't go backwards)
		if (newConfidence === ConfidenceEnum.HIGH) return true;

		// 3. Low confidence sources (like news) can NEVER override a High confidence source
		if (newConfidence === ConfidenceEnum.LOW && currentConfidence === ConfidenceEnum.HIGH) {
			return false;
		}

		// 4. Same confidence level can update to a forward-moving state
		if (newConfidence === currentConfidence) return true;

		return false;
	}

	/**
	 * Processes a newly scraped piece of information and determines the impact on the State Machine.
	 */
	public async processNewSource(
		cycleId: string,
		source: SourceModel,
		proposedStatus: CounsellingStatus,
		extractedDates?: any,
	): Promise<string> {
		// Ensure source exists in DB first, so foreign keys work
		const dbSource = await prisma.source.upsert({
			where: { id: source.id },
			update: {},
			create: {
				id: source.id,
				url: source.url,
				sourceType: source.sourceType,
				confidence: source.confidence,
				contentHash: source.contentHash || null,
				detectedAt: new Date(),
			},
		});

		// Fetch cycle from database
		const cycle = await prisma.counsellingCycle.findUnique({
			where: { id: cycleId },
			include: {
				statusHistory: {
					include: { source: true },
					orderBy: { changedAt: "desc" },
					take: 1,
				},
			},
		});

		if (!cycle) throw new Error("Cycle not found");

		const currentStatus = cycle.currentStatus;
		const newConfidence = source.confidence;

		// Fetch the source that caused the *current* status
		const lastAudit = cycle.statusHistory[0];

		// Default assumption if no previous history
		let currentConfidence = ConfidenceEnum.MEDIUM;

		if (lastAudit && lastAudit.source) {
			currentConfidence = (lastAudit.source.confidence as ConfidenceEnum) || ConfidenceEnum.MEDIUM;
		}

		// 1. DUPLICATE DETECTION
		// If the status is the same, and no dates changed, it's a duplicate notice.
		if (currentStatus === proposedStatus) {
			return ValidationStatus.VERIFIED;
		}

		// 2. CONFLICT DETECTION
		// If an official site says one thing, and a news site says another
		if (!this.canOverride(currentStatus, proposedStatus, newConfidence, currentConfidence)) {
			logger.info(
				`[Verification] CONFLICT DETECTED: ${source.url} proposed ${proposedStatus}, but current official status is ${currentStatus}.`,
			);

			// Queue for manual review instead of overriding
			await prisma.manualReviewQueue.create({
				data: {
					cycleId: cycleId,
					sourceId: dbSource.id,
					proposedStatus: proposedStatus,
					currentStatus: currentStatus,
					conflictReason: `Source confidence (${newConfidence}) is lower than current official status (${currentConfidence}). Needs manual review.`,
				},
			});

			return ValidationStatus.CONFLICTING;
		}

		// 3. APPLY UPDATE (State Machine Transition)
		logger.info(
			`[Verification] Verified transition: ${currentStatus} -> ${proposedStatus} (Confidence: ${newConfidence})`,
		);

		const newValidationStatus =
			newConfidence === ConfidenceEnum.HIGH ? ValidationStatus.VERIFIED : ValidationStatus.NEEDS_VERIFICATION;

		// Perform transactional update
		await prisma.$transaction(async (tx) => {
			// Update the cycle
			await tx.counsellingCycle.update({
				where: { id: cycleId },
				data: {
					currentStatus: proposedStatus,
					statusValidation: newValidationStatus,
				},
			});

			// Write to immutable audit log
			const auditRecord = await tx.statusHistory.create({
				data: {
					cycleId: cycleId,
					statusBefore: currentStatus,
					statusAfter: proposedStatus,
					sourceId: dbSource.id,
					reason: `State machine transition triggered by ${newConfidence} confidence source.`,
				},
			});

			// If it's a medium confidence source updating a medium confidence state, flag it for manual review too
			if (newValidationStatus === ValidationStatus.NEEDS_VERIFICATION) {
				await tx.manualReviewQueue.create({
					data: {
						cycleId: cycleId,
						sourceId: dbSource.id,
						proposedStatus: proposedStatus,
						currentStatus: currentStatus,
						conflictReason: "Secondary source triggered state change. Needs official human verification.",
					},
				});
			}
		});

		return newValidationStatus;
	}
}
