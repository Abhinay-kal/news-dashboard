import logger from "./utils/logger";
logger.info("Loading index.ts...");
import cors from "cors";
logger.info("Loaded cors");
import dotenv from "dotenv";
logger.info("Loaded dotenv");
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
logger.info("Loaded express");
import mongoose from "mongoose";
logger.info("Loaded mongoose");
import http from "http";
logger.info("Loaded http");
import { Server } from "socket.io";
logger.info("Loaded socket.io");
import articleRoutes from "./routes/articleRoutes";
logger.info("Loaded articleRoutes");
import cron from "node-cron";
logger.info("Loaded node-cron");
import { spawn } from "child_process";
logger.info("Loaded child_process");
import Article from "./models/Article";
logger.info("Loaded Article model");
import { checkCriticalAlerts, sendQuietHoursSummaryEmail } from "./services/alertService";
logger.info("Loaded alertService");
import { checkDirectWebsites, captureP0Screenshots, pollCounsellingPortals, P0_TARGETS } from "./services/directScraperService";
logger.info("Loaded directScraperService");
import { runNeetMonitoringJob } from "./services/neetOrchestrator";
logger.info("Loaded neetOrchestrator");
import { triggerScrapeJob, getScrapingStatus } from "./services/queueService";
logger.info("Loaded queueService");
import neetRoutes from "./routes/neetRoutes";
import healthRoutes from "./routes/healthRoutes";
import monitorRoutes from "./routes/monitorRoutes";
import { seedOfficialPortals, initSiteDiffScheduler, cleanOrphanedScreenshots } from "./services/siteDiffService";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
	cors: { origin: "*" },
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet({
	crossOriginResourcePolicy: { policy: "cross-origin" },
	contentSecurityPolicy: false,
	hsts: false,
	crossOriginOpenerPolicy: false,
})); // Add security headers, but allow cross-origin images without forcing HTTPS in dev

// Rate limiting
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 1000, // limit each IP to 1000 requests per windowMs
	message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

app.use(cors()); // Allows our React frontend to talk to this API
app.use(express.json()); // Allows us to read JSON bodies in POST/PATCH requests

// Mount Routes
app.use("/api/articles", articleRoutes);
app.use("/api/neet", neetRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/monitor", monitorRoutes);

// Screenshots
const screenshotsDir = path.join(__dirname, "../data/screenshots");
if (!fs.existsSync(screenshotsDir)) {
	fs.mkdirSync(screenshotsDir, { recursive: true });
}
app.use("/screenshots", express.static(screenshotsDir));

app.get("/api/neet/screenshots", (req, res) => {
	try {
		const monitorsFile = path.join(__dirname, "../data/monitors.json");
		if (fs.existsSync(monitorsFile)) {
			try {
				const monitors = JSON.parse(fs.readFileSync(monitorsFile, "utf-8"));
				const results: any[] = [];
				for (const site of monitors) {
					for (const page of site.pages || []) {
						const monitorPng = `/screenshots/monitors/${page.id}.png`;
						const hasFile = fs.existsSync(path.join(screenshotsDir, "monitors", `${page.id}.png`));
						const shotUrl = page.currentScreenshot || (hasFile ? monitorPng : null);
						if (shotUrl) {
							const diffFile = path.join(screenshotsDir, "monitors", `${page.id}_diff.png`);
							const hasDiff = fs.existsSync(diffFile);
							results.push({
								name: page.name || site.name,
								url: shotUrl,
								diffUrl: page.diffScreenshot || (hasDiff ? `/screenshots/monitors/${page.id}_diff.png` : null),
								targetUrl: page.url,
								category: page.category || site.category || "national",
								lastUpdated: page.lastChecked || page.lastInspected || new Date().toISOString()
							});
						}
					}
				}
				if (results.length > 0) {
					return res.json(results);
				}
			} catch (err: any) {
				console.error("[Screenshots] Failed to read monitors.json:", err.message);
			}
		}

		if (!fs.existsSync(screenshotsDir)) {
			return res.json([]);
		}
		const files = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.png') && !f.includes('-diff'));
		const metadata = files.map(f => {
			const stat = fs.statSync(path.join(screenshotsDir, f));
			const name = f.replace('.png', '');
			const target = P0_TARGETS.find(t => t.name === name);
			return {
				name,
				url: `/screenshots/${f}`,
				diffUrl: fs.existsSync(path.join(screenshotsDir, f.replace('.png', '-diff.png'))) ? `/screenshots/${f.replace('.png', '-diff.png')}` : null,
				targetUrl: target ? target.url : null,
				category: target ? target.category : 'national',
				lastUpdated: stat.mtime
			};
		});
		res.json(metadata);
	} catch (error) {
		res.status(500).json({ error: "Failed to fetch screenshots" });
	}
});

app.get("/api/refresh/status", async (req, res) => {
	const status = await getScrapingStatus();
	res.json(status);
});

app.post("/api/refresh", async (req, res) => {
	const added = await triggerScrapeJob();
	if (!added) {
		return res.status(400).json({ message: "Scraping already in progress" });
	}
	res.json({ message: "Worker job started" });
});

// Database Connection
if (!process.env.MONGO_URI) {
	logger.error("MONGO_URI is not defined in .env file");
	process.exit(1);
}

app.post("/api/scrape-and-email", async (req, res) => {
	const added = await triggerScrapeJob(); // Note: email trigger needs to be refactored into worker if needed
	if (!added) {
		return res.status(400).json({ message: "Scraping already in progress" });
	}
	res.json({ message: "Worker job started" });
});

const checkMissedRun = async () => {
	try {
		const now = new Date();
		// Compute date and hour in Asia/Kolkata to match the 9:00 AM daily cron schedule
		const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
		const istHour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(now));

		// If the server starts and it is past 9 AM IST
		if (istHour >= 9) {
			const count = await Article.countDocuments({ runDate: today } as any);
			if (count === 0) {
				logger.info("[Startup Check] Past 9 AM IST and no articles found for today. Running catch-up job!");
				await triggerScrapeJob();
			}
		}
	} catch (error) {
		logger.error({ error: error }, "Error during startup check:");
	}
};

