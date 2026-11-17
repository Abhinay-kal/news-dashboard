import * as cheerio from "cheerio";
import logger from "../utils/logger";

/**
 * SUMMARIZATION (Classical Text Extraction)
 * Extracts the first 3 valid sentences from the provided text or HTML.
 */
export async function generateSummary(text: string, isHtml: boolean = false): Promise<string[]> {
	logger.info("[Summarization] Extracting sentences deterministically...");

	try {
		let cleanText = text;

		if (isHtml) {
			try {
				const $ = cheerio.load(text);
				$("script, style, noscript, nav, footer, header").remove();
				cleanText = $("body").text().replace(/\s+/g, " ").trim();
				logger.info("[Summarization] Clean text extracted via cheerio");
			} catch (err) {
				logger.error({ error: err }, "[Summarization] Cheerio parsing failed:");
				cleanText = text.replace(/<[^>]+>/g, " ");
			}
		}

		// Basic sentence splitting (split by period, exclamation mark, or question mark followed by space or end of string)
		// We clean up newlines and extra spaces first to prevent weird sentence fragmentation.
		cleanText = cleanText
			.replace(/[\r\n]+/g, " ")
			.replace(/\s{2,}/g, " ")
			.trim();

		// Split on sentence boundaries
		const rawSentences = cleanText.match(/[^.!?]+[.!?]+(\s|$)/g) || [];

		const validSentences = rawSentences.map((s) => s.trim()).filter((s) => s.length > 20); // filter out short fragmented pieces like "Mr." or "Dr."

		const bullets: string[] = [];

		for (const sentence of validSentences) {
			bullets.push(sentence);
			if (bullets.length === 3) break;
		}

		// Fallback if we couldn't find ANY sentences
		if (bullets.length === 0) {
			bullets.push(cleanText.substring(0, 150) + "...");
		}

		return bullets;
	} catch (error) {
		logger.error({ error: error }, "[Summarization] Extraction Error:");
		return ["Failed to extract summary.", "An error occurred while parsing the text.", ""];
	}
}
