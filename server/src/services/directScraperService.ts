import axios from "axios";
import * as cheerio from "cheerio";
import crypto from "crypto";
import { Server } from "socket.io";
import Article from "../models/Article";
import { getStringSimilarity } from "../utils/similarity";
import { POSITIVE_KEYWORDS, P0_OVERRIDE_KEYWORDS, MAIN_SITE_KEYWORDS } from "./filteringService";
import logger from "../utils/logger";
import https from "https";
import { chromium, Browser } from "playwright";
import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

export interface PortalTarget {
  name: string;
  url: string;
  selector: string;
  category: "national" | "counselling" | "iit";
  isSpa?: boolean;
}

export const P0_TARGETS: PortalTarget[] = [
  { name: "NTA", url: "https://nta.ac.in/", selector: "table a, ul a, .gen-list a, a", category: "national" },
  { name: "JEE Main", url: "https://jeemain.nta.nic.in/public-notices/", selector: "table a, ul a, .gen-list a, a", category: "national" },
  { name: "JEE Advanced", url: "https://jeeadv.ac.in/", selector: "table a, ul a, .announcement a, a", category: "national" },
  { name: "NEET UG", url: "https://neet.nta.nic.in/public-notices/", selector: "table a, ul a, .gen-list a, a", category: "national" },
  { name: "CBSE", url: "https://www.cbse.gov.in/cbsenew/circulars.html", selector: "table a, ul a, a", category: "national" },
  { name: "CBSE Results", url: "https://www.cbse.gov.in/cbsenew/cbse.html", selector: "table a, ul a, a", category: "national" },
  { name: "CBSE Pariksha Sangam", url: "https://parikshasangam.cbse.gov.in/ps", selector: "table a, a", category: "national" },
  { name: "CBSE Saras", url: "https://saras.cbse.gov.in/SARAS/Login/AffFirst", selector: "table a, a", category: "national" },
  { name: "CBSE Academic", url: "https://cbseacademic.nic.in/circulars.html", selector: "table a, ul a, a", category: "national" },
  { name: "CBSE Skill Education", url: "https://skilleducation.cbseit.in/", selector: "table a, ul a, .card a, a", category: "national", isSpa: true },
  { name: "CBSE Training", url: "https://training.cbseit.in/ET/frmlisting", selector: "table a, ul a, a", category: "national" },
  { name: "DigiLocker Results", url: "https://results.digilocker.gov.in/", selector: "table a, ul a, a", category: "national" },
  { name: "Raj Shala Darpan", url: "https://rajshaladarpan.rajasthan.gov.in/SD1/Home/Public2/Default.aspx", selector: "marquee a, table a, ul a, a", category: "national" },
  { name: "MCC", url: "https://mcc.nic.in/ug-medical-counselling/", selector: "table a, ul a, a", category: "national" },
  { name: "JoSAA", url: "https://josaa.nic.in/notices/", selector: "table a, ul a, a", category: "national" },
  { name: "CSAB", url: "https://csab.nic.in/notices/", selector: "table a, ul a, a", category: "national" },
  { name: "NMC", url: "https://nmc.org.in/whats-new", selector: "table a, ul a, a", category: "national" },
  { name: "UGC", url: "https://www.ugc.gov.in/Circulars", selector: "table a, ul a, a", category: "national", isSpa: true },
  { name: "RBSE", url: "https://rajeduboard.rajasthan.gov.in/main.asp", selector: "table a, ul a, a", category: "national" },
  { name: "Andhra Pradesh", url: "https://drntr.uhsap.in/index/", selector: "marquee a, table a, ul a, a", category: "counselling" },
  { name: "Arunachal Pradesh", url: "https://apdhte.nic.in/", selector: "table a, ul a, a", category: "counselling" },
  { name: "Assam", url: "https://dme.assam.gov.in/", selector: "table a, ul a, a", category: "counselling" },
  { name: "Bihar", url: "https://bceceboard.bihar.gov.in/NoticeBoard.php", selector: "table a, .notice a, ul a, a", category: "counselling" },
  { name: "Chhattisgarh", url: "https://cgdme.in/", selector: "marquee a, table a, ul a, a", category: "counselling" },
  { name: "Goa", url: "https://dte.goa.gov.in/", selector: "table a, ul a, a", category: "counselling" },
  { name: "Gujarat", url: "https://www.medadmgujarat.org/ug/home.aspx", selector: "table a, ul a, a", category: "counselling" },
  { name: "Haryana", url: "https://dmer.haryana.gov.in/", selector: "marquee a, table a, ul a, a", category: "counselling" },
  { name: "Himachal Pradesh", url: "https://amruhp.ac.in/", selector: "table a, ul a, a", category: "counselling" },
  { name: "Jharkhand", url: "https://jceceb.jharkhand.gov.in/", selector: "marquee a, table a, ul a, a", category: "counselling" },
  { name: "Karnataka", url: "https://cetonline.karnataka.gov.in/kea/", selector: "table a, ul a, a", category: "counselling" },
  { name: "Kerala", url: "https://cee.kerala.gov.in/cee/index.php", selector: "table a, ul a, a", category: "counselling" },
  { name: "Madhya Pradesh", url: "https://dme.mponline.gov.in/Portal/Services/DMEMP/DMEUG/Profile/ProfileLoginHome.aspx", selector: "table a, ul a, a", category: "counselling" },
  { name: "Maharashtra", url: "https://cetcell.mahacet.org/", selector: "table a, ul a, a", category: "counselling" },
  { name: "Manipur", url: "https://manipurhealthdirectorate.mn.gov.in/", selector: "marquee a, table a, ul a, a", category: "counselling" },
  { name: "Meghalaya", url: "https://www.meghealth.gov.in/", selector: "table a, ul a, a", category: "counselling" },
  { name: "Mizoram", url: "https://dhte.mizoram.gov.in/", selector: "table a, ul a, a", category: "counselling" },
  { name: "Nagaland", url: "https://dte.nagaland.gov.in/", selector: "table a, ul a, a", category: "counselling" },
  { name: "Odisha", url: "https://ojee.nic.in/notices/", selector: "table a, ul a, a", category: "counselling" },
  { name: "Punjab", url: "https://bfuhs.ggsmch.org/", selector: "table a, ul a, a", category: "counselling" },
  { name: "Rajasthan", url: "https://ug.neetrajasthan.com/home", selector: "table a, ul a, a", category: "counselling", isSpa: true },
  { name: "Sikkim", url: "https://education.sikkim.gov.in/", selector: "table a, ul a, a", category: "counselling" },
  { name: "Tamil Nadu", url: "https://tnmedicalselection.net/notification.aspx", selector: "table a, ul a, a", category: "counselling" },
  { name: "Telangana", url: "https://www.knruhs.telangana.gov.in/all-notifications/", selector: "table a, ul a, a", category: "counselling" },
  { name: "Tripura", url: "https://trmcc.admissions.nic.in/notices/", selector: "table a, ul a, a", category: "counselling" },
  { name: "Uttar Pradesh", url: "https://dgme.up.gov.in/", selector: "table a, ul a, .title-newsinfo a, a", category: "counselling" },
  { name: "Uttarakhand", url: "https://www.hnbumu.ac.in/", selector: "marquee a, table a, ul a, a", category: "counselling" },
  { name: "West Bengal", url: "https://wbmcc.nic.in/", selector: "table a, ul a, a", category: "counselling" },
  // 23 IITs
  { name: "IIT Bhilai", url: "https://www.iitbhilai.ac.in/index.php?pid=aca_admission", selector: "table a, ul a, a", category: "iit" },
  { name: "IIT Bhubaneswar", url: "https://www.iitbbs.ac.in/index.php/home/academics/admission/", selector: "table a, ul a, a", category: "iit" },
  { name: "IIT Bombay", url: "https://portal.iitb.ac.in/", selector: "table a, ul a, .portal-card, a", category: "iit" },
  { name: "IIT Delhi", url: "https://home.iitd.ac.in/", selector: "table a, ul a, a", category: "iit" },
  { name: "IIT Dharwad", url: "https://www.iitdh.ac.in/announcement", selector: "table a, ul a, a", category: "iit" },
  { name: "IIT (ISM) Dhanbad", url: "https://www.iitism.ac.in/all-active-notices", selector: "table a, ul a, a", category: "iit" },
  { name: "IIT Gandhinagar", url: "https://iitgn.ac.in/news", selector: "table a, ul a, a", category: "iit" },
  { name: "IIT Goa", url: "https://iitgoa.ac.in/news/", selector: "table a, ul a, a", category: "iit" },
  { name: "IIT Guwahati", url: "https://iitg.ac.in/acad/admission/", selector: "header a, nav a, table a, ul a, a", category: "iit" },
  { name: "IIT Hyderabad", url: "https://iith.ac.in/", selector: "table a, ul a, a", category: "iit" },
  { name: "IIT Indore", url: "https://www.iiti.ac.in/admissions", selector: "table a, ul a, a", category: "iit" },
  { name: "IIT Jammu", url: "https://iitjammu.ac.in/announcements", selector: "table a, ul a, a", category: "iit", isSpa: true },
  { name: "IIT Jodhpur", url: "https://iitj.ac.in/main/en/admission-links", selector: "table a, ul a, a", category: "iit" },
  { name: "IIT Kanpur", url: "https://www.iitk.ac.in/announcements", selector: "table a, ul a, a", category: "iit" },
  { name: "IIT Kharagpur", url: "https://www.iitkgp.ac.in/iitkgp-announcements", selector: "table a, ul a, a", category: "iit" },
  { name: "IIT Madras", url: "https://www.iitm.ac.in/the-campus/announcements", selector: "table a, ul a, a", category: "iit" },
  { name: "IIT Mandi", url: "https://iitmandi.ac.in/", selector: "table a, ul a, a", category: "iit" },
  { name: "IIT Palakkad", url: "https://iitpkd.ac.in/news", selector: "table a, ul a, a", category: "iit" },
  { name: "IIT Patna", url: "https://www.iitp.ac.in/notices", selector: "table a, ul a, a", category: "iit" },
  { name: "IIT Roorkee", url: "https://iitr.ac.in/Academics/Admission.html", selector: "table a, ul a, a", category: "iit" },
  { name: "IIT Ropar", url: "https://www.iitrpr.ac.in/", selector: "table a, ul a, a", category: "iit", isSpa: true },
  { name: "IIT Tirupati", url: "https://www.iittp.ac.in/admissions", selector: "table a, ul a, a", category: "iit", isSpa: true },
  { name: "IIT (BHU) Varanasi", url: "https://iitbhu.ac.in/news", selector: "table a, ul a, a", category: "iit" },
];

