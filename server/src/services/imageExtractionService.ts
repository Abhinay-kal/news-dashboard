import ogs from "open-graph-scraper";

/**
 * Attempts to extract the High-Fidelity OpenGraph image from a given URL.
 * Falls back to the provided fallback URL (e.g., from RSS) if OG fails.
 */
export async function extractThumbnailUrl(url: string, fallbackUrl: string = ""): Promise<string> {
	if (!url || !url.startsWith("http")) return fallbackUrl;

	try {
		const options = { url, timeout: 3000 }; // 3s timeout so the worker doesn't stall
		const { result } = await ogs(options);

		if (result && result.ogImage && result.ogImage.length > 0 && result.ogImage[0]) {
			return result.ogImage[0].url || fallbackUrl;
		}
	} catch (error) {
		// We intentionally swallow errors here.
		// Many news sites block automated scrapers, and returning the fallback is fine.
	}

	return fallbackUrl;
}
