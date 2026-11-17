import type * as Natural from "natural";

let analyzer: Natural.SentimentAnalyzer | null = null;
let tokenizer: Natural.WordTokenizer | null = null;
let naturalModule: typeof Natural | null = null;

const URGENCY_MULTIPLIERS: Record<string, number> = {
	breaking: 5, urgent: 5, deadline: 4, alert: 4,
	scam: 3, live: 3, exclusive: 3, warning: 4,
	crisis: 4, emergency: 5, admit: 3, extended: 3,
	matrix: 2, regulation: 3, guidelines: 3, slip: 2,
};

export function calculateUrgencyScore(title: string, summary: string[] = []): number {
	if (!naturalModule) {
		naturalModule = require("natural");
	}
	if (!analyzer) analyzer = new naturalModule!.SentimentAnalyzer("English", naturalModule!.PorterStemmer, "afinn");
	if (!tokenizer) tokenizer = new naturalModule!.WordTokenizer();

	const text = `${title} ${summary.join(" ")}`;
	const tokens = tokenizer.tokenize(text) || [];

	if (tokens.length === 0) return 0;

	const rawSentiment = analyzer.getSentiment(tokens);
	let score = Math.abs(rawSentiment) * 10; 

	const lowerTokens = tokens.map((t) => t.toLowerCase());
	for (const token of lowerTokens) {
		if (URGENCY_MULTIPLIERS[token]) {
			score += URGENCY_MULTIPLIERS[token];
		}
	}

	return Math.round(score * 100) / 100;
}
