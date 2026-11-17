import Article from "../models/Article";
import stringSimilarity from "string-similarity";
import natural from "natural";
import logger from "../utils/logger";

const SIMILARITY_THRESHOLD = 0.65;
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;
const stopWords = new Set(natural.stopwords);

// Domain-specific synonym dictionary to unify common interchangeable terms
const SYNONYM_MAP: Record<string, string> = {
	ug: "undergraduate",
	pg: "postgraduate",
	score: "result",
	marks: "result",
	rank: "result",
	counselling: "admission",
	allotment: "admission",
	nta: "national testing agency",
	registration: "application",
	apply: "application",
	exam: "examination",
	info: "information",
	doc: "document",
	cert: "certificate",
};

function cleanString(text: string): string {
	// Tokenize the string (this removes punctuation too)
	const tokens = tokenizer.tokenize(text.toLowerCase()) || [];

	// Remove common stop words, apply synonyms, and stem each word
	const cleaned = tokens
		.filter((token) => !stopWords.has(token))
		.map((token) => {
			const mapped = SYNONYM_MAP[token] || token;
			return stemmer.stem(mapped);
		});

	return cleaned.join(" ");
}

export async function findStoryCluster(newTitle: string, newContent: string): Promise<string> {
	try {
		// Find articles from the last 2 days
		const twoDaysAgo = new Date();
		twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

		const recentArticles = await Article.find({
			createdAt: { $gte: twoDaysAgo },
		}).limit(50);

		if (recentArticles.length === 0) {
			return "NEW";
		}

		let bestMatchArticle = null;
		let highestSimilarity = 0;

		const cleanedNewTitle = cleanString(newTitle);

		for (const article of recentArticles) {
			const cleanedArticleTitle = cleanString(article.title);

			// Compare using Dice's Coefficient (great for word overlap)
			const diceScore = stringSimilarity.compareTwoStrings(cleanedNewTitle, cleanedArticleTitle);

			// Compare using Jaro-Winkler (great for short strings, character transpositions, typos)
			const jaroScore = natural.JaroWinklerDistance(cleanedNewTitle, cleanedArticleTitle, undefined);

			// Take the higher score of the two algorithms
			const titleSimilarity = Math.max(diceScore, jaroScore);

			if (titleSimilarity > highestSimilarity) {
				highestSimilarity = titleSimilarity;
				bestMatchArticle = article;
			}
		}

		if (highestSimilarity >= SIMILARITY_THRESHOLD && bestMatchArticle) {
			logger.info(
				`[Deduplication] Matched "${newTitle}" to "${bestMatchArticle.title}" (Score: ${highestSimilarity.toFixed(2)} based on NLP)`,
			);
			return bestMatchArticle.storyId || bestMatchArticle._id.toString();
		}

		logger.info(`[Deduplication] "${newTitle}" is NEW (Highest similarity: ${highestSimilarity.toFixed(2)})`);
		return "NEW";
	} catch (error) {
		logger.error({ error: error }, "[Deduplication] Error during clustering:");
		return "NEW"; // Fail safe
	}
}