export interface PortalHealth {
  name: string;
  url: string;
  status: "live_http" | "live_playwright" | "degraded" | "blocked" | "soft_404";
  lastChecked: string;
  extractedCount: number;
  error?: string;
}

const portalHealthRegistry: Record<string, PortalHealth> = {};

export function getPortalHealthStatus(): PortalHealth[] {
  return Object.values(portalHealthRegistry);
}

export interface NoticeLink {
  text: string;
  href: string;
  isEarlyNotice?: boolean;
}

const latestNotices: Record<string, NoticeLink[]> = {};
let pendingAlerts: any[] = [];
let debounceTimer: NodeJS.Timeout | null = null;

function flushAlerts(io: Server) {
  if (pendingAlerts.length === 0) return;
  logger.info(`[DirectScraper] Flushing ${pendingAlerts.length} batched alerts!`);
  io.emit("high-priority-batch", pendingAlerts);
  pendingAlerts.forEach(alert => {
    io.emit("high-priority-alert", alert);
  });
  pendingAlerts = [];
  debounceTimer = null;
}

/**
 * Hydrate dynamic HTML using a headless Playwright browser instance
 */
async function hydrateWithPlaywright(url: string): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1280, height: 720 },
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2500);
    const content = await page.content();
    return content;
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * Context-Aware Link Extractor that bypasses nav/footer traps and inspects parent rows
 */
