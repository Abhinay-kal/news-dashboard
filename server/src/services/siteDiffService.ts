import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { Page } from "playwright";
import logger from "../utils/logger.ts";

export async function enableAxiosRouteFulfillment(page: Page) {
	await page.route("**/*", async (route) => {
		const req = route.request();
		const url = req.url();
		if (!url.startsWith("http://") && !url.startsWith("https://")) {
			return route.continue();
		}

		try {
			const res = await fetch(url, {
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
					Accept:
						req.headers()["accept"] ||
						"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
					"Accept-Language": "en-US,en;q=0.9",
					Referer: req.headers()["referer"] || url,
				},
			});

			const arrayBuffer = await res.arrayBuffer();
			await route.fulfill({
				status: res.status,
				headers: Object.fromEntries(res.headers.entries()),
				body: Buffer.from(arrayBuffer),
			});
		} catch {
			await route.continue();
		}
	});
}

export interface MonitoredPage {
	id: string;
	name: string;
	url: string;
	path: string;
	category?: "national" | "counselling";
	status: "idle" | "capturing" | "error";
	lastChecked?: string;
	lastInspected?: string;
	diffPercent: number;
	diffPixels: number;
	hasChange: boolean;
	isBlockedOrError: boolean;
	errorMessage?: string;
	currentScreenshot?: string;
	baselineScreenshot?: string;
	diffScreenshot?: string;
	historyCount?: number;
}

export interface MonitoredSite {
	id: string;
	name: string;
	domain: string;
	rootUrl: string;
	category?: "national" | "counselling";
	pages: MonitoredPage[];
	isSample?: boolean;
	lastInspected?: string;
}

export const OFFICIAL_TARGETS: Array<{ name: string; url: string; category: "national" | "counselling" }> = [
	// 8 National Authorities
	{ name: "CBSE", url: "https://www.cbse.gov.in/cbsenew/cbse.html", category: "national" },
	{ name: "CSAB", url: "https://csab.nic.in/", category: "national" },
	{ name: "JoSAA", url: "https://josaa.nic.in/", category: "national" },
	{ name: "MCC", url: "https://mcc.nic.in/", category: "national" },
	{ name: "NMC", url: "https://www.nmc.org.in/", category: "national" },
	{ name: "NTA", url: "https://nta.ac.in/NoticeBoard", category: "national" },
	{ name: "RBSE", url: "https://rajeduboard.rajasthan.gov.in/", category: "national" },
	{ name: "UGC", url: "https://www.ugc.gov.in/", category: "national" },
	// 29 State Counselling Portals
	{ name: "Andhra Pradesh", url: "https://drntr.uhsap.in/index/", category: "counselling" },
	{ name: "Arunachal Pradesh", url: "https://apdhte.nic.in/", category: "counselling" },
	{ name: "Assam", url: "https://dme.assam.gov.in/", category: "counselling" },
	{ name: "Bihar", url: "https://bceceboard.bihar.gov.in/", category: "counselling" },
	{ name: "Chhattisgarh", url: "https://cgdme.in/", category: "counselling" },
	{ name: "Goa", url: "https://dte.goa.gov.in/", category: "counselling" },
	{ name: "Gujarat", url: "https://www.medadmgujarat.org/", category: "counselling" },
	{ name: "Haryana", url: "https://dmer.haryana.gov.in/", category: "counselling" },
	{ name: "Himachal Pradesh", url: "https://amruhp.ac.in/", category: "counselling" },
	{ name: "Jharkhand", url: "https://jceceb.jharkhand.gov.in/", category: "counselling" },
	{ name: "Karnataka", url: "https://cetonline.karnataka.gov.in/kea/", category: "counselling" },
	{ name: "Kerala", url: "https://cee.kerala.gov.in/cee/index.php", category: "counselling" },
	{ name: "Madhya Pradesh", url: "https://dme.mponline.gov.in/Portal/Services/DMEMP/DMEUG/Profile/ProfileLoginHome.aspx", category: "counselling" },
	{ name: "Maharashtra", url: "https://cetcell.mahacet.org/", category: "counselling" },
	{ name: "Manipur", url: "https://manipurhealthdirectorate.mn.gov.in/", category: "counselling" },
	{ name: "Meghalaya", url: "https://www.meghealth.gov.in/", category: "counselling" },
	{ name: "Mizoram", url: "https://dhte.mizoram.gov.in/", category: "counselling" },
	{ name: "Nagaland", url: "https://dte.nagaland.gov.in/", category: "counselling" },
	{ name: "Odisha", url: "https://ojee.nic.in/", category: "counselling" },
	{ name: "Punjab", url: "https://bfuhs.ggsmch.org/", category: "counselling" },
	{ name: "Rajasthan", url: "https://ug.neetrajasthan.com/home", category: "counselling" },
	{ name: "Sikkim", url: "https://statequota.sikkim.gov.in/", category: "counselling" },
	{ name: "Tamil Nadu", url: "https://tnmedicalselection.net/", category: "counselling" },
	{ name: "Telangana", url: "https://www.knruhs.telangana.gov.in/", category: "counselling" },
	{ name: "Tripura", url: "https://trmcc.admissions.nic.in/", category: "counselling" },
	{ name: "Uttar Pradesh", url: "https://dgme.up.gov.in/", category: "counselling" },
	{ name: "Uttarakhand", url: "https://www.hnbumu.ac.in/", category: "counselling" },
	{ name: "West Bengal", url: "https://wbmcc.nic.in/", category: "counselling" },
];