mongoose
	.connect(process.env.MONGO_URI)
	.then(() => {
		logger.info("Connected to MongoDB");
		checkMissedRun();
	})
	.catch((err) => logger.error({ error: err }, "MongoDB connection error:"));

// Automated Cron Job (Runs exactly at 9:00 AM if server is already running)
cron.schedule(
	"0 9 * * *",
	async () => {
		logger.info("[Cron] 9:00 AM reached.");
		logger.info("[Cron] Sending quiet hours summary email...");
		await sendQuietHoursSummaryEmail();
		await triggerScrapeJob();
	},
	{
		timezone: "Asia/Kolkata",
	} as any,
);

// Fast Polling Cron Job for P0 Alerts (Runs every hour)
cron.schedule("0 * * * *", () => {
	checkCriticalAlerts(io);
});

// Direct Web Polling and Screenshot Capture for P0 Alerts (Runs every hour at minute 30)
cron.schedule("30 * * * *", () => {
	checkDirectWebsites(io);
	captureP0Screenshots();
});

// High-Frequency 5-Minute Direct Poller for State Counselling Portals (Decoupled from Postgres)
cron.schedule("*/5 * * * *", () => {
	pollCounsellingPortals(io);
});

// Daily midnight screenshot garbage collection (48-hour rolling retention)
cron.schedule("0 0 * * *", () => {
	logger.info("[Cron] Running daily screenshot garbage collection...");
	cleanOrphanedScreenshots();
});

// Initialize Site Diff Monitor official portals & background hourly scheduler
seedOfficialPortals(false);
initSiteDiffScheduler(io);
cleanOrphanedScreenshots();

// TEST ENDPOINT — fire a fake P0 alert to verify the notification system
app.get("/api/test-alert", (req, res) => {
	const title = (req.query.title as string) || "🚨 P0 Test Alert: CEE Kerala NEET";
	const message = (req.query.message as string) || "Kerala NEET UG 2026 Round 2 seat allotment result published — check now!";
	const url = (req.query.url as string) || "https://cee.kerala.gov.in";
	io.emit("high-priority-alert", {
		title,
		message,
		url,
	});
	res.json({ success: true, message: "Test alert fired!", title });
});

server.listen(PORT, () => {
	logger.info(`Server running on port ${PORT}`);
});
