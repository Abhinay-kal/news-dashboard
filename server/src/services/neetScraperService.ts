import axios from "axios";
import https from "https";
import axiosRetry from "axios-retry";
import * as cheerio from "cheerio";
import * as crypto from "crypto";
import pdfParse from "pdf-parse";
import { HttpsProxyAgent } from "https-proxy-agent";
import logger from "../utils/logger";

export interface SourceTarget {
	stateId: string;
	authorityName: string;
	url: string;
	noticeSelector?: string;
	apiUrl?: string; // Hidden JSON API url
}

export interface ScrapingResult {
	url: string;
	contentHash: string;
	extractedText: string;
	isPdf: boolean;
	detectedAt: Date;
	error?: string;
	notModified?: boolean;
	etag?: string;
	lastModified?: string;
}

export class NeetSourceMonitor {
	private readonly axiosInstance = axios.create({
		timeout: 15000,
		headers: {
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
			Accept:
				"text/html,application/xhtml+xml,application/xml;q=0.9,application/json,image/avif,image/webp,image/apng,*/*;q=0.8",
			"Accept-Language": "en-US,en;q=0.9",
		},
		httpsAgent: process.env.PROXY_URL 
			? new HttpsProxyAgent(process.env.PROXY_URL, { rejectUnauthorized: false })
			: new https.Agent({ rejectUnauthorized: false }),
		validateStatus: (status) => status >= 200 && status < 400, // Allow 304
	});

	constructor() {
		axiosRetry(this.axiosInstance, {
			retries: 3,
			retryDelay: axiosRetry.exponentialDelay,
			retryCondition: (error) => {
				return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 502;
			},
		});
	}

	private generateHash(content: string): string {
		return crypto.createHash("md5").update(content).digest("hex");
	}

	private async extractPdf(buffer: Buffer): Promise<string> {
		try {
			const data = await pdfParse(buffer);
			return data.text.trim();
		} catch (error: any) {
			logger.error(`[PDF Parse Error]: ${error.message}`);
			return "";
		}
	}

