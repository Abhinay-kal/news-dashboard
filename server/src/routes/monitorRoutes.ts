import { Router } from "express";
import {
	getMonitoredSites,
	addMonitoredUrl,
	deleteSite,
	deletePage,
	capturePageDiff,
	captureSite,
	captureAllSites,
	markInspected,
	seedOfficialPortals,
	startBackgroundCaptureQueue,
	cleanOrphanedScreenshots,
} from "../services/siteDiffService";
import logger from "../utils/logger";

const router = Router();

// GET /api/monitor - List all monitored sites and pages
router.get("/", (_req, res) => {
	try {
		const sites = getMonitoredSites();
		res.json(sites);
	} catch (e: any) {
		logger.error(`[MonitorRoutes] Error getting sites: ${e.message}`);
		res.status(500).json({ error: e.message });
	}
});

// POST /api/monitor - Add a new monitored URL or page
router.post("/", (req, res) => {
	try {
		const { url, name, parentSiteId } = req.body;
		if (!url) {
			return res.status(400).json({ error: "URL is required" });
		}
		const result = addMonitoredUrl(url, name, parentSiteId);
		res.status(201).json(result);
	} catch (e: any) {
		logger.error(`[MonitorRoutes] Error adding URL: ${e.message}`);
		res.status(500).json({ error: e.message });
	}
});

// POST /api/monitor/check-all - Trigger full background sweep of all sites
router.post("/check-all", async (_req, res) => {
	try {
		const sites = await captureAllSites();
		res.json(sites);
	} catch (e: any) {
		logger.error(`[MonitorRoutes] Error in check-all: ${e.message}`);
		res.status(500).json({ error: e.message });
	}
});

// POST /api/monitor/seed-official - Seed official portals and queue captures
router.post("/seed-official", (_req, res) => {
	try {
		const sites = seedOfficialPortals(true);
		startBackgroundCaptureQueue().catch(() => {});
		res.json(sites);
	} catch (e: any) {
		logger.error(`[MonitorRoutes] Error seeding portals: ${e.message}`);
		res.status(500).json({ error: e.message });
	}
});

// POST /api/monitor/gc - Run immediate screenshot garbage collection (48h retention)
router.post("/gc", (_req, res) => {
	try {
		const result = cleanOrphanedScreenshots();
		res.json({ success: true, ...result });
	} catch (e: any) {
		logger.error(`[MonitorRoutes] Error running screenshot GC: ${e.message}`);
		res.status(500).json({ error: e.message });
	}
});

// POST /api/monitor/:siteId/pages/:pageId/check - Capture single page visual diff
router.post("/:siteId/pages/:pageId/check", async (req, res) => {
	try {
		const { siteId, pageId } = req.params;
		const page = await capturePageDiff(siteId, pageId);
		res.json(page);
	} catch (e: any) {
		logger.error(`[MonitorRoutes] Error checking page ${req.params.pageId}: ${e.message}`);
		res.status(500).json({ error: e.message });
	}
});

// POST /api/monitor/:siteId/check - Capture all pages of a site
router.post("/:siteId/check", async (req, res) => {
	try {
		const { siteId } = req.params;
		const site = await captureSite(siteId);
		res.json(site);
	} catch (e: any) {
		logger.error(`[MonitorRoutes] Error checking site ${req.params.siteId}: ${e.message}`);
		res.status(500).json({ error: e.message });
	}
});

// POST /api/monitor/:siteId/pages/:pageId/inspect - Mark page inspected (clear diff)
router.post("/:siteId/pages/:pageId/inspect", (req, res) => {
	try {
		const { siteId, pageId } = req.params;
		const resData = markInspected(siteId, pageId);
		res.json(resData);
	} catch (e: any) {
		logger.error(`[MonitorRoutes] Error inspecting page: ${e.message}`);
		res.status(500).json({ error: e.message });
	}
});

// POST /api/monitor/:siteId/inspect - Mark site inspected
router.post("/:siteId/inspect", (req, res) => {
	try {
		const { siteId } = req.params;
		const resData = markInspected(siteId);
		res.json(resData);
	} catch (e: any) {
		logger.error(`[MonitorRoutes] Error inspecting site: ${e.message}`);
		res.status(500).json({ error: e.message });
	}
});

// DELETE /api/monitor/:siteId/pages/:pageId - Remove monitored page
router.delete("/:siteId/pages/:pageId", (req, res) => {
	try {
		const { siteId, pageId } = req.params;
		const success = deletePage(siteId, pageId);
		res.json({ success });
	} catch (e: any) {
		logger.error(`[MonitorRoutes] Error deleting page: ${e.message}`);
		res.status(500).json({ error: e.message });
	}
});

// DELETE /api/monitor/:siteId - Remove monitored site
router.delete("/:siteId", (req, res) => {
	try {
		const { siteId } = req.params;
		const success = deleteSite(siteId);
		res.json({ success });
	} catch (e: any) {
		logger.error(`[MonitorRoutes] Error deleting site: ${e.message}`);
		res.status(500).json({ error: e.message });
	}
});

export default router;