const DATA_DIR = path.resolve(process.cwd(), "server/data");
const MONITORS_FILE = path.join(DATA_DIR, "monitors.json");
const SCREENSHOTS_DIR = path.join(DATA_DIR, "screenshots", "monitors");

// Ensure directories exist
function ensureDirs() {
	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}
	if (!fs.existsSync(SCREENSHOTS_DIR)) {
		fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
	}
	if (!fs.existsSync(MONITORS_FILE)) {
		fs.writeFileSync(MONITORS_FILE, JSON.stringify([], null, 2), "utf-8");
	}
}

/**
 * Load all monitored sites
 */
export function getMonitoredSites(): MonitoredSite[] {
	ensureDirs();
	try {
		const raw = fs.readFileSync(MONITORS_FILE, "utf-8");
		return JSON.parse(raw) as MonitoredSite[];
	} catch (err: any) {
		logger.error(`[SiteDiff] Error reading monitors file: ${err.message}`);
		return [];
	}
}

/**
 * Save monitored sites
 */
export function saveMonitoredSites(sites: MonitoredSite[]): void {
	ensureDirs();
	fs.writeFileSync(MONITORS_FILE, JSON.stringify(sites, null, 2), "utf-8");
}

/**
 * Add a URL to monitor. If parentSiteId is given or domain exists, group under it.
 */
export function addMonitoredUrl(url: string, name?: string, parentSiteId?: string): { site: MonitoredSite; page: MonitoredPage } {
	const sites = getMonitoredSites();

	let parsedUrl: URL;
	try {
		parsedUrl = new URL(url.startsWith("http") ? url : `https://${url}`);
	} catch {
		throw new Error("Invalid URL format");
	}

	const domain = parsedUrl.hostname.replace(/^www\./, "");
	const pagePath = parsedUrl.pathname + parsedUrl.search;
	const pageId = crypto.createHash("md5").update(parsedUrl.href).digest("hex").slice(0, 10);

	let site = parentSiteId
		? sites.find((s) => s.id === parentSiteId)
		: sites.find((s) => s.domain === domain);

	if (!site) {
		const siteId = domain.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
		site = {
			id: siteId,
			name: name || domain,
			domain,
			rootUrl: `${parsedUrl.protocol}//${parsedUrl.host}/`,
			pages: [],
		};
		sites.push(site);
	}

	// Check if page already exists
	let page = site.pages.find((p) => p.id === pageId || p.url === parsedUrl.href);
	if (!page) {
		page = {
			id: pageId,
			name: name || (pagePath === "/" || pagePath === "" ? "Homepage" : pagePath),
			url: parsedUrl.href,
			path: pagePath || "/",
			status: "idle",
			diffPercent: 0,
			diffPixels: 0,
			hasChange: false,
			isBlockedOrError: false,
		};
		site.pages.push(page);
	} else if (name) {
		page.name = name;
	}

	saveMonitoredSites(sites);
	return { site, page };
}

/**
 * Delete a specific sub-page
 */
export function deletePage(siteId: string, pageId: string): boolean {
	const sites = getMonitoredSites();
	const site = sites.find((s) => s.id === siteId);
	if (!site) return false;

	site.pages = site.pages.filter((p) => p.id !== pageId);
	if (site.pages.length === 0) {
		// If no pages left, delete the site too
		const index = sites.findIndex((s) => s.id === siteId);
		if (index !== -1) sites.splice(index, 1);
	}
	saveMonitoredSites(sites);
	return true;
}

/**
 * Delete an entire site and its sub-pages
 */
export function deleteSite(siteId: string): boolean {
	let sites = getMonitoredSites();
	const prevLen = sites.length;
	sites = sites.filter((s) => s.id !== siteId);
	saveMonitoredSites(sites);
	return sites.length < prevLen;
}

/**
 * Mark a site or page as inspected with current timestamp
 */