	public async scrapeTarget(
		target: SourceTarget,
		previousEtag?: string,
		previousLastModified?: string,
	): Promise<ScrapingResult> {
		logger.info(`[SourceMonitor] Checking ${target.authorityName}: ${target.url}`);

		try {
			const targetUrl = target.apiUrl || target.url;

			// Set conditional headers to save immense bandwidth (ETag / Last-Modified)
			const headers: any = {};
			if (previousEtag) headers["If-None-Match"] = previousEtag;
			if (previousLastModified) headers["If-Modified-Since"] = previousLastModified;

			const response = await this.axiosInstance.get(targetUrl, {
				responseType: "arraybuffer",
				headers,
			});

			// If server returns 304 Not Modified, we skip the heavy regex/html processing completely!
			if (response.status === 304) {
				logger.info(
					`[SourceMonitor] 304 Not Modified for ${target.authorityName} - ETag/Last-Modified perfectly matched!`,
				);
				return {
					url: target.url,
					contentHash: "",
					extractedText: "",
					isPdf: false,
					detectedAt: new Date(),
					notModified: true,
				};
			}

			const contentType = response.headers["content-type"] || "";
			const etag = response.headers["etag"];
			const lastModified = response.headers["last-modified"];

			let extractedText = "";
			let isPdf = false;

			// 1. JSON API Detection (Hidden JSON API Interception)
			if (contentType.includes("application/json")) {
				const jsonString = Buffer.from(response.data).toString("utf-8");
				try {
					const jsonObj = JSON.parse(jsonString);
					// Flattens JSON object into a raw string, letting our Regex engine do its job flawlessly without HTML tags
					extractedText = JSON.stringify(jsonObj)
						.replace(/[{"\[\]}:,]/g, " ") // Strip JSON formatting
						.replace(/\s+/g, " ")
						.trim();
				} catch (e) {
					logger.error(`[SourceMonitor] Failed to parse JSON API for ${targetUrl}`);
				}
			}
			// 2. PDF Detection
			else if (contentType.includes("application/pdf") || targetUrl.toLowerCase().endsWith(".pdf")) {
				isPdf = true;
				extractedText = await this.extractPdf(Buffer.from(response.data));
			}
			// 3. HTML Detection
			else {
				const htmlString = Buffer.from(response.data).toString("utf-8");
				const $ = cheerio.load(htmlString);

				$("script, style, noscript, nav, header, footer").remove();

				// ----------------------------------------------------------------
				// HONEYPOT & BOT-TRAP EVASION
				// ----------------------------------------------------------------
				// Government firewalls (like Akamai) inject invisible links. If a bot
				// scrapes or clicks them, it gets permanently IP-banned.
				// We mathematically purge all visually hidden elements from the DOM.
				$("*").each((_, el) => {
					const style = $(el).attr("style")?.toLowerCase() || "";
					const classList = $(el).attr("class")?.toLowerCase() || "";

					const isHidden =
						style.includes("display: none") ||
						style.includes("display:none") ||
						style.includes("visibility: hidden") ||
						style.includes("visibility:hidden") ||
						style.includes("opacity: 0") ||
						style.includes("opacity:0") ||
						classList.includes("hidden") ||
						classList.includes("d-none") ||
						classList.includes("sr-only") ||
						$(el).attr("aria-hidden") === "true" ||
						$(el).attr("type") === "hidden";

					if (isHidden) {
						$(el).remove();
					}
				});

				const blocks: string[] = [];
				$("p, li, tr, marquee, div, h1, h2, h3, h4").each((_, el) => {
					let text = $(el).text().replace(/\s+/g, " ").trim();

					$(el)
						.find("a")
						.each((_, aEl) => {
							const href = $(aEl).attr("href");
							if (href && href.endsWith(".pdf")) {
								text += ` [${href.split("/").pop()}]`;
							}
						});

					if (text.length > 5) {
						blocks.push(text);
					}
				});

				const deepLinks = new Set<string>();
				$("a").each((_, el) => {
					const linkText = $(el).text().toLowerCase();
					if (linkText.includes("notice") || linkText.includes("news") || linkText.includes("update")) {
						const href = $(el).attr("href");
						if (href && !href.startsWith("javascript") && !href.endsWith(".pdf")) {
							try {
								const fullUrl = new URL(href, target.url).toString();
								if (new URL(fullUrl).hostname === new URL(target.url).hostname) {
									deepLinks.add(fullUrl);
								}
							} catch (e) {}
						}
					}
				});

				const linksToCrawl = Array.from(deepLinks).slice(0, 1);
				for (const link of linksToCrawl) {
					try {
						const subRes = await this.axiosInstance.get(link, { responseType: "arraybuffer" });
						const subHtmlString = Buffer.from(subRes.data).toString("utf-8");
						const $sub = cheerio.load(subHtmlString);
						$sub("script, style, noscript, nav, header, footer").remove();

						$sub("*").each((_, el) => {
							const style = $sub(el).attr("style")?.toLowerCase() || "";
							const classList = $sub(el).attr("class")?.toLowerCase() || "";
							const isHidden =
								style.includes("display: none") ||
								style.includes("visibility: hidden") ||
								classList.includes("hidden") ||
								classList.includes("d-none") ||
								$sub(el).attr("aria-hidden") === "true";
							if (isHidden) $sub(el).remove();
						});

						$sub("p, li, tr, marquee").each((_, el) => {
							let text = $sub(el).text().replace(/\s+/g, " ").trim();
							$sub(el)
								.find("a")
								.each((_, aEl) => {
									const href = $sub(aEl).attr("href");
									if (href && href.endsWith(".pdf")) {
										text += ` [${href.split("/").pop()}]`;
									}
								});
							if (text.length > 5) blocks.push(text);
						});
					} catch (e) {
						logger.error(`[DeepCrawl] Failed for ${link}`);
					}
				}

				extractedText = blocks.join("\n");
			}

			const contentHash = this.generateHash(extractedText);

			return {
				url: target.url,
				contentHash,
				extractedText,
				isPdf,
				detectedAt: new Date(),
				etag,
				lastModified,
			};
		} catch (error: any) {
			logger.error(`[SourceMonitor] Health Check Failed for ${target.url}: ${error.message}`);

			return {
				url: target.url,
				contentHash: "",
				extractedText: "",
				isPdf: false,
				detectedAt: new Date(),
				error: `SOURCE_UNREACHABLE: ${error.message}`,
			};
		}
	}

	public async checkTargetsForChanges(
		targets: SourceTarget[],
		previousHashes: Record<string, string>,
	): Promise<ScrapingResult[]> {
		const changes: ScrapingResult[] = [];

		for (const target of targets) {
			const previousEtag = previousHashes[`${target.url}_etag`];
			const previousLastModified = previousHashes[`${target.url}_lastModified`];

			const result = await this.scrapeTarget(target, previousEtag, previousLastModified);

			if (result.error) continue;

			// Skip 304 NOT MODIFIED immediately
			if (result.notModified) continue;

			const previousHash = previousHashes[target.url];

			if (previousHash !== result.contentHash) {
				logger.info(`[SourceMonitor] Change detected on ${target.authorityName} (${target.url})`);
				changes.push(result);
			} else {
				logger.info(`[SourceMonitor] No change for ${target.authorityName}`);
			}

			await new Promise((resolve) => setTimeout(resolve, 2000));
		}

		return changes;
	}
}
