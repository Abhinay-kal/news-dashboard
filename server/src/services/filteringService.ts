import axios from "axios";
import * as cheerio from "cheerio";
import { normalizeText } from "../utils/textNormalizer";
import logger from "../utils/logger";

export const POSITIVE_KEYWORDS = [
	"Matrix Education",
	"Matrix Sikar",
	"Matrix Academy",
	"Matrix JEE",
	"Matrix NEET",
	"Matrix Olympiad",
	"Matrix Foundation",
	"Matrix High School",
	"Matrix scholarship test",
	"MOF",
	"CLC Sikar",
	"Choudhary Coaching",
	"Gurukripa Career Institute",
	"GCI Sikar",
	"Prince Career Pioneer",
	"PCP Sikar",
	"Prince Eduhub",
	"Navjeevan Sikar",
	"Tagore Sikar",
	"Kautilya Sikar",
	"Piprali Road",
	"Sikar Coaching",
	"Allen Sikar",
	"PW Sikar",
	"Physics Wallah Sikar",
	"Allen Career Institute",
	"Physics Wallah",
	"PW Vidyapeeth",
	"Aakash Institute",
	"Aakash BYJU",
	"Motion Education",
	"Nitin Vijay",
	"Resonance Kota",
	"Narayana Educational Institutions",
	"Sri Chaitanya",
	"FIITJEE",
	"Unacademy Centre",
	"Vibrant Academy",
	"National Testing Agency",
	"NTA",
	"JEE Main",
	"JEE Advanced",
	"NEET UG",
	"NEET 2026",
	"JoSAA",
	"CSAB",
	"Ministry of Education",
	"MoE",
	"UGC",
	"AICTE",
	"NCERT",
	"CBSE",
	"Medical Counselling Committee",
	"MCC",
	"Coaching guidelines",
	"Dummy school",
	"Non-attending school",
	"District Collector Sikar",
	"Sikar DM",
	"Sikar Hostel",
	"Hostel association Sikar",
	"Rajasthan coaching bill",
	"Rajasthan coaching regulation",
	"Mental health coaching",
	"Student suicide",
	"Fee refund policy",
	"Refund rules",
	"Fire NOC coaching",
	"Safety audit Sikar",
	"Supreme Court NEET",
	"Supreme Court JEE",
	"Rajasthan High Court",
	"PIL coaching",
	"CBI exam leak",
	"Paper leak",
	"सीकर कोचिंग",
	"मैट्रिक्स सीकर",
	"एनटीए ताज़ा खबर",
	"कोचिंग गाइडलाइन",
	"हॉस्टल नियम सीकर",
	"नीट परीक्षा",
	"जी मेन",

	// Bare brand/exam terms (catches hashtags like #ALLEN, #NEETUG, #JEE)
	"Allen",
	"Aakash",
	"Unacademy",
	"PW",
	"NEET",
	"Counselling",
	"Seat Allotment",
	"MBBS",
	"BDS",
	"Round 1",
	"Round 2",
	"Mop-up Round",
	"Stray Vacancy",
	"JEE",
	"IIT",
	"Joint Implementation Committee",
	"JIC",
	"Medical college",
	"NIOS",
	"RBSE",
	"Rajasthan Board of Secondary Education",
	"BSER",
	"Rajasthan Board",
	"CBSE",
	"Central Board of Secondary Education",
	"NEET UG AIQ",
	"Rajasthan NEET UG counselling",
	"Rajasthan NEET",
	"Rajasthan MBBS counselling",
	"Rajasthan Medical Counselling",
	"New policy in education sector",
	"Drastic changes in education sector",
	"NEP",
	"National Education Policy",
	"University Grants Commission",
	"All India Council for Technical Education",
	"State Board",
	"Education Board",
	"Joint Seat Allocation Authority",
	"Central Seat Allocation Board",
	"National Medical Commission",
	"NMC",
	"National Dental Commission",
	"NDC",
	"Admit card",
	"City slip",
	"City intimation",
	"Seat matrix",
	"Answer key",
	"Correction window",
	"Registration extended",
	"Dummy school",
	"Coaching regulation",
	"राजस्थान कोचिंग",
	"एडमिट कार्ड",
	"आंसर की",
	"अंतिम तिथि"
];

