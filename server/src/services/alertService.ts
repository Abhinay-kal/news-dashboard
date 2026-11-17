import fs from "fs";
import path from "path";
import axios from "axios";
import nodemailer from "nodemailer";
import { Server } from "socket.io";
import Article from "../models/Article";
import { fetchRssFeed } from "./rssService";
import { isArticleRecent } from "./filteringService";
import logger from "../utils/logger";

const feedsConfigPath = path.join(__dirname, "../../config/feeds.json");
const feedsConfig = JSON.parse(fs.readFileSync(feedsConfigPath, "utf-8"));
const P0_KEYWORDS = feedsConfig["P0_Mission_Critical"] || [];
const IMPORTANT_UPDATE_RECIPIENTS = [
	"rachit.dadhich@matrixedu.in",
	"omprakash.jangid@matrixedu.in",
	"abhishek.choudhary@matrixedu.in",
	"krishna.kumar@matrixedu.in",
	"manoj.meena@matrixedu.in",
];

function isWorkingHours() {
	// 10 AM to 5 PM, Mon-Fri (Local Time - assuming IST as per your cron setup)
	const now = new Date();
	// Use proper timezone offset logic if needed, but simple local time works for this
	const day = now.getDay();
	const hour = now.getHours();

	const isMonToFri = day >= 1 && day <= 5;
	const is10to5 = hour >= 10 && hour < 17;

	return isMonToFri && is10to5;
}

export async function checkCriticalAlerts(io: Server) {
	logger.info("[AlertService] Running fast-polling for P0 keywords...");

	for (const keyword of P0_KEYWORDS) {
		try {
			const encoded = encodeURIComponent(keyword);
			const feedUrl = `https://news.google.com/rss/search?q=${encoded}&hl=en-IN&gl=IN&ceid=IN:en`;

			const rawArticles = await fetchRssFeed(feedUrl);

			// Check only the latest top 2 to keep it extremely fast
			for (const raw of rawArticles.slice(0, 2)) {
				// Check if we already have it
				const existing = await Article.findOne({ sourceUrl: raw.sourceUrl });
				if (existing) continue; // Already processed!

				// Date Check: Ensure we don't alert on old news
				const dateCheck = await isArticleRecent(raw.pubDate, raw.sourceUrl);
				if (!dateCheck.isRecent) {
					continue; // Skip this old article
				}

				// IT IS A NEW ARTICLE! Let's save it immediately as a basic alert
				const articleData = {
					title: `[ALERT] ${raw.title}`,
					sourceUrl: raw.sourceUrl,
					link: raw.sourceUrl,
					topicCategory: "P0_ALERT",
					summary: "High priority breaking news detected.",
					status: "PENDING",
					runDate: new Date().toISOString().split("T")[0],
				};

				await Article.create(articleData);
				logger.info(`[AlertService] New P0 Alert found: ${raw.title}`);

				const currentHour = new Date().getHours();
				const isQuietHours = currentHour >= 22 || currentHour < 9;

				// ROUTING LOGIC: WebSocket vs Email
				if (isWorkingHours()) {
					logger.info("[AlertService] Working hours! Sending WebSocket push to browser...");
					io.emit("high-priority-alert", {
						title: `P0 Alert: ${keyword}`,
						message: raw.title,
						url: raw.sourceUrl,
					});
				} else if (isQuietHours) {
					logger.info("[AlertService] Quiet hours (10PM-9AM)! Saved to DB, will be sent in 9 AM summary...");
				} else {
					logger.info("[AlertService] Off-hours! Sending fallback email...");
					sendEmailAlert(keyword, raw.title, raw.sourceUrl);
				}
			}
		} catch (error) {
			logger.error({ error: error.message }, `[AlertService] Error checking ${keyword}:`);
		}
	}
}

