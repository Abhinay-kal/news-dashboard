import * as fs from "fs";
import * as crypto from "crypto";
import * as path from "path";

const CACHE_FILE = path.join(__dirname, "../../data/neet_dedup_cache.json");

export class DeduplicationService {
	private static cache: Record<string, number> = {};

	static {
		try {
			if (fs.existsSync(CACHE_FILE)) {
				this.cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
			}
		} catch (e) {}
	}

	private static saveCache() {
		try {
			fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
			fs.writeFileSync(CACHE_FILE, JSON.stringify(this.cache));
		} catch (e) {}
	}

	private static normalizeText(text: string): string {
		return text
			.toLowerCase()
			.replace(/\b(today|tomorrow|yesterday|expected|tentative|shortly|soon)\b/gi, "")
			.replace(/[0-9]/g, "")
			.replace(/[^\w\s]/gi, "")
			.replace(/\s+/g, " ")
			.trim();
	}

	public static isDuplicateNews(authorityName: string, diffText: string): boolean {
		const lines = diffText
			.split("\n")
			.map((l) => l.trim())
			.filter((l) => l.length > 10);

		if (lines.length === 0) return true;

		let allDuplicates = true;

		for (const line of lines) {
			const normalized = this.normalizeText(line);
			if (normalized.length < 5) continue;

			const hash = crypto.createHash("sha256").update(`${authorityName}_${normalized}`).digest("hex");

			if (!this.cache[hash]) {
				this.cache[hash] = Date.now();
				allDuplicates = false;
			}
		}

		const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
		for (const [hash, timestamp] of Object.entries(this.cache)) {
			if (timestamp < thirtyDaysAgo) {
				delete this.cache[hash];
			}
		}

		this.saveCache();
		return allDuplicates;
	}
}
