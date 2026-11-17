import type * as Natural from "natural";
import Article from "../models/Article";
import logger from "../utils/logger";

let classifier: Natural.BayesClassifier | null = null;
let isTrained = false;
let naturalModule: typeof Natural | null = null;

const DEFAULT_TRAINING_DATA = [
	{ text: "jee main result neet cut off admission", category: "Education" },
	{ text: "cbse ncert textbook syllabus exam", category: "Education" },
	{ text: "allen aakash physics wallah fiitjee resonance motion narayana chaitanya prince eduhub clc sikar navjeevan tagore gci kautilya unacademy coaching", category: "Competitors" },
	{ text: "openai chatgpt artificial intelligence llm gemini", category: "AI & Tech" },
	{ text: "google microsoft tech industry software", category: "AI & Tech" },
	{ text: "startup funding series a vc ycombinator raised", category: "Startups & Business" },
	{ text: "founder CEO revenue valuation", category: "Startups & Business" },
	{ text: "bitcoin ethereum crypto blockchain web3 token", category: "Crypto" },
	{ text: "stock market economy inflation fed interest rate", category: "Finance" },
	{ text: "company earnings revenue report profit", category: "Finance" },
	{ text: "general news update today daily", category: "General" },
];

export async function trainCategorizer(): Promise<void> {
	logger.info("[Categorization] Training Naive Bayes classifier...");
	if (!naturalModule) naturalModule = require("natural");
	classifier = new naturalModule!.BayesClassifier(); 

	try {
		for (const data of DEFAULT_TRAINING_DATA) {
			classifier.addDocument(data.text, data.category);
		}

		const recentArticles = await Article.find({}, "title topicCategory summary").sort({ createdAt: -1 }).limit(1000);

		if (recentArticles.length > 0) {
			logger.info(`[Categorization] Found ${recentArticles.length} historical articles for training.`);
			for (const article of recentArticles) {
				if (article.topicCategory && article.title) {
					const textToAnalyze = `${article.title} ${article.summary?.join(" ") || ""}`;
					classifier.addDocument(textToAnalyze, article.topicCategory);
				}
			}
		} else {
			logger.info("[Categorization] No historical articles found, relying on default training data.");
		}

		classifier.train();
		isTrained = true;
		logger.info("[Categorization] Classifier training complete.");
	} catch (error) {
		logger.error({ error: error }, "[Categorization] Error training classifier:");
		classifier.train();
		isTrained = true;
	}
}

export function determineCategory(title: string, summary: string[] = []): string {
	const textToAnalyze = `${title} ${summary.join(" ")}`;

	if (!isTrained || !classifier) {
		const lowerText = textToAnalyze.toLowerCase();
		if (lowerText.match(/\b(allen|aakash|physics wallah|pw|resonance|motion|fiitjee|narayana|chaitanya|prince eduhub|clc sikar|navjeevan|tagore|gci|kautilya)\b/)) return "Competitors";
		if (lowerText.match(/\b(jee|neet|josaa|csab|nta|cbse|ncert|ugc|aicte|coaching|board exam|admission|counsell|counseling|scholarship|exam result|education ministry)\b/)) return "Education";
		if (lowerText.match(/\b(ai|artificial intelligence|machine learning|llm|openai|google)\b/)) return "AI & Tech";
		if (lowerText.match(/\b(startup|funding|vc|raised|valuation|founder)\b/)) return "Startups & Business";
		if (lowerText.match(/\b(crypto|bitcoin|ethereum|blockchain|web3)\b/)) return "Crypto";
		if (lowerText.match(/\b(stock|market|economy|inflation|fed|revenue)\b/)) return "Finance";
		return "General";
	}

	const predicted = classifier.classify(textToAnalyze);
	return predicted || "General";
}