async function sendEmailAlert(keyword: string, title: string, url: string) {
	if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
		logger.error("[AlertService] SMTP credentials not set, cannot send email.");
		return;
	}

	try {
		const transporter = nodemailer.createTransport({
			service: "gmail",
			auth: {
				user: process.env.SMTP_EMAIL,
				pass: process.env.SMTP_PASSWORD,
			},
		});

		const recipients = Array.from(
			new Set(
				[process.env.SMTP_EMAIL, ...IMPORTANT_UPDATE_RECIPIENTS].filter((email): email is string => Boolean(email)),
			),
		);

		const mailOptions = {
			from: `"News Alert Bot" <${process.env.SMTP_EMAIL}>`,
			to: recipients.join(", "), // Send to all important update recipients
			subject: `URGENT P0 Alert: ${keyword}`,
			// These headers signal to Gmail/Outlook that this is a newsletter-style
			// email. Gmail auto-groups it in the Updates tab; recipients who manually
			// move one message to a "news" label will have Gmail apply that label
			// automatically to all future messages from this sender.
			headers: {
				"List-Unsubscribe": `<mailto:${process.env.SMTP_EMAIL}?subject=unsubscribe>`,
				"X-Category": "news",
				"Precedence": "bulk",
				"X-Mailer": "NewsDashboard-AlertBot/1.0",
			},
			html: `
                <h2>Breaking News Detected for: ${keyword}</h2>
                <p><strong>Headline:</strong> ${title}</p>
                <p><a href="${url}">Click here to read the full article</a></p>
                <br>
                <p><em>This is an automated off-hours alert from your News Dashboard.</em></p>
            `,
		};

		await transporter.sendMail(mailOptions);
		logger.info(`[AlertService] Email alert sent successfully for ${keyword}`);
	} catch (error) {
		logger.error({ error: error }, "[AlertService] Failed to send email alert:");
	}
}

export async function sendQuietHoursSummaryEmail() {
	if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
		logger.error("[AlertService] SMTP credentials not set for quiet hours summary.");
		return;
	}

	try {
		const now = new Date();
		const tenPmYesterday = new Date();
		tenPmYesterday.setDate(now.getDate() - 1);
		tenPmYesterday.setHours(22, 0, 0, 0);

		const alerts = await Article.find({
			topicCategory: "P0_ALERT",
			createdAt: { $gte: tenPmYesterday, $lte: now },
		});

		if (alerts.length === 0) {
			logger.info("[AlertService] No quiet hours alerts to summarize for 9 AM.");
			return;
		}

		const transporter = nodemailer.createTransport({
			service: "gmail",
			auth: {
				user: process.env.SMTP_EMAIL,
				pass: process.env.SMTP_PASSWORD,
			},
		});

		const recipients = Array.from(
			new Set(
				[process.env.SMTP_EMAIL, ...IMPORTANT_UPDATE_RECIPIENTS].filter((email): email is string => Boolean(email)),
			),
		);

		let htmlContent = `<h2>Quiet Hours (10 PM - 9 AM) Alerts Summary</h2><ul>`;
		alerts.forEach((alert) => {
			htmlContent += `<li><strong>${alert.title}</strong><br/><a href="${alert.sourceUrl}">${alert.sourceUrl}</a><br/><br/></li>`;
		});
		htmlContent += `</ul><p><em>These alerts were collected overnight and delayed until 9 AM.</em></p>`;

		const mailOptions = {
			from: `"News Alert Bot" <${process.env.SMTP_EMAIL}>`,
			to: recipients.join(", "),
			subject: `Overnight P0 Alerts Summary (${alerts.length} new alerts)`,
			// Same headers as sendEmailAlert — keeps both emails consistently
			// grouped under Gmail's Updates tab / "news" label.
			headers: {
				"List-Unsubscribe": `<mailto:${process.env.SMTP_EMAIL}?subject=unsubscribe>`,
				"X-Category": "news",
				"Precedence": "bulk",
				"X-Mailer": "NewsDashboard-AlertBot/1.0",
			},
			html: htmlContent,
		};

		await transporter.sendMail(mailOptions);
		logger.info(`[AlertService] Quiet hours summary email sent successfully with ${alerts.length} alerts.`);
	} catch (error) {
		logger.error({ error: error }, "[AlertService] Failed to send quiet hours summary email:");
	}
}
