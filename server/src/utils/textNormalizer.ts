/**
 * Normalizes text for keyword matching.
 *
 * Handles the formats commonly found in tweets and social media that break
 * word-boundary keyword matching:
 *  - Unicode bold/italic glyphs (e.g. 𝐉𝐄𝐄) -> ASCII (JEE)
 *  - Hashtags (#NEETUG, #LiveWebinar) -> spaced tokens
 *  - Punctuation (NEET (UG), JEE/NEET) -> spaces
 *  - Mixed-case glued words (NIOSBoard) -> spaced tokens
 *
 * Non-Latin scripts (e.g. Devanagari) are preserved so Hindi keywords still match.
 */
export function normalizeText(text: string): string {
	return text
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/#/g, " ")
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
		.replace(/[^\p{L}\p{N}\p{M}\s]+/gu, " ")
		.replace(/\s+/g, " ")
		.toLowerCase()
		.trim();
}
