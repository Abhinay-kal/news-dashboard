"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const Article_1 = __importDefault(require("../models/Article"));
const cheerio = __importStar(require("cheerio"));
const rss_parser_1 = __importDefault(require("rss-parser"));
const summarizationService_1 = require("../services/summarizationService");
const nodemailer_1 = __importDefault(require("nodemailer"));
const router = express_1.default.Router();
/**
 * GET /api/articles?runDate=YYYY-MM-DD
 * Fetches all articles for a specific daily run.
 */
router.get("/", async (req, res) => {
    try {
        const { runDate } = req.query;
        if (!runDate) {
            return res
                .status(400)
                .json({ error: "runDate query parameter is required" });
        }
        // This uses that index we created to instantly find the articles!
        // Sort by createdAt descending (-1) so newest (including manual adds) appear at the top
        const articles = await Article_1.default.find({ runDate }).sort({ createdAt: -1 });
        res.json(articles);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error fetching articles" });
    }
});
/**
 * PATCH /api/articles/:id/status
 * Updates the review status of a specific article.
 */
router.patch("/:id/status", async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        // Security check: Ensure they are only sending valid enum states
        if (!["PENDING", "APPROVED", "REJECTED"].includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }
        const updatedArticle = await Article_1.default.findByIdAndUpdate(id, { status }, { new: true });
        if (!updatedArticle) {
            return res.status(404).json({ error: "Article not found" });
        }
        res.json(updatedArticle);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error updating status" });
    }
});
/**
 * PATCH /api/articles/:id/postStatus
 * Updates the post status (PENDING, POSTED, NOT_POSTED) of a specific article.
 */
router.patch("/:id/postStatus", async (req, res) => {
    try {
        const { id } = req.params;
        const { postStatus } = req.body;
        if (!["PENDING", "POSTED", "NOT_POSTED"].includes(postStatus)) {
            return res.status(400).json({ error: "Invalid post status" });
        }
        const updatedArticle = await Article_1.default.findByIdAndUpdate(id, { postStatus }, { new: true });
        if (!updatedArticle) {
            return res.status(404).json({ error: "Article not found" });
        }
        res.json(updatedArticle);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error updating post status" });
    }
});
/**
 * PATCH /api/articles/:id/assign
 * Assigns an article to a specific writer's email.
 */
router.patch("/:id/assign", async (req, res) => {
    try {
        const { id } = req.params;
        const { assignedTo } = req.body; // Expecting an email string or empty string to unassign
        const updatedArticle = await Article_1.default.findByIdAndUpdate(id, { assignedTo }, { new: true });
        if (!updatedArticle) {
            return res.status(404).json({ error: "Article not found" });
        }
        res.json(updatedArticle);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error assigning article" });
    }
});
/**
 * POST /api/articles/:id/notify
 * Sends an email to the assigned writer via Resend.
 */
router.post("/:id/notify", async (req, res) => {
    try {
        const { id } = req.params;
        const article = await Article_1.default.findById(id);
        if (!article)
            return res.status(404).json({ error: "Article not found" });
        if (!article.assignedTo)
            return res.status(400).json({ error: "Article is not assigned to anyone" });
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
        const transporter = nodemailer_1.default.createTransport({
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
    }
    catch (error) {
        console.error("[Nodemailer Error]:", error);
        res.status(500).json({ error: "Server error sending email" });
    }
});
/**
 * DELETE /api/articles/:id
 * Deletes an article from the database.
 */
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const deletedArticle = await Article_1.default.findByIdAndDelete(id);
        if (!deletedArticle) {
            return res.status(404).json({ error: "Article not found" });
        }
        res.json({ message: "Article deleted successfully" });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error deleting article" });
    }
});
/**
 * GET /api/articles/:id/similar
 * Finds similar articles from other sources via Google News RSS.
 */
router.get("/:id/similar", async (req, res) => {
    try {
        const article = await Article_1.default.findById(req.params.id);
        if (!article)
            return res.status(404).json({ error: "Article not found" });
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
        const parser = new rss_parser_1.default();
        const searchUrl = `https://news.google.com/rss/search?q=${searchQuery}&hl=en-IN&gl=IN&ceid=IN:en`;
        const feed = await parser.parseURL(searchUrl);
        const similarArticles = [];
        for (const item of feed.items) {
            if (!item.title || !item.link)
                continue;
            // Filter out articles from the same publisher
            if (publisher && item.title.includes(publisher))
                continue;
            // Filter out the exact same article
            if (item.title === article.title || item.link === article.sourceUrl)
                continue;
            similarArticles.push({
                title: item.title,
                sourceUrl: item.link
            });
            if (similarArticles.length >= 3)
                break;
        }
        res.json(similarArticles);
    }
    catch (error) {
        console.error("[Similar Articles Error]:", error);
        res.status(500).json({ error: "Failed to fetch similar articles" });
    }
});
/**
 * POST /api/articles/manual
 * Manually adds an article by parsing the provided URL or searching a topic.
 */
router.post("/manual", async (req, res) => {
    try {
        const { input } = req.body;
        if (!input) {
            return res.status(400).json({ error: "Input is required" });
        }
        let targetUrl = input;
        let title = "";
        let content = "";
        if (!input.startsWith("http")) {
            console.log(`[Manual Add] Searching Google News for: ${input}`);
            const parser = new rss_parser_1.default();
            const searchUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(input)}&hl=en-IN&gl=IN&ceid=IN:en`;
            const feed = await parser.parseURL(searchUrl);
            if (feed.items && feed.items.length > 0 && feed.items[0].link) {
                const item = feed.items[0];
                targetUrl = item.link;
                title = item.title || targetUrl;
                content = item["content:encoded"] || item.content || item.contentSnippet || "";
                console.log(`[Manual Add] Found top article: ${title}`);
            }
            else {
                return res.status(404).json({ error: "No articles found for that topic." });
            }
        }
        else {
            console.log(`[Manual Add] Fetching ${targetUrl}`);
            const response = await fetch(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const html = await response.text();
            const $ = cheerio.load(html);
            title = $('title').text() || targetUrl;
            $('script, style, nav, footer, iframe, noscript').remove();
            content = $('body').text().replace(/\s+/g, ' ').trim();
        }
        console.log(`[Manual Add] Summarizing ${title}`);
        const category = (0, summarizationService_1.determineCategory)(content || title);
        const summary = await (0, summarizationService_1.generateSummary)(content || title);
        const runDate = new Date().toISOString().split("T")[0];
        const articleData = {
            title,
            sourceUrl: targetUrl,
            topicCategory: category,
            summary,
            status: "PENDING",
            runDate
        };
        const article = await Article_1.default.findOneAndUpdate({ sourceUrl: targetUrl }, articleData, { upsert: true, new: true });
        res.json(article);
    }
    catch (error) {
        console.error("[Manual Add Error]:", error);
        res.status(500).json({ error: "Failed to parse or summarize article" });
    }
});
exports.default = router;
//# sourceMappingURL=articleRoutes.js.map