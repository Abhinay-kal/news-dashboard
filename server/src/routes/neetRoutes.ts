import { Router, Request, Response } from "express";
import { prisma } from "../prismaClient";
import logger from "../utils/logger";
import { z } from "zod";
import { validate } from "../middleware/validate";

const router = Router();

// GET /api/neet/states - Returns the national overview for the dashboard
router.get("/states", async (req: Request, res: Response) => {
	try {
		const states = await prisma.state.findMany({
			include: {
				counsellingAuthorities: {
					include: {
						counsellingCycles: {
							where: { year: 2026 },
							orderBy: { id: "desc" },
							take: 1,
						},
					},
				},
			},
		});

		// Map database response to the format expected by the frontend
		const formattedStates = states.map((state) => {
			const authority = state.counsellingAuthorities[0];
			const currentCycle = authority?.counsellingCycles[0];

			return {
				id: state.id,
				name: state.name,
				authority: authority?.name || "Unknown Authority",
				currentStage: currentCycle?.currentStatus || "NOT_ANNOUNCED",
				validationStatus: currentCycle?.statusValidation || "UNKNOWN",
				nextDeadline: null, // Would require joining the schedules table
				lastUpdate: new Date().toISOString(), // Fallback timestamp
			};
		});

		const metrics = {
			totalStates: 36,
			counsellingAnnounced: formattedStates.filter((s) => s.currentStage !== "NOT_ANNOUNCED").length,
			registrationOpen: formattedStates.filter((s) => s.currentStage === "REGISTRATION_OPEN").length,
			needsVerification: formattedStates.filter((s) => s.validationStatus === "NEEDS_VERIFICATION").length,
		};

		res.json({ states: formattedStates, metrics });
	} catch (error) {
		logger.error({ error: error }, "Error fetching NEET states overview:");
		res.status(500).json({ error: "Internal Server Error" });
	}
});

// GET /api/neet/states/:id/timeline - Returns state detail and timeline history
const getStateTimelineSchema = z.object({
	params: z.object({
		id: z.string().min(1, "State ID is required"),
	}),
});

router.get("/states/:id/timeline", validate(getStateTimelineSchema), async (req: Request, res: Response) => {
	try {
		const { id } = req.params;

		const state = await prisma.state.findUnique({
			where: { id },
			include: {
				counsellingAuthorities: {
					include: {
						counsellingCycles: {
							where: { year: 2026 },
							include: {
								statusHistory: {
									include: { source: true },
									orderBy: { changedAt: "desc" },
								},
								counsellingRounds: {
									include: {
										schedules: { orderBy: { eventDate: "asc" } },
									},
								},
							},
						},
					},
				},
			},
		});

		if (!state) {
			return res.status(404).json({ error: "State not found" });
		}

		const authority = state.counsellingAuthorities[0];
		const currentCycle = authority?.counsellingCycles[0];

		// Format history exactly like MOCK_STATE_DATA in frontend
		const history =
			currentCycle?.statusHistory.map((audit) => ({
				id: audit.id,
				statusBefore: audit.statusBefore || "UNKNOWN",
				statusAfter: audit.statusAfter,
				changedAt: audit.changedAt,
				sourceUrl: audit.source?.url || null,
				confidence: audit.source?.confidence || "UNKNOWN",
				reason: audit.reason || "State transition",
			})) || [];

		// Format schedules
		const schedules =
			currentCycle?.counsellingRounds.map((round) => ({
				roundName: round.roundName,
				events: round.schedules.map((event) => ({
					eventType: event.eventType,
					eventDate: event.eventDate,
					isTentative: event.isTentative,
				})),
			})) || [];

		const cutoffs = await prisma.historicalCutoff.findMany({
			where: { stateId: id, year: 2025 },
			orderBy: { category: "asc" },
		});

		res.json({
			id: state.id,
			name: state.name,
			authority: authority?.name || "Unknown",
			officialWebsite: authority?.primaryWebsite || null,
			currentStage: currentCycle?.currentStatus || "NOT_ANNOUNCED",
			history,
			schedules,
			historicalCutoffs: cutoffs,
		});
	} catch (error) {
		logger.error({ error: error }, "Error fetching state timeline:");
		res.status(500).json({ error: "Internal Server Error" });
	}
});

// GET /api/neet/admin/queue - Returns manual review queue
router.get("/admin/queue", async (req: Request, res: Response) => {
	try {
		const queue = await prisma.manualReviewQueue.findMany({
			where: { status: "PENDING" },
			include: {
				cycle: { include: { authority: { include: { state: true } } } },
				source: true,
			},
			orderBy: { createdAt: "desc" },
		});

		res.json(
			queue.map((q) => ({
				id: q.id,
				stateName: q.cycle.authority.state.name,
				authorityName: q.cycle.authority.name,
				currentStatus: q.currentStatus,
				proposedStatus: q.proposedStatus,
				conflictReason: q.conflictReason,
				sourceUrl: q.source.url,
				confidence: q.source.confidence,
				detectedAt: q.source.detectedAt,
			})),
		);
	} catch (error) {
		logger.error({ error: error }, "Error fetching admin queue:");
		res.status(500).json({ error: "Internal Server Error" });
	}
});

// POST /api/neet/admin/queue/:id/approve
const queueActionSchema = z.object({
	params: z.object({
		id: z.string().min(1, "Queue Item ID is required"),
	}),
});

router.post("/admin/queue/:id/approve", validate(queueActionSchema), async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const queueItem = await prisma.manualReviewQueue.findUnique({ where: { id } });
		if (!queueItem) return res.status(404).json({ error: "Not found" });

		await prisma.$transaction(async (tx) => {
			// Update queue item
			await tx.manualReviewQueue.update({
				where: { id },
				data: { status: "APPROVED" },
			});

			// Update cycle status
			await tx.counsellingCycle.update({
				where: { id: queueItem.cycleId },
				data: {
					currentStatus: queueItem.proposedStatus,
					statusValidation: "VERIFIED",
				},
			});

			// Create audit log
			await tx.statusHistory.create({
				data: {
					cycleId: queueItem.cycleId,
					statusBefore: queueItem.currentStatus,
					statusAfter: queueItem.proposedStatus,
					sourceId: queueItem.sourceId,
					reason: "Manually approved by admin from review queue.",
				},
			});
		});

		res.json({ success: true });
	} catch (error) {
		res.status(500).json({ error: "Internal Server Error" });
	}
});

// POST /api/neet/admin/queue/:id/reject
router.post("/admin/queue/:id/reject", validate(queueActionSchema), async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		await prisma.manualReviewQueue.update({
			where: { id },
			data: { status: "REJECTED" },
		});
		res.json({ success: true });
	} catch (error) {
		res.status(500).json({ error: "Internal Server Error" });
	}
});

export default router;