export function extractNoticesFromHtml(
  htmlData: string,
  target: PortalTarget,
  allSystemKeywords: string[]
): NoticeLink[] {
  const $ = cheerio.load(htmlData);

  // Soft 404 check
  const title = $("title").text().toLowerCase();
  const bodyText = $("body").text().toLowerCase();
  const isSoft404 =
    title.includes("404") ||
    title.includes("not found") ||
    bodyText.includes("404 - file or directory not found") ||
    bodyText.includes("robot-error") ||
    bodyText.includes("page not found");

  if (isSoft404) {
    logger.warn(`[DirectScraper] Soft-404 detected on ${target.name} (${target.url})`);
    return [];
  }

  // Document-preserving filter: Only purge pure social & generic widgets, NEVER layout containers with documents
  $(".social-icons, .share-buttons, #accessibilityMenu, .bhashiniLangDropdown, .fontSizeAnnouncer").remove();

  const skipTexts = [
    "accessibility", "skip to main content", "screen reader", "high contrast",
    "normal contrast", "follow us", "like us", "login", "government of india",
    "भारत सरकार", "ministry of", "twitter", "facebook", "instagram", "youtube",
    "whatsapp", "menu", "home", "about us", "contact us", "privacy policy", "terms of use"
  ];

  const validExtracted: NoticeLink[] = [];
  const seenHrefs = new Set<string>();

  $(target.selector).each((_, el) => {
    let linkText = $(el).text().trim().replace(/\s+/g, " ");
    const href = $(el).attr("href");

    if (!href || href === "#" || href.startsWith("javascript:")) return;
    if (href === "/" || href === "/index.html") return;

    const isDocLink = href.toLowerCase().includes(".pdf") ||
                      href.toLowerCase().includes(".doc") ||
                      href.toLowerCase().includes(".aspx?") ||
                      href.toLowerCase().includes(".php?");

    // Parent row inspection for short or icon-only anchor text ("Click Here", "PDF", "Download", "View")
    if (linkText.length < 15) {
      const parentRow = $(el)
        .closest("tr, li, .card, .item, .news-item, .title-newsinfo, .table-row")
        .text()
        .trim()
        .replace(/\s+/g, " ");
      if (parentRow.length >= 15) {
        linkText = parentRow;
      }
    }

    if (linkText.length < 15 && !isDocLink) return;
    if (!isDocLink && skipTexts.some(skip => linkText.toLowerCase().includes(skip))) return;

    const absoluteUrl = href.startsWith("http") ? href : new URL(href, target.url).href;
    if (seenHrefs.has(absoluteUrl)) return;
    seenHrefs.add(absoluteUrl);

    // Keyword match
    const meetsKeyword = allSystemKeywords.some(kw => linkText.toLowerCase().includes(kw)) || isDocLink;
    if (meetsKeyword) {
      validExtracted.push({ text: linkText, href: absoluteUrl });
    }
  });

  // Ticker and Marquee Text Extraction for urgent text-only announcements (e.g. Shala Darpan)
  $("marquee, .ticker, .announcement-text, .breaking-news").each((_, el) => {
    const tickerText = $(el).text().trim().replace(/\s+/g, " ");
    if (tickerText.length >= 20 && !skipTexts.some(skip => tickerText.toLowerCase().includes(skip))) {
      const meetsKeyword = allSystemKeywords.some(kw => tickerText.toLowerCase().includes(kw));
      if (meetsKeyword) {
        const hash = crypto.createHash("md5").update(tickerText).digest("hex").slice(0, 8);
        const tickerUrl = `${target.url}#ticker-${hash}`;
        if (!seenHrefs.has(tickerUrl)) {
          seenHrefs.add(tickerUrl);
          validExtracted.push({ text: `[TICKER] ${tickerText}`, href: tickerUrl });
        }
      }
    }
  });

  return validExtracted.slice(0, 50); // Scan and track up to 50 notices per portal
}