export const P0_OVERRIDE_KEYWORDS = [
	"National Education Policy",
	"NEP",
	"Ministry of Education",
	"MoE",
	"CBSE",
	"NTA",
	"National Testing Agency",
	"UGC",
	"University Grants Commission",
	"AICTE",
	"All India Council for Technical Education",
	"National Medical Commission",
	"NMC",
	"Medical Counselling Committee",
	"MCC",
	"JoSAA",
	"CSAB",
	"Special Stray Round",
	"Special Stray",
	"Stray Vacancy Round",
	"Stray Vacancy",
	"Consent Letter",
	"Consent Form",
	"Undertaking",
	"Round 4",
	"Round 5",
	"Merit List",
	"Provisional Merit List",
	"Provisional Allotment",
	"Seat Allotment Result",
	"Seat Matrix",
	"Reporting Schedule",
	"Reporting Date",
	"Choice Filling",
	"Resignation of Candidates",
	"Admit card released",
	"Admit card out",
	"City intimation slip",
	"Correction window",
	"Registration deadline extended",
	"Registration extended",
	"Seat matrix released",
	"Answer key challenge",
	"Coaching regulation bill",
	"Rajasthan coaching bill",
	"Coaching guidelines",
	"Dummy school inspection",
	"एडमिट कार्ड जारी",
	"कोचिंग गाइडलाइन",
	"कोचिंग बिल",
	"अंतिम तिथि बढ़ाई",
	"स्पेशल स्ट्रे राउंड",
	"स्ट्रे वैकेंसी",
	"सहमति पत्र",
	"सीट आवंटन"
];

export const MAIN_SITE_KEYWORDS = [
	"CBSE",
	"Central Board of Secondary Education",
	"RBSE",
	"Rajasthan Board of Secondary Education",
	"NEET UG AIQ",
	"MCC",
	"Rajasthan NEET UG counselling",
	"Rajasthan MBBS counselling",
	"JEE Main",
	"JEE Advanced",
	"New policy in education sector",
	"drastic changes in education sector",
	"NEP",
	"National Education Policy",
	"UGC",
	"University Grants Commission",
	"AICTE",
	"All India Council for Technical Education",
	"JoSAA",
	"Joint Seat Allocation Authority",
	"CSAB",
	"Central Seat Allocation Board",
	"NMC",
	"National Medical Commission",
	"NDC",
	"National Dental Commission",
	"Special Stray Round",
	"Stray Vacancy",
	"Consent Letter",
	"Undertaking",
	"Seat Matrix",
	"Merit List",
	"KEA",
	"CET Cell",
	"BCECEB",
	"DGME UP",
	"DME MP",
	"DMER Haryana",
	"WBMCC",
	"KNRUHS",
	"BFUHS",
	"ACPUGMEC",
	"NEET 2026",
	"NEET 2027",
	"JEE Main 2026",
	"JEE Main 2027",
	"JEE Advanced 2026",
	"JEE Advanced 2027"
];

export const NEGATIVE_KEYWORDS = [
	// SEO & Organic Search Spam
	"How to prepare for",
	"Sample paper PDF",
	"Answer key PDF download",
	"Chapter-wise weightage",
	"Best books for JEE",
	"Mock test series online buy",
	"Important questions for",
	"Cutoff prediction calculator",
	"Top 10 tips to crack",
	"How to crack",
	"Daily timetable",
	"Mistakes to avoid",
	"Download FREE",

	// Speculative & "No-Update" Clickbait
	"Expected Soon",
	"Check direct link",
	"Answer Key expected",
	"Is NEET UG result released",
	"Stay tuned on this page",

	// Unrelated Competitive Exams
	"NEET PG",
	"NEET-PG",
	"SSC CGL",
	"CHSL",
	"UPSC",
	"IBPS",
	"SBI PO",
	"RRB",
	"NDA",
	"CDS",
	"AFCAT",
	"REET",
	"CTET",
	"GATE",
	"CAT",
	"XAT",
	"MAT",
	"GRE",
	"GMAT",
	"IELTS",
	"TOEFL",
	"USMLE",
	"CLAT",
	"CA/CS/CMA",
	"UPPSC",
	"BPSC",

	// Private University Lead Generation
	"Direct admission",
	"low JEE percentile",
	"LPU",
	"Amity",
	"Chandigarh University",
	"Bennett",
	"Study MBBS in",
	"foreign engineering scholarships",

	// Non-Target Regional School Boards
	"UP Board",
	"BSEB",
	"MSBSHSE",
	"WBCHSE",
	"Karnataka SSLC",
	"MP Board",

	// Commercial PR & Ads
	"Why X Coaching is the best",
	"5 reasons to join",
	"Top 5 apps",
	"Best tablets",
	"Discount code",
	"Buy Allen test series",

	// Social Media Lead Traps
	"Join Telegram group",
	"WhatsApp group",
];

