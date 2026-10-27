import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { URL } from "node:url";
import { json } from "node:stream/consumers";
import {
	getMonitoredSites,
	addMonitoredUrl,
	deleteSite,
	deletePage,
	capturePageDiff,
	captureSite,
	captureAllSites,
	initSiteDiffScheduler,
} from "./services/siteDiffService.ts";
import logger from "./utils/logger.ts";

const PORT = parseInt(process.env.PORT || "5002", 10);

const baseDir = typeof __dirname !== "undefined"
	? path.resolve(__dirname, "..")
	: path.resolve(process.cwd(), process.cwd().endsWith("server") ? "." : "server");
const screenshotsDir = path.join(baseDir, "data/screenshots");

function parseJsonBody(req: http.IncomingMessage): Promise<any> {
	return new Promise((resolve) => {
		const len = parseInt(req.headers["content-length"] || "0", 10);
		if (!len || req.method === "GET") {
			return resolve({});
		}
		let body = "";
		let received = 0;
		let resolved = false;

		const done = (data: any) => {
			if (!resolved) {
				resolved = true;
				resolve(data);
			}
		};

		req.setEncoding("utf8");
		req.on("data", (chunk) => {
			body += chunk;
			received += Buffer.byteLength(chunk);
			if (received >= len) {
				try {
					done(JSON.parse(body));
				} catch {
					done({});
				}
			}
		});
		req.on("end", () => {
			try {
				done(body ? JSON.parse(body) : {});
			} catch {
				done({});
			}
		});
		req.on("error", () => done({}));
	});
}

const server = http.createServer(async (req, res) => {
	const reqUrl = new URL(req.url || "/", `http://localhost:${PORT}`);
	const pathname = reqUrl.pathname;
	const method = req.method || "GET";
	logger.info(`[Incoming] ${method} ${pathname}`);

	// CORS Headers
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
	res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

	if (req.method === "OPTIONS") {
		res.writeHead(204);
		res.end();
		return;
	}

	try {
		// Health Check
		if (method === "GET" && pathname === "/health") {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ status: "ok", mode: "site-visual-diff-monitor" }));
			return;
		}

		// Socket.io mock response
		if (pathname.startsWith("/socket.io/")) {
			res.writeHead(204);
			res.end();
			return;
		}

		// Static screenshots
		if ((method === "GET" || method === "HEAD") && pathname.startsWith("/screenshots/")) {
			const relativePath = pathname.replace(/^\/screenshots\//, "");
			const filePath = path.join(screenshotsDir, relativePath);
			if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
				res.writeHead(200, {
					"Content-Type": "image/png",
					"Content-Length": fs.statSync(filePath).size,
				});
				if (method === "HEAD") {
					res.end();
					return;
				}
				fs.createReadStream(filePath).pipe(res);
				return;
			}
			res.writeHead(404, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: "Screenshot not found" }));
			return;
		}

		// GET /api/monitor
		if (method === "GET" && pathname === "/api/monitor") {
			const sites = getMonitoredSites();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(sites));
			return;
		}

		// POST /api/monitor
		if (method === "POST" && pathname === "/api/monitor") {
			const { url, name, parentSiteId } = await parseJsonBody(req);
			if (!url) {
				res.writeHead(400, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: "URL is required" }));
				return;
			}
			const result = addMonitoredUrl(url, name, parentSiteId);
			res.writeHead(201, { "Content-Type": "application/json" });
			res.end(JSON.stringify(result));
			return;
		}

		// POST /api/monitor/check-all
		if (method === "POST" && pathname === "/api/monitor/check-all") {
			const sites = await captureAllSites();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(sites));
			return;
		}

		// Route matching for /api/monitor/:siteId...
		const pageCheckMatch = pathname.match(/^\/api\/monitor\/([^/]+)\/pages\/([^/]+)\/check$/);
		if (method === "POST" && pageCheckMatch) {
			const [, siteId, pageId] = pageCheckMatch;
			const page = await capturePageDiff(siteId!, pageId!);
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(page));
			return;
		}

		const siteCheckMatch = pathname.match(/^\/api\/monitor\/([^/]+)\/check$/);
		if (method === "POST" && siteCheckMatch) {
			const [, siteId] = siteCheckMatch;
			const site = await captureSite(siteId!);
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(site));
			return;
		}

		const pageDeleteMatch = pathname.match(/^\/api\/monitor\/([^/]+)\/pages\/([^/]+)$/);
		if (method === "DELETE" && pageDeleteMatch) {
			const [, siteId, pageId] = pageDeleteMatch;
			const success = deletePage(siteId!, pageId!);
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ success }));
			return;
		}

		const siteDeleteMatch = pathname.match(/^\/api\/monitor\/([^/]+)$/);
		if (method === "DELETE" && siteDeleteMatch) {
			const [, siteId] = siteDeleteMatch;
			const success = deleteSite(siteId!);
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ success }));
			return;
		}

		// Fallback for legacy endpoints to keep legacy views quiet if visited
		if (pathname.startsWith("/api/neet/") || pathname.startsWith("/api/articles")) {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify([]));
			return;
		}

		// Not found
		res.writeHead(404, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ error: `Cannot ${method} ${pathname}` }));
	} catch (err: any) {
		logger.error(`[MonitorServer] Error processing ${method} ${pathname}: ${err.message}`);
		res.writeHead(500, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ error: err.message || "Internal server error" }));
	}
});

// Initialize background capture scheduler
initSiteDiffScheduler();

server.listen(PORT, () => {
	logger.info(`Site Visual Diff Monitor API listening on http://localhost:${PORT}`);
});
