import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { Page } from "playwright";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import logger from "../utils/logger";

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
	category?: "national" | "counselling" | "iit";
	status: "idle" | "capturing" | "error";
	lastChecked?: string;
	lastInspected?: string;
	diffPercent: number;
	diffPixels: number;
	hasChange: boolean;
	isCosmeticOnly?: boolean;
	lastKnownLinks?: Array<{ text: string; href: string }>;
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
	category?: "national" | "counselling" | "iit";
	pages: MonitoredPage[];
	isSample?: boolean;
	lastInspected?: string;
}

export const OFFICIAL_TARGETS: Array<{
	name: string;
	url: string;
	category: "national" | "counselling" | "iit";
	siteId?: string;
	siteName?: string;
}> = [
	// National Authorities & CBSE Central
	{ name: "CBSE Main Portal", url: "https://www.cbse.gov.in/cbsenew/circulars.html", category: "national", siteId: "cbse", siteName: "CBSE" },
	{ name: "CBSE Results", url: "https://www.cbse.gov.in/cbsenew/cbse.html", category: "national", siteId: "cbse", siteName: "CBSE" },
	{ name: "CBSE Pariksha Sangam", url: "https://parikshasangam.cbse.gov.in/ps", category: "national", siteId: "cbse", siteName: "CBSE" },
	{ name: "CBSE Saras", url: "https://saras.cbse.gov.in/SARAS/Login/AffFirst", category: "national", siteId: "cbse", siteName: "CBSE" },
	{ name: "CBSE Academic", url: "https://cbseacademic.nic.in/circulars.html", category: "national", siteId: "cbse", siteName: "CBSE" },
	{ name: "CBSE Skill Education", url: "https://skilleducation.cbseit.in/", category: "national", siteId: "cbse", siteName: "CBSE" },
	{ name: "CBSE Training", url: "https://training.cbseit.in/ET/frmlisting", category: "national", siteId: "cbse", siteName: "CBSE" },
	{ name: "CSAB", url: "https://csab.nic.in/notices/", category: "national" },
	{ name: "JoSAA", url: "https://josaa.nic.in/notices/", category: "national" },
	{ name: "MCC", url: "https://mcc.nic.in/ug-medical-counselling/", category: "national" },
	{ name: "NMC", url: "https://nmc.org.in/whats-new", category: "national" },
	{ name: "NTA", url: "https://nta.ac.in/", category: "national" },
	{ name: "JEE Main (NTA)", url: "https://jeemain.nta.nic.in/public-notices/", category: "national" },
	{ name: "JEE Advanced", url: "https://jeeadv.ac.in/", category: "national" },
	{ name: "NEET UG (NTA)", url: "https://neet.nta.nic.in/public-notices/", category: "national" },
	{ name: "DigiLocker Results", url: "https://results.digilocker.gov.in/", category: "national" },
	{ name: "Raj Shala Darpan", url: "https://rajshaladarpan.rajasthan.gov.in/SD1/Home/Public2/Default.aspx", category: "national" },
	{ name: "RBSE", url: "https://rajeduboard.rajasthan.gov.in/main.asp", category: "national" },
	{ name: "UGC", url: "https://www.ugc.gov.in/Circulars", category: "national" },

	// 29 State Counselling Portals
	{ name: "Andhra Pradesh", url: "https://drntr.uhsap.in/index/", category: "counselling" },
	{ name: "Arunachal Pradesh", url: "https://apdhte.nic.in/", category: "counselling" },
	{ name: "Assam", url: "https://dme.assam.gov.in/", category: "counselling" },
	{ name: "Bihar", url: "https://bceceboard.bihar.gov.in/NoticeBoard.php", category: "counselling" },
	{ name: "Chhattisgarh", url: "https://cgdme.in/", category: "counselling" },
	{ name: "Goa", url: "https://dte.goa.gov.in/", category: "counselling" },
	{ name: "Gujarat", url: "https://www.medadmgujarat.org/ug/home.aspx", category: "counselling" },
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
	{ name: "Odisha", url: "https://ojee.nic.in/notices/", category: "counselling" },
	{ name: "Punjab", url: "https://bfuhs.ggsmch.org/", category: "counselling" },
	{ name: "Rajasthan", url: "https://ug.neetrajasthan.com/home", category: "counselling" },
	{ name: "Sikkim", url: "https://education.sikkim.gov.in/", category: "counselling" },
	{ name: "Tamil Nadu", url: "https://tnmedicalselection.net/notification.aspx", category: "counselling" },
	{ name: "Telangana", url: "https://www.knruhs.telangana.gov.in/all-notifications/", category: "counselling" },
	{ name: "Tripura", url: "https://trmcc.admissions.nic.in/notices/", category: "counselling" },
	{ name: "Uttar Pradesh", url: "https://dgme.up.gov.in/", category: "counselling" },
	{ name: "Uttarakhand", url: "https://www.hnbumu.ac.in/", category: "counselling" },
	{ name: "West Bengal", url: "https://wbmcc.nic.in/", category: "counselling" },

	// 23 IIT Institutes (Admissions & Announcement Boards)
	{ name: "IIT Bhilai", url: "https://www.iitbhilai.ac.in/index.php?pid=aca_admission", category: "iit" },
	{ name: "IIT Bhubaneswar", url: "https://www.iitbbs.ac.in/index.php/home/academics/admission/", category: "iit" },
	{ name: "IIT Bombay", url: "https://portal.iitb.ac.in/", category: "iit" },
	{ name: "IIT Delhi", url: "https://home.iitd.ac.in/", category: "iit" },
	{ name: "IIT Dharwad", url: "https://www.iitdh.ac.in/announcement", category: "iit" },
	{ name: "IIT (ISM) Dhanbad", url: "https://www.iitism.ac.in/all-active-notices", category: "iit" },
	{ name: "IIT Gandhinagar", url: "https://iitgn.ac.in/news", category: "iit" },
	{ name: "IIT Goa", url: "https://iitgoa.ac.in/news/", category: "iit" },
	{ name: "IIT Guwahati", url: "https://iitg.ac.in/acad/admission/", category: "iit" },
	{ name: "IIT Hyderabad", url: "https://iith.ac.in/", category: "iit" },
	{ name: "IIT Indore", url: "https://www.iiti.ac.in/admissions", category: "iit" },
	{ name: "IIT Jammu", url: "https://iitjammu.ac.in/announcements", category: "iit" },
	{ name: "IIT Jodhpur", url: "https://iitj.ac.in/main/en/admission-links", category: "iit" },
	{ name: "IIT Kanpur", url: "https://www.iitk.ac.in/announcements", category: "iit" },
	{ name: "IIT Kharagpur", url: "https://www.iitkgp.ac.in/iitkgp-announcements", category: "iit" },
	{ name: "IIT Madras", url: "https://www.iitm.ac.in/the-campus/announcements", category: "iit" },
	{ name: "IIT Mandi", url: "https://iitmandi.ac.in/", category: "iit" },
	{ name: "IIT Palakkad", url: "https://iitpkd.ac.in/news", category: "iit" },
	{ name: "IIT Patna", url: "https://www.iitp.ac.in/notices", category: "iit" },
	{ name: "IIT Roorkee", url: "https://iitr.ac.in/Academics/Admission.html", category: "iit" },
	{ name: "IIT Ropar", url: "https://www.iitrpr.ac.in/", category: "iit" },
	{ name: "IIT Tirupati", url: "https://www.iittp.ac.in/admissions", category: "iit" },
	{ name: "IIT (BHU) Varanasi", url: "https://iitbhu.ac.in/news", category: "iit" },
];

