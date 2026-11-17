import fs from "fs";

const targetFile = "/Users/abhinaykalkhanday/Desktop/Projects/news-dashboard/server/src/services/directScraperService.ts";
let content = fs.readFileSync(targetFile, "utf-8");

const newTargets = fs.readFileSync("/Users/abhinaykalkhanday/Desktop/Projects/news-dashboard/server/src/new_targets.ts", "utf-8");

content = content.replace(/export const P0_TARGETS = \[[\s\S]*?\];/, newTargets.trim());

const newFilter = `
			// Refined filtering to skip static accessibility, navigation links, and generic headers
			const skipTexts = [
				"accessibility", "skip to main content", "screen reader", "high contrast", 
				"normal contrast", "follow us", "like us", "login", "government of india",
				"भारत सरकार", "ministry of", "twitter", "facebook", "instagram", "youtube", 
				"whatsapp", "menu", "home", "about us", "contact us", "privacy policy", "terms of use"
			];
			
			const keywords = ["notice", "news", "update", "neet", "counselling", "round", "allotment", "mbbs", "bds", "merit", "list", "schedule", "circular", "important", "admissions", "prospectus"];
			
			const links = $(target.selector)
				.filter((_, el) => {
					const text = $(el).text().trim().toLowerCase();
					const href = $(el).attr("href");

					if (!href || href === "#" || href.startsWith("javascript:")) return false;
					if (href === "/" || href === "/index.html") return false;

					// Enforce meaningful text length
					if (text.length < 15) return false;
					if (skipTexts.some(skip => text.includes(skip))) return false;

					// If the target selector is just "a" (fallback), enforce keyword matching
					// so we don't accidentally hash random footer links that change daily.
					if (target.selector === "a") {
					    if (!keywords.some(kw => text.includes(kw)) && !href.includes(".pdf")) return false;
					}

					return true;
				})
				.slice(0, 3);
`;

content = content.replace(/			\/\/ Refined filtering to skip static accessibility[\s\S]*?\.slice\(0, 3\);/, newFilter.trim());

fs.writeFileSync(targetFile, content);
console.log("Updated P0_TARGETS and added keyword filter.");
