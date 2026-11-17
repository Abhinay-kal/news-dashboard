import express from "express";
import Article from "../models/Article";
import * as cheerio from "cheerio";
import Parser from "rss-parser";
import { generateSummary } from "../services/summarizationService";
import { determineCategory } from "../services/categorizationService";
import { calculateUrgencyScore } from "../services/sentimentService";
import nodemailer from "nodemailer";
import IORedis from "ioredis";
import logger from "../utils/logger";
import { z } from "zod";
import { validate } from "../middleware/validate";

const router = express.Router();
const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379");

const invalidateArticleCache = async () => {
	const keys = await redis.keys("articles_*");
	if (keys.length > 0) {
		await redis.del(...keys);
	}
};

/**
 * GET /api/articles?runDate=YYYY-MM-DD
 * Fetches all articles for a specific daily run.
 */
const getArticlesSchema = z.object({
	query: z.object({
		runDate: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format, expected YYYY-MM-DD")
			.default(() => new Date().toISOString().split("T")[0]),
	}),
});

router.get("/", validate(getArticlesSchema), async (req, res) => {
	try {
		const { runDate } = req.query;

		const cacheKey = `articles_${runDate}`;
		const cachedData = await redis.get(cacheKey);
		if (cachedData) {
			return res.json(JSON.parse(cachedData));
		}

		// This uses that index we created to instantly find the articles!
		// Sort by urgencyScore descending first, then by createdAt descending (-1) so newest appear at the top
		const articles = await Article.find({ runDate }).sort({ urgencyScore: -1, createdAt: -1 });

		// Deduplicate based on storyId if an article in the cluster is already POSTED
		const postedStoryIds = new Set<string>();
		for (const article of articles) {
			if (article.storyId && article.postStatus === "POSTED") {
				postedStoryIds.add(article.storyId);
			}
		}

		const filteredArticles = articles.filter((article) => {
			if (article.storyId && postedStoryIds.has(article.storyId)) {
				// If this story has a POSTED article, ONLY show the POSTED ones (hide PENDING/REJECTED duplicates)
				return article.postStatus === "POSTED";
			}
			return true;
		});

		// Only cache if articles were actually found; do not cache empty results for 5 minutes
		if (filteredArticles.length > 0) {
			await redis.setex(cacheKey, 300, JSON.stringify(filteredArticles));
		}
		res.json(filteredArticles);
	} catch (error) {
		logger.error(error);
		res.status(500).json({ error: "Server error fetching articles" });
	}
});

/**
 * PATCH /api/articles/:id/status
 * Updates the review status of a specific article.
 */
const updateStatusSchema = z.object({
	params: z.object({
		id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid article ID"),
	}),
	body: z.object({
		status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
	}),
});

router.patch("/:id/status", validate(updateStatusSchema), async (req, res) => {
	try {
		const { id } = req.params;
		const { status } = req.body;

		const updatedArticle = await Article.findByIdAndUpdate(
			id,
			{ status },
			{ new: true }, // This tells Mongoose to return the updated document, not the old one
		);

		if (!updatedArticle) {
			return res.status(404).json({ error: "Article not found" });
		}

		await invalidateArticleCache(); // Invalidate cache
		res.json(updatedArticle);
	} catch (error) {
		logger.error(error);
		res.status(500).json({ error: "Server error updating status" });
	}
});

/**
 * PATCH /api/articles/:id/postStatus
 * Updates the post status (PENDING, POSTED, NOT_POSTED) of a specific article.
 */
const updatePostStatusSchema = z.object({
	params: z.object({
		id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid article ID"),
	}),
	body: z.object({
		postStatus: z.enum(["PENDING", "POSTED", "NOT_POSTED"]),
	}),
});

