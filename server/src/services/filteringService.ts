import axios from "axios";
import * as cheerio from "cheerio";
import { normalizeText } from "../utils/textNormalizer";

export const POSITIVE_KEYWORDS = [
	"Matrix Education", "Matrix Sikar", "Matrix Academy", "Matrix JEE", "Matrix NEET",
	"Matrix Olympiad", "Matrix Foundation", "Matrix High School", "Matrix scholarship test", "MOF",
	"CLC Sikar", "Choudhary Coaching", "Gurukripa Career Institute", "GCI Sikar", "Prince Career Pioneer",
	"PCP Sikar", "Kautilya Sikar", "Allen Sikar", "PW Sikar", "Physics Wallah Sikar",
	"Allen Career Institute", "Physics Wallah", "PW Vidyapeeth", "Aakash Institute", "Aakash BYJU",
	"Motion Education", "Nitin Vijay", "Resonance Kota", "Narayana Educational Institutions", "Sri Chaitanya",
	"FIITJEE", "Unacademy Centre", "Vibrant Academy", "National Testing Agency", "NTA",
	"JEE Main", "JEE Advanced", "NEET UG", "NEET 2026", "JoSAA", "CSAB",
	"Ministry of Education", "MoE", "UGC", "AICTE", "NCERT", "CBSE",
	"Medical Counselling Committee", "MCC", "Coaching guidelines", "Dummy school", "Non-attending school",
	"District Collector Sikar", "Sikar DM", "Sikar Hostel", "Hostel association Sikar", "Rajasthan coaching bill",
	"Rajasthan coaching regulation", "Mental health coaching", "Student suicide", "Fee refund policy", "Refund rules",
	"Fire NOC coaching", "Safety audit Sikar", 	"Supreme Court NEET", "Supreme Court JEE", "Rajasthan High Court",
	"PIL coaching", "CBI exam leak", "Paper leak", "सीकर कोचिंग", "मैट्रिक्स सीकर",
	"एनटीए ताज़ा खबर", "कोचिंग गाइडलाइन", "हॉस्टल नियम सीकर", "नीट परीक्षा", "जी मेन",

	// Bare brand/exam terms (catches hashtags like #ALLEN, #NEETUG, #JEE)
	"Allen", "Aakash", "Unacademy", "PW", "NEET", "JEE", "NIOS",
];

