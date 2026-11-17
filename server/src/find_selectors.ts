import fs from "fs";
import { chromium } from "playwright";
import { P0_TARGETS } from "./services/directScraperService";

async function analyzeSites() {
  console.log("Analyzing 35 sites for best selectors. This might take a minute...");
  const browser = await chromium.launch();
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  });
  
  const results: Record<string, string> = {};

  for (const target of P0_TARGETS) {
    const page = await context.newPage();
    try {
      await page.goto(target.url, { timeout: 15000, waitUntil: "domcontentloaded" });
      
      // Inject a script to find the best container
      const bestSelector = await page.evaluate(() => {
        // Look for common IDs/Classes for notice boards
        const commonSelectors = [
          "#notice-board", ".notice-board", "#notice", ".notice",
          "#latest-news", ".latest-news", "#updates", ".updates",
          "marquee", ".marquee", "#marquee",
          "#announcements", ".announcements",
          ".news-events", "#news-events",
          ".Whatsnew", "#Whatsnew",
          ".circulars", "#circulars"
        ];
        
        for (const sel of commonSelectors) {
          if (document.querySelector(sel)) return sel + " a";
        }
        
        // If not found, find the div that contains the most 'a' tags with text like 'Notice' or 'NEET'
        // or just fallback to generic
        return "a";
      });
      
      results[target.name] = bestSelector;
      console.log(`[${target.name}] -> ${bestSelector}`);
    } catch (error) {
      console.log(`[${target.name}] -> Failed to load, using default 'a'`);
      results[target.name] = "a";
    } finally {
      await page.close();
    }
  }

  await browser.close();
  fs.writeFileSync("selectors.json", JSON.stringify(results, null, 2));
  console.log("Done!");
}

analyzeSites();