router.patch("/:id/postStatus", validate(updatePostStatusSchema), async (req, res) => {
	try {
		const { id } = req.params;
		const { postStatus } = req.body;

		const updatedArticle = await Article.findByIdAndUpdate(id, { postStatus }, { new: true });

		if (!updatedArticle) {
			return res.status(404).json({ error: "Article not found" });
		}

		await invalidateArticleCache(); // Invalidate cache
		res.json(updatedArticle);
	} catch (error) {
		logger.error(error);
		res.status(500).json({ error: "Server error updating post status" });
	}
});

/**
 * PATCH /api/articles/:id/assign
 * Assigns an article to a specific writer's email.
 */
const assignArticleSchema = z.object({
	params: z.object({
		id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid article ID"),
	}),
	body: z.object({
		assignedTo: z.union([z.string().email("Invalid email"), z.literal("")]),
	}),
});

router.patch("/:id/assign", validate(assignArticleSchema), async (req, res) => {
	try {
		const { id } = req.params;
		const { assignedTo } = req.body; // Expecting an email string or empty string to unassign

		const updatedArticle = await Article.findByIdAndUpdate(id, { assignedTo }, { new: true });

		if (!updatedArticle) {
			return res.status(404).json({ error: "Article not found" });
		}

		await invalidateArticleCache(); // Invalidate cache
		res.json(updatedArticle);
	} catch (error) {
		logger.error(error);
		res.status(500).json({ error: "Server error assigning article" });
	}
});

/**
 * POST /api/articles/:id/notify
 * Sends an email to the assigned writer via Resend.
 */
const notifyArticleSchema = z.object({
	params: z.object({
		id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid article ID"),
	}),
});

router.post("/:id/notify", validate(notifyArticleSchema), async (req, res) => {
	try {
		const { id } = req.params;
		const article = await Article.findById(id);

		if (!article) return res.status(404).json({ error: "Article not found" });
		if (!article.assignedTo) return res.status(400).json({ error: "Article is not assigned to anyone" });

		const emailText = `Please write an article about the following topic:

Title: ${article.title}
Source URL: ${article.sourceUrl}

Key Points:
${article.summary.map((p) => `- ${p}`).join("\n")}

Thank you!`;

		const emailHtml = `
			<p>Please write an article about the following topic:</p>
			<p><strong>Title:</strong> ${article.title}<br/>
			<strong>Source URL:</strong> <a href="${article.sourceUrl}">${article.sourceUrl}</a></p>
			<p><strong>Key Points:</strong></p>
			<ul>
				${article.summary.map((p) => `<li>${p}</li>`).join("")}
			</ul>
			<p>Thank you!</p>
		`;

		const transporter = nodemailer.createTransport({
			service: "gmail",
			auth: {
				user: process.env.SMTP_EMAIL,
				pass: process.env.SMTP_PASSWORD,
			},
		});

		const info = await transporter.sendMail({
			from: `"News Dashboard" <${process.env.SMTP_EMAIL}>`,
			to: article.assignedTo,
			subject: `New Article Assignment: ${article.title}`,
			text: emailText,
			html: emailHtml,
		});

		res.json({ message: "Email sent successfully", data: info });
	} catch (error) {
		logger.error({ error: error }, "[Nodemailer Error]:");
		res.status(500).json({ error: "Server error sending email" });
	}
});

/**
 * DELETE /api/articles/:id
 * Deletes an article from the database.
 */
const deleteArticleSchema = z.object({
	params: z.object({
		id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid article ID"),
	}),
});

router.delete("/:id", validate(deleteArticleSchema), async (req, res) => {
	try {
		const { id } = req.params;
		const deletedArticle = await Article.findByIdAndDelete(id);

		if (!deletedArticle) {
			return res.status(404).json({ error: "Article not found" });
		}

		await invalidateArticleCache(); // Invalidate cache
		res.json({ message: "Article deleted successfully" });
	} catch (error) {
		logger.error(error);
		res.status(500).json({ error: "Server error deleting article" });
	}
});

/**
 * GET /api/articles/:id/similar
 * Finds similar articles from other sources via Google News RSS.
 */
const getSimilarArticlesSchema = z.object({
	params: z.object({
		id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid article ID"),
	}),
});