export function markInspected(siteId: string, pageId?: string): { site: MonitoredSite | null; page?: MonitoredPage | null } {
	const sites = getMonitoredSites();
	const site = sites.find((s) => s.id === siteId);
	if (!site) return { site: null };

	const now = new Date().toISOString();
	site.lastInspected = now;

	let inspectedPage: MonitoredPage | undefined;
	if (pageId) {
		inspectedPage = site.pages.find((p) => p.id === pageId);
		if (inspectedPage) {
			inspectedPage.lastInspected = now;
		}
	} else if (site.pages.length > 0) {
		site.pages[0].lastInspected = now;
		inspectedPage = site.pages[0];
	}

	saveMonitoredSites(sites);
	return { site, page: inspectedPage };
}

/**
 * Perform a Playwright capture and compute pixel diff
 */
export async function capturePageDiff(siteId: string, pageId: string): Promise<MonitoredPage> {
	ensureDirs();
	const sites = getMonitoredSites();
	const site = sites.find((s) => s.id === siteId);
	if (!site) throw new Error(`Site ${siteId} not found`);

	const page = site.pages.find((p) => p.id === pageId);
	if (!page) throw new Error(`Page ${pageId} not found`);

	page.status = "capturing";
	saveMonitoredSites(sites);

	// Dynamic requires for zero-overhead startup
	const { createRequire } = await import("module");
	const req = createRequire(import.meta.url || __filename);
	const { chromium } = req("playwright");
	const { PNG } = req("pngjs");
	const pixelmatch = req("pixelmatch");

	const browser = await chromium.launch({
		headless: true,
		args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
	});

	try {
		const context = await browser.newContext({
			viewport: { width: 1280, height: 720 },
			userAgent:
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
		});

		const pwPage: Page = await context.newPage();

		logger.info(`[SiteDiff] Capturing URL: ${page.url}`);
		await pwPage.goto(page.url, { waitUntil: "load", timeout: 15000 }).catch(async () => {
			await pwPage.goto(page.url, { waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => {});
		});
		await pwPage.waitForTimeout(1000);

		// Freeze CSS animations
		await pwPage.addStyleTag({
			content: `
				*, *::before, *::after {
					transition-property: none !important;
					animation: none !important;
				}
			`,
		}).catch(() => {});

		const currentFileName = `${page.id}.png`;
		const currentFilePath = path.join(SCREENSHOTS_DIR, currentFileName);
		const baselineFilePath = path.join(SCREENSHOTS_DIR, `${page.id}_baseline.png`);
		const diffFilePath = path.join(SCREENSHOTS_DIR, `${page.id}_diff.png`);

		// Capture screenshot
		const newBuffer = await pwPage.screenshot({ fullPage: false });

		if (!fs.existsSync(baselineFilePath)) {
			// First run: save as both baseline and current
			fs.writeFileSync(baselineFilePath, newBuffer);
			fs.writeFileSync(currentFilePath, newBuffer);

			page.baselineScreenshot = `/screenshots/monitors/${page.id}_baseline.png`;
			page.currentScreenshot = `/screenshots/monitors/${page.id}.png`;
			page.diffScreenshot = undefined;
			page.diffPercent = 0;
			page.diffPixels = 0;
			page.hasChange = false;
			page.isBlockedOrError = false;
			page.status = "idle";
			page.lastChecked = new Date().toISOString();
		} else {
			// Diff against existing baseline
			fs.writeFileSync(currentFilePath, newBuffer);
			const baseImg = PNG.sync.read(fs.readFileSync(baselineFilePath));
			const currImg = PNG.sync.read(newBuffer);

			const width = Math.min(baseImg.width, currImg.width);
			const height = Math.min(baseImg.height, currImg.height);
			const diff = new PNG({ width, height });

			// Highlight differences in bold red [239, 68, 68]
			const numDiffPixels = pixelmatch(baseImg.data, currImg.data, diff.data, width, height, {
				threshold: 0.1,
				diffColor: [239, 68, 68],
				alpha: 0.8,
			});

			fs.writeFileSync(diffFilePath, PNG.sync.write(diff));

			const totalPixels = width * height;
			const diffPercent = Math.round((numDiffPixels / totalPixels) * 1000) / 10;

			page.baselineScreenshot = `/screenshots/monitors/${page.id}_baseline.png`;
			page.currentScreenshot = `/screenshots/monitors/${page.id}.png`;
			page.diffScreenshot = `/screenshots/monitors/${page.id}_diff.png`;
			page.diffPixels = numDiffPixels;
			page.diffPercent = diffPercent;
			page.hasChange = diffPercent > 0.05;
			page.status = "idle";
			page.lastChecked = new Date().toISOString();
		}

		saveMonitoredSites(sites);
		logger.info(`[SiteDiff] Finished capture for ${page.url} (Diff: ${page.diffPercent}%)`);
		return page;
	} catch (err: any) {
		logger.error(`[SiteDiff] Capture failed for ${page.url}: ${err.message}`);
		page.status = "error";
		page.errorMessage = err.message;
		saveMonitoredSites(sites);
		throw err;
	} finally {
		await browser.close().catch(() => {});
	}
}

/**
 * Capture all pages for a specific site
 */
export async function captureSite(siteId: string): Promise<MonitoredSite | null> {
	const sites = getMonitoredSites();
	const site = sites.find((s) => s.id === siteId);
	if (!site) return null;

	for (const page of site.pages) {
		try {
			await capturePageDiff(site.id, page.id);
		} catch (err: any) {
			logger.warn(`[SiteDiff] Failed to capture ${page.url}: ${err.message}`);
		}
	}
	const updated = getMonitoredSites().find((s) => s.id === siteId);
	return updated || site;
}

/**
 * Capture all monitored sites and pages
 */
export async function captureAllSites(): Promise<MonitoredSite[]> {
	logger.info("[SiteDiff] Starting capture for all monitored sites...");
	const sites = getMonitoredSites();
	for (const site of sites) {
		for (const page of site.pages) {
			try {
				await capturePageDiff(site.id, page.id);
			} catch (err: any) {
				logger.warn(`[SiteDiff] Failed to capture ${page.url}: ${err.message}`);
			}
		}
	}
	logger.info("[SiteDiff] Completed capture for all monitored sites.");
	return getMonitoredSites();
}

/**
 * Seed all 37 Indian Education & State Counselling Portals
 */
export function seedOfficialPortals(forceReset: boolean = false): MonitoredSite[] {
	ensureDirs();
	let sites = getMonitoredSites();
	if (forceReset || sites.length === 0 || sites.every((s) => s.id === "example-com" || s.id === "stripe-com" || s.id === "news-ycombinator-com")) {
		sites = [];
		for (const target of OFFICIAL_TARGETS) {
			try {
				const parsed = new URL(target.url);
				const domain = parsed.hostname.replace(/^www\./, "");
				const pagePath = parsed.pathname + parsed.search;
				const pageId = crypto.createHash("md5").update(target.url).digest("hex").slice(0, 10);
				const siteId = target.name.toLowerCase().replace(/[^a-z0-9]/g, "-");

				const page: MonitoredPage = {
					id: pageId,
					name: target.name,
					url: target.url,
					path: pagePath || "/",
					category: target.category,
					status: "idle",
					diffPercent: 0,
					diffPixels: 0,
					hasChange: false,
					isBlockedOrError: false,
				};

				sites.push({
					id: siteId,
					name: target.name,
					domain,
					rootUrl: `${parsed.protocol}//${parsed.host}/`,
					category: target.category,
					pages: [page],
				});
			} catch {
				// Skip invalid
			}
		}
		saveMonitoredSites(sites);
		logger.info(`[SiteDiff] Pre-seeded ${sites.length} official national & state counselling portals.`);
	}
	return sites;
}

let isQueueRunning = false;
/**
 * Progressive background capture queue for all portals
 */
export async function startBackgroundCaptureQueue(): Promise<void> {
	if (isQueueRunning) return;
	isQueueRunning = true;
	logger.info("[SiteDiff] Starting sequential background capture queue for all portals...");
	const sites = getMonitoredSites();
	for (const site of sites) {
		for (const page of site.pages) {
			if (!page.currentScreenshot || page.status === "error") {
				try {
					await capturePageDiff(site.id, page.id);
					// Gentle 1.5s pause to prevent government IP blocking
					await new Promise((resolve) => setTimeout(resolve, 1500));
				} catch (err: any) {
					logger.warn(`[SiteDiff Queue] Skipped ${page.name} (${page.url}): ${err.message}`);
				}
			}
		}
	}
	isQueueRunning = false;
	logger.info("[SiteDiff] Sequential background capture queue completed.");
}

/**
 * Schedule background hourly diff check
 */
export function initSiteDiffScheduler(io?: any) {
	const intervalMinutes = 60;
	setInterval(async () => {
		try {
			logger.info("[SiteDiff Scheduler] Running automated hourly site diff checks...");
			const sites = await captureAllSites();
			if (io) {
				io.emit("monitored-sites-updated", sites);
			}
		} catch (err: any) {
			logger.error(`[SiteDiff Scheduler] Periodic check failed: ${err.message}`);
		}
	}, intervalMinutes * 60 * 1000);
}