export function keywordRegex(keyword: string): RegExp | null {
	// Unicode-aware word boundary so both Latin (JEE, NEET) and Devanagari
	// (सीकर कोचिंग) keywords match, while empty patterns are skipped.
	const pattern = normalizeText(keyword);
	if (!pattern) return null;
	return new RegExp(`(?<![\\p{L}\\p{N}])${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "u");
}

/**
 * Evaluates whether an article is relevant based on positive and negative keyword matching.
 * Returns an object with `isRelevant` boolean and a `reason` string for logging.
 */
export async function evaluateArticleRelevance(
	title: string,
	contentSnippet: string,
): Promise<{ isRelevant: boolean; reason: string }> {
	// Normalize both the text and each keyword so hashtags (#NEETUG),
	// unicode-bold glyphs (𝐉𝐄𝐄), and punctuation (NEET (UG)) all match.
	const textToEvaluate = normalizeText(`${title} ${contentSnippet}`);

	// 0. Check for P0 Override Keywords (Always Accept, overrides negatives)
	for (const keyword of P0_OVERRIDE_KEYWORDS) {
		const regex = keywordRegex(keyword);
		if (regex && regex.test(textToEvaluate)) {
			return { isRelevant: true, reason: `Contains P0 override keyword: "${keyword}" (bypassing negative checks)` };
		}
	}

	// 1. Check for Negative Keywords (Hard Reject)
	for (const keyword of NEGATIVE_KEYWORDS) {
		const regex = keywordRegex(keyword);
		if (regex && regex.test(textToEvaluate)) {
			return { isRelevant: false, reason: `Contains negative keyword: "${keyword}"` };
		}
	}

	// 2. OpenRouter LLM Evaluation
	if (process.env.OPENROUTER_API_KEY) {
		try {
			const prompt = `Evaluate if this article is highly relevant to Indian education, NEET, JEE, or coaching institutes. Reply with 'YES' or 'NO' followed by a short reason.\n\nArticle Title: ${title}\nArticle Snippet: ${contentSnippet}`;

			const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
				model: process.env.OPENROUTER_MODEL || "google/gemma-4-26b-a4b-it:free",
				messages: [{ role: "user", content: prompt }]
			}, {
				headers: {
					"Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
					"Content-Type": "application/json"
				}
			});

			const reply = response.data.choices?.[0]?.message?.content?.trim() || "";
			if (reply.toUpperCase().startsWith("YES")) {
				return { isRelevant: true, reason: `LLM Approved: ${reply.substring(0, 100).replace(/\n/g, " ")}` };
			} else {
				return { isRelevant: false, reason: `LLM Rejected: ${reply.substring(0, 100).replace(/\n/g, " ")}` };
			}
		} catch (error: any) {
			logger.error({ error: error.message }, "[Filtering] OpenRouter API failed, falling back to keywords.");
		}
	}

	// 3. Fallback: Check for Positive Keywords (Accept)
	for (const keyword of POSITIVE_KEYWORDS) {
		const regex = keywordRegex(keyword);
		if (regex && regex.test(textToEvaluate)) {
			return { isRelevant: true, reason: `Contains positive keyword: "${keyword}"` };
		}
	}

	// 4. Default Reject (if it contains neither, it's likely noise)
	return { isRelevant: false, reason: "Does not contain any highly relevant positive keywords." };
}

/**
 * Checks if an article strictly belongs to the Main Site News category based on content.
 */
export function evaluateMainSiteRelevance(title: string, contentSnippet: string): boolean {
	const textToEvaluate = normalizeText(`${title} ${contentSnippet}`);
	for (const keyword of MAIN_SITE_KEYWORDS) {
		const regex = keywordRegex(keyword);
		if (regex && regex.test(textToEvaluate)) {
			return true;
		}
	}
	return false;
}

/**
 * Checks if an article was published within the last 48 hours.
 * 1. Checks the RSS feed date first.
 * 2. If RSS date passes, does a deep scrape of the URL's HTML meta tags to ensure it's truly recent.
 */
export async function isArticleRecent(
	pubDateStr?: string,
	url?: string,
	maxHours: number = 48
): Promise<{ isRecent: boolean; reason: string }> {
	const maxMilliseconds = maxHours * 60 * 60 * 1000;
	const now = Date.now();

	// Step 1: Fast RSS Date Check
	// NOTE: Google News RSS sets pubDate to re-index date, NOT original publish date.
	// So we only use RSS date as a "definitely old" signal — not a "definitely new" one.
	// UPDATE: To prevent false negatives from RSS caching/timezone bugs, an old RSS date 
	// is now treated as a warning, and we fallback to Step 2 (HTML Scrape) for the final verdict.
	let rssDateIsOld = false;
	if (pubDateStr) {
		const pubDate = new Date(pubDateStr).getTime();
		if (!isNaN(pubDate)) {
			if (now - pubDate > maxMilliseconds) {
				logger.info(`[Date Check] WARNING: RSS pubDate is older than ${maxHours} hours. Falling back to HTML scrape.`);
				rssDateIsOld = true;
			}
		}
	}

	// Step 2: Deep HTML Scrape Check (follows redirects to get real article URL)
	if (!url) {
		if (rssDateIsOld) return { isRecent: false, reason: `RSS pubDate is older than ${maxHours} hours and no URL to scrape.` };
		return { isRecent: true, reason: "Passed RSS check, no URL to deep scrape." };
	}

	try {
		// Follow all redirects (Google News URLs redirect to the real article)
		// maxRedirects: 5 ensures we land on the actual publisher's page
		const response = await axios.get(url, {
			timeout: 7000,
			maxRedirects: 5,
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			},
		});

		// The final URL after redirects is the real article URL
		const finalUrl = response.request?.res?.responseUrl || url;
		logger.info(`[Date Check] Resolved redirect: ${url.substring(0, 60)} -> ${finalUrl.substring(0, 60)}`);

		const $ = cheerio.load(response.data);

		// Extract date from standard SEO meta tags (publishers use these for Google indexing)
		const publishedTime =
			$('meta[property="article:published_time"]').attr("content") ||
			$('meta[name="pubdate"]').attr("content") ||
			$('meta[name="publishdate"]').attr("content") ||
			$('meta[name="date"]').attr("content") ||
			$('meta[itemprop="datePublished"]').attr("content") ||
			$('time[itemprop="datePublished"]').attr("datetime") ||
			$('time[class*="publish"]').attr("datetime") ||
			$("time").first().attr("datetime");

		if (publishedTime) {
			const scrapedDate = new Date(publishedTime).getTime();
			if (!isNaN(scrapedDate)) {
				if (now - scrapedDate > maxMilliseconds) {
					logger.info(`[Date Check] REJECTED: Article date is ${new Date(scrapedDate).toDateString()}`);
					return {
						isRecent: false,
						reason: `Scraped HTML date is older than ${maxHours} hours (${new Date(scrapedDate).toDateString()})`,
					};
				}
				logger.info(`[Date Check] ACCEPTED: Article date is ${new Date(scrapedDate).toDateString()}`);
				return { isRecent: true, reason: "HTML meta date verified as recent" };
			}
		}

		// No parseable date found
		if (rssDateIsOld) {
			logger.info(`[Date Check] REJECTED: No date found in HTML and RSS date is old`);
			return { isRecent: false, reason: `RSS pubDate is older than ${maxHours} hours and no date found in HTML` };
		}
		logger.info(`[Date Check] WARNING: No date found in HTML for ${finalUrl.substring(0, 60)} — defaulting to ACCEPT`);
		return { isRecent: true, reason: "Passed RSS check, no parsable date in HTML." };
	} catch (error: any) {
		logger.info(`[Date Check Warning] Could not scrape HTML for ${url.substring(0, 50)}... -> ${error.message}`);
		if (rssDateIsOld) {
			return { isRecent: false, reason: `RSS pubDate is older than ${maxHours} hours and HTML scrape failed` };
		}
		return { isRecent: true, reason: "Passed RSS check, HTML scrape failed (fallback to true)" };
	}
}