router.get("/:id/similar", validate(getSimilarArticlesSchema), async (req, res) => {
	try {
		const article = await Article.findById(req.params.id);
		if (!article) return res.status(404).json({ error: "Article not found" });

		// Extract publisher from title (usually after the last '-')
		let publisher = "";
		let searchTitle = article.title;
		const lastDashIndex = article.title.lastIndexOf("-");
		if (lastDashIndex !== -1) {
			publisher = article.title.substring(lastDashIndex + 1).trim();
			searchTitle = article.title.substring(0, lastDashIndex).trim();
		}

		// Use the core title for searching
		const searchQuery = encodeURIComponent(searchTitle);
		const parser = new Parser();
		const searchUrl = `https://news.google.com/rss/search?q=${searchQuery}&hl=en-IN&gl=IN&ceid=IN:en`;

		const feed = await parser.parseURL(searchUrl);
		const similarArticles = [];

		for (const item of feed.items) {
			if (!item.title || !item.link) continue;

			// Filter out articles from the same publisher
			if (publisher && item.title.includes(publisher)) continue;

			// Filter out the exact same article
			if (item.title === article.title || item.link === article.sourceUrl) continue;

			similarArticles.push({
				title: item.title,
				sourceUrl: item.link,
			});

			if (similarArticles.length >= 3) break;
		}

		res.json(similarArticles);
	} catch (error) {
		logger.error({ error: error }, "[Similar Articles Error]:");
		res.status(500).json({ error: "Failed to fetch similar articles" });
	}
});

/**
 * POST /api/articles/manual
 * Manually adds an article by parsing the provided URL or searching a topic.
 */
const manualAddArticleSchema = z.object({
	body: z.object({
		input: z.string().min(1, "Input is required"),
	}),
});

router.post("/manual", validate(manualAddArticleSchema), async (req, res) => {
	try {
		const { input } = req.body;

		let targetUrl = input;
		let title = "";
		let content = "";
		let rawHtml = "";

		if (!input.startsWith("http")) {
			logger.info(`[Manual Add] Searching Google News for: ${input}`);
			const parser = new Parser();
			const searchUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(input)}&hl=en-IN&gl=IN&ceid=IN:en`;
			const feed = await parser.parseURL(searchUrl);
			if (feed.items && feed.items.length > 0 && feed.items[0].link) {
				const item = feed.items[0];
				targetUrl = item.link;
				title = item.title || targetUrl;
				content = item["content:encoded"] || item.content || item.contentSnippet || "";
				rawHtml = content;
				logger.info(`[Manual Add] Found top article: ${title}`);
			} else {
				return res.status(404).json({ error: "No articles found for that topic." });
			}
		} else {
			logger.info(`[Manual Add] Fetching ${targetUrl}`);
			const response = await fetch(targetUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
			const html = await response.text();
			rawHtml = html;

			const $ = cheerio.load(html);
			title = $("title").text() || targetUrl;
			$("script, style, nav, footer, iframe, noscript").remove();
			content = $("body").text().replace(/\s+/g, " ").trim();
		}

		logger.info(`[Manual Add] Summarizing ${title}`);
		const summary = await generateSummary(rawHtml || content || title, !!rawHtml);
		const category = determineCategory(title, summary);
		const urgencyScore = calculateUrgencyScore(title, summary);

		const runDate = new Date().toISOString().split("T")[0];
		const articleData = {
			title,
			sourceUrl: targetUrl,
			topicCategory: category,
			summary,
			status: "PENDING",
			runDate,
			urgencyScore,
		};

		const article = await Article.findOneAndUpdate({ sourceUrl: targetUrl }, articleData, { upsert: true, new: true });

		await invalidateArticleCache(); // Invalidate cache
		res.json(article);
	} catch (error) {
		logger.error({ error: error }, "[Manual Add Error]:");
		res.status(500).json({ error: "Failed to parse or summarize article" });
	}
});

export default router;
