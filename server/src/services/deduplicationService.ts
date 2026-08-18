import { GoogleGenAI } from "@google/genai";
import Article from "../models/Article";

export async function findStoryCluster(newTitle: string, newContent: string): Promise<string> {
    try {
        // Find articles from the last 2 days
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        
        const recentArticles = await Article.find({
            createdAt: { $gte: twoDaysAgo }
        }).limit(50); // Limit to top 50 to avoid massive LLM prompts

        if (recentArticles.length === 0) {
            return "NEW";
        }

        // Prepare the prompt
        const candidateList = recentArticles.map(a => `ID: ${a._id} | Title: ${a.title}`).join('\n');
        
        const prompt = `You are a deduplication engine for a news dashboard. 
Your goal is to determine if a newly fetched article covers the EXACT SAME EVENT as any recently saved articles, or if it is a NEW event / PROGRESSION.

Rules for Clustering:
1. Exact same event from different publishers -> Match (e.g. "UP NEET Counselling results declared" by Times of India and "UP NEET results out" by NDTV).
2. PROGRESSION of a timeline -> DO NOT MATCH. (e.g. "UP NEET Counselling expected tomorrow" and "UP NEET Counselling results declared" are DIFFERENT states. Return NEW.)
3. Same topic, different specific event -> DO NOT MATCH. (e.g. "NEET PG delayed" and "NEET UG results out" are DIFFERENT. Return NEW.)

Candidate Articles:
${candidateList}

New Article Title: ${newTitle}
New Article Content/Snippet: ${newContent.substring(0, 500)}

Analyze the New Article against the Candidate Articles. 
If it is the EXACT SAME EVENT as one of the candidates, reply ONLY with the ID of the matching candidate (e.g., 60f7a9b...). 
If it is a progression, a new development, or a completely different event, reply ONLY with the word: NEW`;

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
        
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash-lite',
            contents: prompt,
        });

        const output = response?.text?.trim() || "NEW";
        
        // If it looks like an ID, return it, otherwise NEW
        if (output !== "NEW" && output.length > 10) {
            // Find the storyId of the matched article. If it doesn't have one, use its _id.
            const matchedArticle = recentArticles.find(a => a._id.toString() === output);
            if (matchedArticle) {
                return matchedArticle.storyId || matchedArticle._id.toString();
            }
        }

        return "NEW";
    } catch (error) {
        console.error("[Deduplication] LLM Error during clustering:", error);
        return "NEW"; // Fail safe
    }
}