/**
 * Extracts staged / early circulars and PDF notices buried within HTML comments <!-- ... -->
 * and verifies that the file is live (HTTP 200..399) and recent (uploaded within last 72h or dated current month/year).
 */
export async function extractCommentedPdfNotices(
  htmlData: string,
  target: PortalTarget,
  allSystemKeywords: string[]
): Promise<NoticeLink[]> {
  const commentRegex = /<!--([\s\S]*?)-->/g;
  let match: RegExpExecArray | null;
  const candidates: { text: string; href: string }[] = [];
  const seenHrefs = new Set<string>();

  while ((match = commentRegex.exec(htmlData)) !== null) {
    const comment = match[1];
    if (!comment || (!comment.includes("<a") && !comment.includes(".pdf") && !comment.includes(".doc"))) {
      continue;
    }

    const $ = cheerio.load(comment);
    $("a").each((_, el) => {
      const href = $(el).attr("href");
      if (!href || href === "#" || href.startsWith("javascript:")) return;

      let linkText = $(el).text().trim().replace(/\s+/g, " ");
      if (linkText.length < 10) {
        linkText = $(el).parent().text().trim().replace(/\s+/g, " ");
      }

      const isDoc = href.toLowerCase().includes(".pdf") ||
                    href.toLowerCase().includes(".doc") ||
                    href.toLowerCase().includes(".docx");

      if (!isDoc) return;

      try {
        const absoluteUrl = href.startsWith("http") ? href : new URL(href, target.url).href;
        if (!seenHrefs.has(absoluteUrl)) {
          seenHrefs.add(absoluteUrl);
          candidates.push({ text: linkText, href: absoluteUrl });
        }
      } catch (err) {}
    });
  }

  if (candidates.length === 0) {
    return [];
  }

  // Fast concurrent verification (max 5s timeout per check)
  const verifiedEarlyNotices: NoticeLink[] = [];
  const maxAgeHours = 72; // Only notices modified or published within last 72 hours
  const nowMs = Date.now();
  const currentYear = new Date().getFullYear().toString();

  await Promise.all(
    candidates.map(async (candidate) => {
      try {
        let isLive = false;
        let lastModStr: string | undefined;

        try {
          const headRes = await axios.head(candidate.href, {
            timeout: 5000,
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
            },
            maxRedirects: 5,
          });
          if (headRes.status >= 200 && headRes.status < 400) {
            isLive = true;
            lastModStr = headRes.headers["last-modified"];
          }
        } catch (headErr) {
          // Fallback to GET with small byte range in case server disallows HEAD
          try {
            const getRes = await axios.get(candidate.href, {
              timeout: 5000,
              httpsAgent: new https.Agent({ rejectUnauthorized: false }),
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
                Range: "bytes=0-100",
              },
              maxRedirects: 5,
            });
            if (getRes.status >= 200 && getRes.status < 400) {
              isLive = true;
              lastModStr = getRes.headers["last-modified"];
            }
          } catch (getErr) {}
        }

        if (!isLive) return;

        // Recency validation: Prevent old historical commented archives from triggering alerts
        let isRecent = false;
        if (lastModStr) {
          const modTime = new Date(lastModStr).getTime();
          const ageHours = (nowMs - modTime) / (1000 * 60 * 60);
          if (ageHours <= maxAgeHours) {
            isRecent = true;
          }
        } else {
          // If no Last-Modified header, check if candidate contains current year and no older year
          const hasCurrentYear = candidate.href.includes(currentYear) || candidate.text.includes(currentYear);
          const hasPastYear = candidate.href.includes("2024") || candidate.href.includes("2025") || candidate.text.includes("2024") || candidate.text.includes("2025");
          if (hasCurrentYear && !hasPastYear) {
            isRecent = true;
          }
        }

        if (isRecent) {
          logger.info(`[DirectScraper] Early staged notice verified live (HTTP 200) on ${target.name}: ${candidate.text} (${candidate.href})`);
          verifiedEarlyNotices.push({
            text: `[EARLY NOTICE] ${candidate.text}`,
            href: candidate.href,
            isEarlyNotice: true,
          });
        }
      } catch (err: any) {
        // Safe skip on connection errors
      }
    })
  );

  return verifiedEarlyNotices;
}

