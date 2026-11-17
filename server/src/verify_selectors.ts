import { chromium } from "playwright";
import { P0_TARGETS } from "./services/directScraperService";

async function verify() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  
  console.log("Verifying selectors for 36 sites...");

  for (const target of P0_TARGETS) {
    const page = await context.newPage();
    try {
      await page.goto(target.url, { timeout: 15000, waitUntil: "domcontentloaded" });
      
      const links = await page.evaluate((sel) => {
        const els = Array.from(document.querySelectorAll(sel));
        return els.map(el => el.textContent?.trim().replace(/\s+/g, ' ')).filter(t => t && t.length > 5).slice(0, 3);
      }, target.selector);
      
      if (links.length === 0) {
        console.log(`[WARNING] ${target.name} (${target.selector}): FOUND NO LINKS`);
      } else {
        console.log(`[OK] ${target.name} (${target.selector}):\n  - ${links.join("\n  - ")}`);
      }
    } catch (e: any) {
      console.log(`[ERROR] ${target.name}: ${e.message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
}

verify();
