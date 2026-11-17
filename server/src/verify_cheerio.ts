import axios from "axios";
import * as cheerio from "cheerio";
import https from "https";
import { P0_TARGETS } from "./services/directScraperService";

const agent = new https.Agent({ rejectUnauthorized: false });

async function verify() {
  console.log("Verifying with Axios/Cheerio...");
  for (const target of P0_TARGETS) {
    try {
      const res = await axios.get(target.url, {
        httpsAgent: agent,
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });
      const $ = cheerio.load(res.data);
      const links = $(target.selector)
        .map((_, el) => $(el).text().trim().replace(/\s+/g, ' '))
        .get()
        .filter(t => t.length > 5)
        .slice(0, 3);
        
      if (links.length === 0) {
        console.log(`[WARNING] ${target.name} (${target.selector}): FOUND NO LINKS`);
      } else {
        console.log(`[OK] ${target.name} (${target.selector}):\n  - ${links.join("\n  - ")}`);
      }
    } catch (e: any) {
      console.log(`[ERROR] ${target.name}: ${e.message}`);
    }
  }
}
verify();
