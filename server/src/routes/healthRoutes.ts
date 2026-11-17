import express from "express";
import SourceHealth from "../models/SourceHealth";
import logger from "../utils/logger";

const router = express.Router();

/**
 * GET /api/health/sources
 * Returns the health status of all scraped RSS feeds and sources.
 */
router.get("/sources", async (req, res) => {
	try {
		const healthData = await SourceHealth.find().sort({ updatedAt: -1 });
		res.json(healthData);
	} catch (error) {
		logger.error({ error: error }, "[Health API] Error fetching source health:");
		res.status(500).json({ error: "Server error fetching health data" });
	}
});

export default router;
