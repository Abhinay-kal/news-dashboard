# news-dashboard — Context

> Generated/maintained by the context job. Last verified: 2026-10-03. Sections marked (unverified) were inferred, not confirmed from files.
> Content between `<!-- manual:start -->` and `<!-- manual:end -->` is hand-written and must be preserved on re-runs.

## 1. Summary
"AI News Dashboard Pro": a full-stack editorial dashboard that curates education news (JEE / NEET / counselling / board exams, India) for content writers. It pulls Google News RSS (plus a SearXNG RSS footprint and direct RSS/YouTube feeds), scrapes official exam/counselling portals, de-duplicates and categorizes items, and shows them in a React UI where editors approve/reject, assign writers and email them. A later "NEET counselling state monitor" (Phase 6) watches state portals for status changes and fires real-time alerts over Socket.IO. GitHub repo per package.json: Abhinay-kal/news-dashboard.

## 2. Status
active. Evidence: folder mtime Oct 3 (server/data updated daily by the monitor), client changed Oct 2, recent git backup commits for the folder. Several scratch/test files remain in server/ (see Open work). README and newsdashcontex.md (both Jul 23) are stale relative to the code (they describe Gemini summarization and a plain Mongo-only app).

## 3. Tech stack
- Server: Node.js + Express 5, TypeScript (run with `ts-node --transpile-only`), Mongoose/MongoDB (articles), Prisma 6 (schema declares provider postgresql, `env("DATABASE_URL")`; a `prisma/dev.db` also exists) for NEET counselling data, BullMQ + ioredis (Redis queue), node-cron, Socket.IO, Helmet, express-rate-limit, pino logging, zod.
- Scraping/NLP: rss-parser, axios + axios-retry, cheerio, jsdom + @mozilla/readability, playwright (screenshots), pdf-parse, pixelmatch + pngjs (screenshot diffs), open-graph-scraper, natural, string-similarity, apify-client, nodemailer.
- Client: React 19, Vite 8, TypeScript, Tailwind 4 (@tailwindcss/vite), TanStack React Query 5, react-router-dom 7, framer-motion, socket.io-client, oxlint.
- Tooling: Biome (root), ESLint/Prettier/Jest (server).
- Infra: docker-compose (RSSHub + browserless/chrome + Redis).

## 4. Architecture
Data flow:
1. `server/src/index.ts` (Express + Socket.IO + crons) connects to MongoDB (`MONGO_URI`, exits if missing), mounts `/api/articles`, `/api/neet`, `/api/health`, serves `/screenshots` statically from `server/data/screenshots`.
2. Scrape jobs are queued with BullMQ (`queueService.ts`, queue `scrapingQueue`, Redis at `REDIS_URL` or localhost:6379). `POST /api/refresh` and the 09:00 cron call `triggerScrapeJob()`; skipped if a job is active/waiting. A startup check runs a catch-up job if past 9 AM and no articles exist for today.
3. `server/src/worker.ts` (separate process, BullMQ Worker) reads `server/config/feeds.json` (categories -> keywords; generates a Google News RSS URL and a searx.be RSS URL per keyword; direct http URLs used as-is; a `Twitter_Accounts` category handled separately). Pipeline: rssService -> filteringService (relevance/recency) -> deduplicationService (story clusters) -> summarizationService (deterministic: first valid sentences via cheerio, NOT an LLM) -> categorizationService -> sentimentService (urgency score) -> imageExtractionService -> saved to `Article`.
4. Cron schedule in index.ts: `0 9 * * *` Asia/Kolkata (quiet-hours summary email + scrape), hourly `:00` `checkCriticalAlerts(io)`, hourly `:30` `checkDirectWebsites(io)` + `captureP0Screenshots()` (P0_TARGETS list of national bodies NTA/CBSE/MCC/JoSAA/CSAB/NMC/UGC/RBSE and ~30 state counselling sites, with CSS selectors), every 10 min `runNeetMonitoringJob(io)`.
5. NEET monitor: `neetOrchestrator.ts` loads CounsellingAuthority rows (Prisma) with primaryWebsite+noticeSelector, hashes/diffs notice text (`neetScraperService`), regex-infers status (`regexStatusInference`), cross-verifies (`verificationEngine`), de-dups (`neetDeduplicationService`), detects site redesigns, and emits alerts. Alerts go out as the Socket.IO event `high-priority-alert`; `/api/test-alert` fires a fake one.
6. Client (`client/src`) consumes the API with React Query and Socket.IO.

