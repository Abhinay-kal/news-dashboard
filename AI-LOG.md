## 2026-11-17 14:45 | Antigravity | Fix failing scraping jobs and embed BullMQ worker lifecycle
- Changed: server/src/worker.ts, server/src/index.ts
- Why: Scraping jobs failed because worker was never launched on restart, jobs stalled due to 30s lock limits, and SearXNG was blocked by Cloudflare anti-bot captcha.
- Verify: Ran POST /api/scrape-and-email and verified worker actively processes Google News feeds via GET /api/refresh/status.
- Undo: git revert cb60226
- Risks/unknown: None; SearXNG was fully broken and Google News search covers all keywords cleanly.
- Git: branch bugfix/scraping-worker-searxng, commit cb60226

## 2026-11-17 10:36 | Antigravity | Synchronize site diff monitor, NEET scraper engine, and UI components
- Changed: client UI components, server scrapers/diff service, monitors config, .gitignore, scripts
- Why: Allow pulling and running news dashboard seamlessly across devices without platform binary churn
- Verify: Ran gitleaks secret scan across all staged changes (0 leaks); build artifacts pruned
- Undo: git revert dd62bc8 62e6e65 2fe6d81
- Risks/unknown: Other device must run npm install in client and server to fetch local platform dependencies
- Git: branch feature/site-diff-monitor (commits 2fe6d81, 62e6e65, dd62bc8)