const DATA_DIR = path.resolve(process.cwd(), process.cwd().endsWith("server") ? "data" : "server/data");
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

	const browser = await chromium.launch({
		headless: true,
		args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
	});

	try {
		const context = await browser.newContext({
			ignoreHTTPSErrors: true,
			viewport: { width: 1280, height: 720 },
			locale: "en-US",
			userAgent:
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
			extraHTTPHeaders: {
				"Accept-Language": "en-US,en;q=0.9",
				"Sec-Ch-Ua": "\"Google Chrome\";v=\"131\", \"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"",
				"Sec-Ch-Ua-Mobile": "?0",
				"Sec-Ch-Ua-Platform": "\"macOS\"",
				"Upgrade-Insecure-Requests": "1",
			},
		});

		const pwPage: Page = await context.newPage();

		logger.info(`[SiteDiff] Capturing URL: ${page.url}`);
		let navSuccess = false;
		let navError: Error | null = null;
		try {
			await pwPage.goto(page.url, { waitUntil: "load", timeout: 15000 });
			navSuccess = true;
		} catch (e: any) {
			logger.warn(`[SiteDiff] Initial 'load' navigation timed out/failed for ${page.url}, retrying with domcontentloaded: ${e.message}`);
			try {
				await pwPage.goto(page.url, { waitUntil: "domcontentloaded", timeout: 10000 });
				navSuccess = true;
			} catch (e2: any) {
				navError = e2;
				logger.warn(`[SiteDiff] Fallback navigation failed for ${page.url}: ${e2.message}`);
			}
		}

		if (!navSuccess) {
			page.status = "error";
			page.errorMessage = navError?.message || "Navigation timeout or connection failure";
			saveMonitoredSites(sites);
			throw navError || new Error(`Failed to navigate to ${page.url}`);
		}

		// Wait 2.5s for dynamic content / SPA hydration
		await pwPage.waitForTimeout(2500);

		// Freeze CSS animations, transitions, and hide dynamic photo carousels/live clocks
		await pwPage.addStyleTag({
			content: `
				*, *::before, *::after {
					transition-property: none !important;
					transition: none !important;
					animation: none !important;
					animation-play-state: paused !important;
				}
				/* Hide non-content photo carousels, hero sliders, rotating banners, and live clocks */
				.carousel, .carousel-inner, .carousel-item,
				.slide, .slider, .bx-wrapper, .owl-carousel,
				.hero-slider, .flexslider, .swiper, .swiper-wrapper,
				.date-time, .time-widget, .live-clock, #clock, .clock, .timestamp,
				iframe, .ad-banner, .advertisement, [id*="google_ads"] {
					display: none !important;
					opacity: 0 !important;
					visibility: hidden !important;
				}
			`,
		}).catch(() => {});

		// Extract visible links & text to verify genuine notice additions vs cosmetic shift
		const visibleLinks: Array<{ text: string; href: string }> = await pwPage.evaluate(() => {
			const anchors = Array.from(document.querySelectorAll("a[href]"));
			return anchors.map(a => ({
				text: (a.textContent || "").trim().replace(/\s+/g, " "),
				href: (a as HTMLAnchorElement).href
			})).filter(a => a.text.length > 2 && !a.href.startsWith("javascript:"));
		}).catch(() => []);

		// Scan page source for commented document links so staged notices are recognized as genuine changes
		const pageHtml = await pwPage.content().catch(() => "");
		const commentRegex = /<!--([\s\S]*?)-->/g;
		let commentMatch: RegExpExecArray | null;
		while ((commentMatch = commentRegex.exec(pageHtml)) !== null) {
			const cText = commentMatch[1];
			if (cText && (cText.includes(".pdf") || cText.includes("<a"))) {
				const hrefMatches = cText.matchAll(/href=["']([^"']+\.pdf[^"']*)["']/gi);
				for (const hm of hrefMatches) {
					try {
						if (hm && hm[1]) {
							const absUrl = new URL(hm[1], page.url).href;
							visibleLinks.push({ text: `[Early Staged PDF] ${hm[1]}`, href: absUrl });
						}
					} catch (e) {}
				}
			}
		}

		const currentFileName = `${page.id}.png`;
		const currentFilePath = path.join(SCREENSHOTS_DIR, currentFileName);
		const baselineFilePath = path.join(SCREENSHOTS_DIR, `${page.id}_baseline.png`);
		const diffFilePath = path.join(SCREENSHOTS_DIR, `${page.id}_diff.png`);

		// Capture screenshot
		const newBuffer = await pwPage.screenshot({ fullPage: false, timeout: 8000 });

		// Safeguard: Never overwrite a valid screenshot (>10KB) with an empty white page (<6KB)
		const existingBaselineSize = fs.existsSync(baselineFilePath) ? fs.statSync(baselineFilePath).size : 0;
		const existingCurrentSize = fs.existsSync(currentFilePath) ? fs.statSync(currentFilePath).size : 0;
		if (newBuffer.length < 6000 && (existingBaselineSize > 10000 || existingCurrentSize > 10000)) {
			logger.warn(`[SiteDiff] Blank screenshot detected for ${page.url} (${newBuffer.length} bytes). Preserving existing valid capture.`);
			page.status = "idle";
			page.lastChecked = new Date().toISOString();
			saveMonitoredSites(sites);
			return page;
		}

		if (!fs.existsSync(baselineFilePath) || existingBaselineSize < 6000) {
			// Save as baseline and current if no baseline exists or baseline was a corrupted/blank image
			fs.writeFileSync(baselineFilePath, newBuffer);
			fs.writeFileSync(currentFilePath, newBuffer);

			page.baselineScreenshot = `/screenshots/monitors/${page.id}_baseline.png`;
			page.currentScreenshot = `/screenshots/monitors/${page.id}.png`;
			page.diffScreenshot = undefined;
			page.diffPercent = 0;
			page.diffPixels = 0;
			page.hasChange = false;
			page.isCosmeticOnly = false;
			page.isBlockedOrError = false;
			page.status = "idle";
			page.lastChecked = new Date().toISOString();
			if (visibleLinks.length > 0) {
				page.lastKnownLinks = visibleLinks.slice(0, 100);
			}
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

			const prevLinks = new Set((page.lastKnownLinks || []).map(l => l.href));
			const newLinks = visibleLinks.filter(l => !prevLinks.has(l.href));
			const hadPriorLinks = Boolean(page.lastKnownLinks && page.lastKnownLinks.length > 0);

			// Dual Verification Gate: If pixels changed but 0 new links/text appeared, flag as cosmetic
			const isPurelyCosmetic = hadPriorLinks && newLinks.length === 0;

			page.baselineScreenshot = `/screenshots/monitors/${page.id}_baseline.png`;
			page.currentScreenshot = `/screenshots/monitors/${page.id}.png`;
			page.diffScreenshot = `/screenshots/monitors/${page.id}_diff.png`;
			page.diffPixels = numDiffPixels;
			page.diffPercent = diffPercent;
			page.isCosmeticOnly = isPurelyCosmetic;
			page.hasChange = diffPercent > 0.05 && !isPurelyCosmetic;
			page.status = "idle";
			page.lastChecked = new Date().toISOString();
			if (visibleLinks.length > 0) {
				page.lastKnownLinks = visibleLinks.slice(0, 100);
			}

			// Visual Diff to Scraper Bridge: When visual change > 0.05% with genuine new content detected
			if (page.hasChange) {
				logger.info(`[SiteDiff Bridge] Genuine content change detected on ${page.name} (${newLinks.length} new links) — triggering auto-scrape!`);
				import("./directScraperService").then(({ scrapeSinglePortal }) => {
					scrapeSinglePortal(page.url).catch((err) => {
						logger.warn(`[SiteDiff Bridge] Auto-scrape failed for ${page.url}: ${err.message}`);
					});
				}).catch(() => {});
			} else if (isPurelyCosmetic && diffPercent > 0.05) {
				logger.info(`[SiteDiff Anti-Noise] Suppressed false-positive alarm for ${page.name}: ${diffPercent}% pixel diff, but 0 new links.`);
			}
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
 * Seed all Indian Education, State Counselling, and IIT Portals
 */
export function seedOfficialPortals(forceReset: boolean = false): MonitoredSite[] {
	ensureDirs();
	let sites = getMonitoredSites();
	if (forceReset || sites.length === 0 || sites.every((s) => s.id === "example-com" || s.id === "stripe-com" || s.id === "news-ycombinator-com")) {
		sites = [];
	}

	for (const target of OFFICIAL_TARGETS) {
		try {
			const parsed = new URL(target.url);
			const domain = parsed.hostname.replace(/^www\./, "");
			const pagePath = parsed.pathname + parsed.search;
			const pageId = crypto.createHash("md5").update(target.url).digest("hex").slice(0, 10);
			const targetSiteId = target.siteId || target.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
			const targetSiteName = target.siteName || target.name;

			const newPage: MonitoredPage = {
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

			let site = sites.find((s) => s.id === targetSiteId);
			if (!site) {
				site = {
					id: targetSiteId,
					name: targetSiteName,
					domain,
					rootUrl: `${parsed.protocol}//${parsed.host}/`,
					category: target.category,
					pages: [newPage],
				};
				sites.push(site);
			} else {
				// Update or replace primary page if URL changed
				const existingPageIndex = site.pages.findIndex((p) => p.name === target.name || p.id === pageId);
				if (existingPageIndex !== -1) {
					site.pages[existingPageIndex].url = target.url;
					site.pages[existingPageIndex].path = pagePath || "/";
					site.pages[existingPageIndex].id = pageId;
				} else {
					site.pages.push(newPage);
				}
			}
		} catch {
			// Skip invalid
		}
	}
	saveMonitoredSites(sites);
	logger.info(`[SiteDiff] Pre-seeded/updated ${sites.length} official national, state counselling, and IIT portals.`);
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

/**
 * 48-Hour Rolling Retention & Garbage Collection:
 * Removes stale or orphaned screenshot files not actively referenced by monitors.json
 * to permanently keep disk space capped under ~60MB.
 */
export function cleanOrphanedScreenshots(): { deletedCount: number; freedBytes: number } {
	ensureDirs();
	const sites = getMonitoredSites();
	const activeFileNames = new Set<string>();

	for (const site of sites) {
		for (const page of site.pages || []) {
			activeFileNames.add(`${page.id}.png`);
			activeFileNames.add(`${page.id}_baseline.png`);
			activeFileNames.add(`${page.id}_diff.png`);
		}
	}

	let deletedCount = 0;
	let freedBytes = 0;
	const now = Date.now();
	const MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours

	if (fs.existsSync(SCREENSHOTS_DIR)) {
		const files = fs.readdirSync(SCREENSHOTS_DIR);
		for (const file of files) {
			if (!file.endsWith(".png")) continue;
			const filePath = path.join(SCREENSHOTS_DIR, file);
			try {
				const stats = fs.statSync(filePath);
				const isOld = now - stats.mtimeMs > MAX_AGE_MS;
				// If file is not in activeFileNames OR is an orphaned capture older than 48h
				if (!activeFileNames.has(file) && isOld) {
					freedBytes += stats.size;
					fs.unlinkSync(filePath);
					deletedCount++;
				}
			} catch (e: any) {
				logger.warn(`[SiteDiff GC] Error checking file ${file}: ${e.message}`);
			}
		}
	}

	logger.info(`[SiteDiff GC] Purged ${deletedCount} orphaned screenshot files, freed ${(freedBytes / (1024 * 1024)).toFixed(2)} MB`);
	return { deletedCount, freedBytes };
}