/**
 * Scrape a single portal immediately (e.g. triggered by visual diff or manual check)
 */
export async function scrapeSinglePortal(targetNameOrUrl: string, io?: Server): Promise<number> {
  const target = P0_TARGETS.find(t => t.name === targetNameOrUrl || t.url === targetNameOrUrl);
  if (!target) {
    logger.warn(`[DirectScraper] Target not found for single scrape: ${targetNameOrUrl}`);
    return 0;
  }

  const allSystemKeywords = [
    ...POSITIVE_KEYWORDS,
    ...P0_OVERRIDE_KEYWORDS,
    ...MAIN_SITE_KEYWORDS,
    "notice", "circular", "notification", "consent", "undertaking", "allotment", "stray", "merit list", "seat matrix", "counselling", "counseling", "admission", "schedule", "mbbs", "bds", "result", "results", "examination", "exam", "timetable", "time-table", "admit card", "score card", "scrutiny", "cutoff", "cut-off", "reporting", "choice filling", "bulletin", "guidelines", "information", "eligibility"
  ].map(k => k.toLowerCase());

  let htmlData = "";
  let mode: "live_http" | "live_playwright" = "live_http";

  try {
    if (target.isSpa) {
      mode = "live_playwright";
      htmlData = await hydrateWithPlaywright(target.url);
    } else {
      try {
        const response = await axios.get(target.url, {
          timeout: 18000,
          httpsAgent: new https.Agent({ rejectUnauthorized: false }),
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          },
        });
        htmlData = response.data;
        if (
          typeof htmlData === "string" &&
          (htmlData.includes("<app-root") ||
            htmlData.includes('id="root"><') ||
            htmlData.includes('id="__next"><') ||
            htmlData.includes("<frameset"))
        ) {
          mode = "live_playwright";
          htmlData = await hydrateWithPlaywright(target.url);
        }
      } catch (err: any) {
        mode = "live_playwright";
        htmlData = await hydrateWithPlaywright(target.url);
      }
    }

    let notices: NoticeLink[] = extractNoticesFromHtml(htmlData, target, allSystemKeywords);

    // Staged / Early Notice Discovery: Scan HTML comments for un-published but live PDFs
    try {
      const earlyNotices = await extractCommentedPdfNotices(htmlData, target, allSystemKeywords);
      if (earlyNotices.length > 0) {
        logger.info(`[DirectScraper] Discovered ${earlyNotices.length} early staged notice(s) on ${target.name}!`);
        notices = [...earlyNotices, ...notices];
      }
    } catch (commentErr: any) {
      logger.warn(`[DirectScraper] Comment scanner encountered error on ${target.name}: ${commentErr.message}`);
    }

    // If 0 notices and not yet run via Playwright, try Playwright fallback
    if (notices.length === 0 && mode === "live_http") {
      try {
        mode = "live_playwright";
        htmlData = await hydrateWithPlaywright(target.url);
        notices = extractNoticesFromHtml(htmlData, target, allSystemKeywords);
        const earlyFallback = await extractCommentedPdfNotices(htmlData, target, allSystemKeywords);
        if (earlyFallback.length > 0) {
          notices = [...earlyFallback, ...notices];
        }
      } catch (e) {}
    }

    portalHealthRegistry[target.name] = {
      name: target.name,
      url: target.url,
      status: mode,
      lastChecked: new Date().toISOString(),
      extractedCount: notices.length,
    };

    if (notices.length > 0) {
      const previousLinks = latestNotices[target.name] || [];
      for (const newLink of notices) {
        const isNew = !previousLinks.some(prev => prev.href === newLink.href || getStringSimilarity(prev.text, newLink.text) > 0.85);
        if (isNew) {
          logger.info(`[DirectScraper] New notice found on ${target.name}: ${newLink.text}`);
          const existing = await Article.findOne({ sourceUrl: newLink.href });
          if (!existing) {
            const isEarly = Boolean(newLink.isEarlyNotice);
            const cleanText = newLink.text.replace(/^\[EARLY NOTICE\]\s*/, "");
            const articleTitle = isEarly
              ? `[EARLY NOTICE] ${target.name} Official Notice: ${cleanText}`
              : `[ALERT] ${target.name} Official Notice: ${newLink.text}`;

            await Article.create({
              title: articleTitle,
              sourceUrl: newLink.href,
              topicCategory: "P0_ALERT",
              summary: [
                isEarly
                  ? `[EARLY NOTICE DETECTED] Staged circular detected in portal source comments and verified live (HTTP 200): ${cleanText}`
                  : `Immediate alert from official website direct polling: ${newLink.text}`
              ],
              status: "APPROVED",
              postStatus: "PENDING",
              runDate: new Date().toISOString().split("T")[0],
              urgencyScore: 95,
            });

            if (io) {
              pendingAlerts.push({
                title: isEarly ? `🚨 P0 [EARLY NOTICE]: ${target.name}` : `P0 Alert: ${target.name} Official Notice`,
                message: cleanText,
                url: newLink.href,
              });
              if (!debounceTimer) {
                debounceTimer = setTimeout(() => flushAlerts(io), 2000);
              }
            }
          }
        }
      }
      latestNotices[target.name] = notices;
    }

    return notices.length;
  } catch (err: any) {
    portalHealthRegistry[target.name] = {
      name: target.name,
      url: target.url,
      status: "degraded",
      lastChecked: new Date().toISOString(),
      extractedCount: 0,
      error: err.message,
    };
    return 0;
  }
}