export const NEGATIVE_KEYWORDS = [
	// SEO & Organic Search Spam
	"How to prepare for", "Sample paper PDF", "Answer key PDF download", "Chapter-wise weightage",
	"Best books for JEE", "Mock test series online buy", "Important questions for", "Cutoff prediction calculator",
	"Top 10 tips to crack", "How to crack", "Daily timetable", "Mistakes to avoid", "Download FREE",
	
	// Speculative & "No-Update" Clickbait
	"Expected Soon", "Check direct link", "Answer Key expected", "Is NEET UG result released", "Stay tuned on this page",
	
	// Unrelated Competitive Exams
	"SSC CGL", "CHSL", "UPSC", "IBPS", "SBI PO", "RRB", "NDA", "CDS", "AFCAT", "REET", "CTET",
	"GATE", "CAT", "XAT", "MAT", "GRE", "GMAT", "IELTS", "TOEFL", "USMLE", "CLAT", "CA/CS/CMA", "UPPSC", "BPSC",
	
	// Private University Lead Generation
	"Direct admission", "low JEE percentile", "LPU", "Amity", "Chandigarh University", "Bennett",
	"Study MBBS in", "foreign engineering scholarships",
	
	// Non-Target Regional School Boards
	"UP Board", "BSEB", "MSBSHSE", "WBCHSE", "Karnataka SSLC", "MP Board",
	
	// Commercial PR & Ads
	"Why X Coaching is the best", "5 reasons to join", "Top 5 apps", "Best tablets", "Discount code", "Buy Allen test series",
	
	// Social Media Lead Traps
	"Join Telegram group", "WhatsApp group"
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
export function evaluateArticleRelevance(title: string, contentSnippet: string): { isRelevant: boolean; reason: string } {
	// Normalize both the text and each keyword so hashtags (#NEETUG),
	// unicode-bold glyphs (𝐉𝐄𝐄), and punctuation (NEET (UG)) all match.
	const textToEvaluate = normalizeText(`${title} ${contentSnippet}`);

	// 1. Check for Negative Keywords (Hard Reject)
	for (const keyword of NEGATIVE_KEYWORDS) {
		const regex = keywordRegex(keyword);
		if (regex && regex.test(textToEvaluate)) {
			return { isRelevant: false, reason: `Contains negative keyword: "${keyword}"` };
		}
	}

	// 2. Check for Positive Keywords (Accept)
	for (const keyword of POSITIVE_KEYWORDS) {
		const regex = keywordRegex(keyword);
		if (regex && regex.test(textToEvaluate)) {
			return { isRelevant: true, reason: `Contains positive keyword: "${keyword}"` };
		}
	}

	// 3. Default Reject (if it contains neither, it's likely noise)
	return { isRelevant: false, reason: "Does not contain any highly relevant positive keywords." };
}

/**
 * Checks if an article was published within the last 48 hours.
 * 1. Checks the RSS feed date first.
 * 2. If RSS date passes, does a deep scrape of the URL's HTML meta tags to ensure it's truly recent.
 */
export async function isArticleRecent(pubDateStr?: string, url?: string): Promise<{ isRecent: boolean; reason: string }> {
	const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;
	const now = Date.now();

	// Step 1: Fast RSS Date Check
	// NOTE: Google News RSS sets pubDate to re-index date, NOT original publish date.
	// So we only use RSS date as a "definitely old" signal — not a "definitely new" one.
	if (pubDateStr) {
		const pubDate = new Date(pubDateStr).getTime();
		if (!isNaN(pubDate)) {
			if (now - pubDate > FORTY_EIGHT_HOURS) {
				return { isRecent: false, reason: "RSS pubDate is older than 48 hours" };
			}
		}
	}

	// Step 2: Deep HTML Scrape Check (follows redirects to get real article URL)
	if (!url) return { isRecent: true, reason: "Passed RSS check, no URL to deep scrape." };

	try {
		// Follow all redirects (Google News URLs redirect to the real article)
		// maxRedirects: 5 ensures we land on the actual publisher's page
		const response = await axios.get(url, { 
			timeout: 7000,
			maxRedirects: 5,
			headers: { 
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
			}
		});

		// The final URL after redirects is the real article URL
		const finalUrl = response.request?.res?.responseUrl || url;
		console.log(`[Date Check] Resolved redirect: ${url.substring(0, 60)} -> ${finalUrl.substring(0, 60)}`);

		const $ = cheerio.load(response.data);

		// Extract date from standard SEO meta tags (publishers use these for Google indexing)
		let publishedTime = 
			$('meta[property="article:published_time"]').attr('content') ||
			$('meta[name="pubdate"]').attr('content') ||
			$('meta[name="publishdate"]').attr('content') ||
			$('meta[name="date"]').attr('content') ||
			$('meta[itemprop="datePublished"]').attr('content') ||
			$('time[itemprop="datePublished"]').attr('datetime') ||
			$('time[class*="publish"]').attr('datetime') ||
			$('time').first().attr('datetime');

		if (publishedTime) {
			const scrapedDate = new Date(publishedTime).getTime();
			if (!isNaN(scrapedDate)) {
				if (now - scrapedDate > FORTY_EIGHT_HOURS) {
					console.log(`[Date Check] REJECTED: Article date is ${new Date(scrapedDate).toDateString()}`);
					return { isRecent: false, reason: `Scraped HTML date is older than 48 hours (${new Date(scrapedDate).toDateString()})` };
				}
				console.log(`[Date Check] ACCEPTED: Article date is ${new Date(scrapedDate).toDateString()}`);
				return { isRecent: true, reason: "HTML meta date verified as recent" };
			}
		}
		
		// No parseable date found — default ACCEPT (better to include than miss breaking news)
		console.log(`[Date Check] WARNING: No date found in HTML for ${finalUrl.substring(0, 60)} — defaulting to ACCEPT`);
		return { isRecent: true, reason: "Passed RSS check, no parsable date in HTML." };
	} catch (error: any) {
		console.log(`[Date Check Warning] Could not scrape HTML for ${url.substring(0, 50)}... -> ${error.message}`);
		return { isRecent: true, reason: "Passed RSS check, HTML scrape failed (fallback to true)" };
	}
}