Folder map (ignoring node_modules/dist/screenshots):
- `client/` Vite React app (src, public, fix_ui.ts)
- `server/src/{routes,services,models,middleware,utils,scripts}`; `server/config/feeds.json`; `server/prisma/{schema.prisma,seed.ts,dev.db}`; `server/scripts/`; `server/data/{dedup_cache.json,neet_dedup_cache.json,screenshots}`
- `scripts/start-dashboard.sh`, `.github/workflows/ci.yml`, root `docker-compose.yml`, `generate_enums.js`, `feed.md`, `councelling.md`
- `.git-original-backup/` (old git dir; ignore)

## 5. Key files & entry points
| path | purpose |
|---|---|
| server/src/index.ts | API server, Socket.IO, all cron schedules |
| server/src/worker.ts | BullMQ worker: RSS scraping pipeline |
| server/src/services/queueService.ts | Queue + trigger/status helpers |
| server/src/services/directScraperService.ts | P0 portal polling, Playwright screenshots, pixel diffs, PDF parsing |
| server/src/services/neetOrchestrator.ts | NEET counselling monitor loop |
| server/src/services/{alertService,filteringService,deduplicationService,categorizationService,sentimentService,summarizationService,rssService,verificationEngine}.ts | pipeline stages |
| server/src/models/Article.ts, SourceHealth.ts, models/neet/ | Mongoose models, NEET enums |
| server/prisma/schema.prisma | State, CounsellingAuthority, CounsellingCycle, Round, Schedule, Source, StatusHistory, ManualReviewQueue, HistoricalCutoff |
| server/config/feeds.json | keyword/feed list per category |
| client/src | React UI |
| README.md, newsdashcontex.md | stale docs (Jul 23) |

## 6. Run / build / deploy
- Prereqs: Node 18+, MongoDB, Redis, (optional) Docker.
- Install: `cd server && npm install`; `cd client && npm install`.
- Dev (root): `npm run dev` (runs server dev, server worker, client dev in parallel via `&`); or `scripts/start-dashboard.sh` (not read in detail, unverified).
- Server: `npm run dev`, `npm run worker`, `npm run build` (tsc), `npm start` (node dist/index.js), `npm test` (jest). Client: `npm run dev` (Vite, README says http://localhost:5173), `npm run build`.
- Docker: root docker-compose.yml starts RSSHub (:1200), browserless/chrome (:3000), redis (:6379). server/docker-compose.yml also exists (not read).
- Ports: API `PORT` (default 5000; README example 5001).
- CI: .github/workflows/ci.yml present (not read). Deployment target not documented (unverified).

## 7. Config, env vars & external services
Env var names: PORT, MONGO_URI, API_KEY, SMTP_EMAIL, SMTP_PASSWORD, OPENROUTER_API_KEY, OPENROUTER_MODEL (from server/.env.example); also REDIS_URL, DATABASE_URL (referenced in code/schema). A real `server/.env` exists (not read).
External: Google News RSS, searx.be, YouTube RSS, official NTA/CBSE/MCC/JoSAA/state portals, Gmail SMTP (nodemailer), Apify, RSSHub, browserless, OpenRouter (presence in env example; use in code unverified).

## 8. Data & storage
MongoDB (articles, source health); Prisma DB (NEET counselling; postgres per schema, sqlite-like `prisma/dev.db` file present — mismatch, unverified which is live); Redis (BullMQ queue, `server/dump.rdb`); JSON caches `server/data/dedup_cache.json`, `neet_dedup_cache.json`; portal screenshots + `-diff.png` in `server/data/screenshots` (tracked in git, noisy diffs); logs `server_start.log`, `trace.log`.

## 9. Related projects
- `news-dashboard-windows` : Windows variant (start.bat, `concurrently`, older snapshot, Aug-Sep).
- `autonomous-AI-news-intelligence-system` : separate early Python prototype with the same JEE/NEET intelligence goals; this project is the working JS implementation of that idea (see its context.md).

## 10. Open work
- README/newsdashcontex.md describe Gemini summarization, writers list in ArticleCard, `/api/articles/:id/notify` etc.; verify against code and refresh.
- Many throwaway files in server/ root and src/ (test_*.ts, fix_*.ts, patch_scraper.ts, rewrite*.ts, test_seq*.js, logs, dump.rdb): candidates for cleanup.
- Reconcile Prisma postgres vs dev.db.
- index.ts has verbose "Loaded X" debug logs from an import-hang investigation (Sep).
- `.env` is in .gitignore but server/.env exists on disk.

## 11. Notes for AI sessions
- Do not read or print server/.env. Ignore node_modules, dist, data/screenshots, dump.rdb, *.log, .git-original-backup.
- Summarization is deterministic sentence extraction; do not assume an LLM.
- Root `dev` script uses shell `&` (macOS/Linux); Windows variant uses concurrently.
- iCloud folder: reads/ls can be very slow; avoid recursive diff/find over server/.

<!-- manual:start -->
<!-- manual:end -->