/**
 * High-frequency 5-minute poller for state counselling portals.
 * Uses tiered concurrency:
 * 1) Fast parallel HTTP requests for static portals (batch size 5).
 * 2) Concurrency-controlled Playwright runner for SPAs (Rajasthan).
 */
export async function pollCounsellingPortals(io: Server) {
  const counsellingTargets = P0_TARGETS.filter(t => t.category === "counselling");
  logger.info(`[DirectScraper] Starting 5-minute high-frequency poll for ${counsellingTargets.length} counselling portals...`);

  const staticTargets = counsellingTargets.filter(t => !t.isSpa);
  const spaTargets = counsellingTargets.filter(t => t.isSpa);

  // 1. Process static targets concurrently in chunks of 5
  const chunkSize = 5;
  for (let i = 0; i < staticTargets.length; i += chunkSize) {
    const chunk = staticTargets.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (target) => {
        try {
          await scrapeSinglePortal(target.name, io);
        } catch (err: any) {
          logger.error(`[DirectScraper] Error in 5-min poll for ${target.name}: ${err.message}`);
        }
      })
    );
  }

  // 2. Process SPA targets sequentially to preserve memory
  for (const target of spaTargets) {
    try {
      await scrapeSinglePortal(target.name, io);
    } catch (err: any) {
      logger.error(`[DirectScraper] Error in 5-min SPA poll for ${target.name}: ${err.message}`);
    }
  }

  logger.info("[DirectScraper] Completed 5-minute counselling poll.");
}

/**
 * Scheduled check across all P0 targets
 */
export async function checkDirectWebsites(io: Server) {
  logger.info("[DirectScraper] Running fast-polling for all official P0 websites...");
  for (const target of P0_TARGETS) {
    try {
      await scrapeSinglePortal(target.name, io);
    } catch (error: any) {
      logger.error(`[DirectScraper] Error scraping ${target.name}: ${error.message}`);
    }
  }
}

export async function captureP0Screenshots() {
  logger.info("[DirectScraper] Starting hourly P0 screenshot capture...");

  const screenshotsDir = path.join(__dirname, "../../data/screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1280, height: 720 },
      locale: "en-US",
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    });

    for (const target of P0_TARGETS) {
      try {
        const page = await context.newPage();
        await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(2500);

        const filePath = path.join(screenshotsDir, `${target.name}.png`);
        const diffPath = path.join(screenshotsDir, `${target.name}-diff.png`);

        let oldImg: PNG | null = null;
        if (fs.existsSync(filePath)) {
          try {
            oldImg = PNG.sync.read(fs.readFileSync(filePath));
          } catch (e) {}
        }

        const imgBuffer = await page.screenshot({ type: "png" });
        fs.writeFileSync(filePath, imgBuffer);

        if (oldImg) {
          const newImg = PNG.sync.read(imgBuffer);
          const { width, height } = newImg;
          const diff = new PNG({ width, height });

          try {
            pixelmatch(oldImg.data, newImg.data, diff.data, width, height, { threshold: 0.1, diffColor: [255, 0, 0] });
            fs.writeFileSync(diffPath, PNG.sync.write(diff));
          } catch (e) {}
        }

        await page.close();
      } catch (err: any) {
        logger.error(`[DirectScraper] Failed to screenshot ${target.name}: ${err.message}`);
      }
    }
  } catch (error: any) {
    logger.error(`[DirectScraper] Error initializing playwright: ${error.message}`);
  } finally {
    if (browser) await browser.close();
    logger.info("[DirectScraper] Screenshot capture complete.");
  }
}
