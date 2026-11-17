# News Dashboard - Full Project Context (AI Rebuild Instructions)

This document provides the complete context, architecture, and exact technical implementation details required for an AI assistant to rebuild this exact project from scratch.

## 1. Project Overview & Architecture
News Dashboard is a full-stack, AI-powered web application that automates the daily curation of news articles. 
- **Backend:** Node.js, Express, TypeScript, MongoDB (Mongoose)
- **Frontend:** React (Vite), TypeScript, Tailwind CSS, React Query
- **Core Loop:** A scheduled cron job scrapes Google News RSS, extracts HTML body text, uses Google Gemini Flash Lite to summarize it into bullet points, and saves it to a database. The frontend allows editors to review, manually add, assign to writers, and notify them via SMTP email.

---

## 2. Project Directory Structure
If rebuilding from scratch, follow this Monorepo structure:
```text
news-dashboard/
├── package.json (root workspace)
├── server/
│   ├── package.json
│   ├── .env
│   ├── src/
│   │   ├── index.ts (Express server, Cron setup, DB connection)
│   │   ├── worker.ts (Standalone scraping script called by cron)
│   │   ├── models/
│   │   │   └── Article.ts (Mongoose schema)
│   │   ├── routes/
│   │   │   └── articleRoutes.ts (CRUD & API endpoints)
│   │   └── services/
│   │       └── summarizationService.ts (Gemini LLM logic)
├── client/
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── index.css (Tailwind imports)
│   │   ├── App.tsx (React Query Provider & Layout)
│   │   └── components/
│   │       ├── DailyView.tsx (Main dashboard)
│   │       └── ArticleCard.tsx (Individual article UI)
```

---

## 3. Database Schema (`server/src/models/Article.ts`)
Must use Mongoose. The schema is critical for state management.
```typescript
import mongoose, { Schema, Document } from "mongoose";

export interface IArticle extends Document {
	title: string;
	sourceUrl: string; // CRITICAL: Must be unique to prevent duplicates
	topicCategory: string;
	summary: string[];
	status: "PENDING" | "APPROVED" | "REJECTED";
	postStatus: "PENDING" | "POSTED" | "NOT_POSTED";
	assignedTo?: string;
	runDate: string; // Format: YYYY-MM-DD
}

const ArticleSchema = new Schema({
	title: { type: String, required: true },
	sourceUrl: { type: String, required: true, unique: true }, 
	topicCategory: { type: String, required: true },
	summary: { type: [String], required: true },
	status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" },
	postStatus: { type: String, enum: ["PENDING", "POSTED", "NOT_POSTED"], default: "PENDING" },
	assignedTo: { type: String, required: false },
	runDate: { type: String, required: true, index: true },
}, { timestamps: true });

export default mongoose.model<IArticle>("Article", ArticleSchema);
```

---

## 4. Critical Implementation Details (Backend)

### A. Environment Variables (`server/.env`)
```env
PORT=5001
MONGO_URI=mongodb://localhost:27017/news-dashboard
API_KEY=your_gemini_api_key
SMTP_EMAIL=your_email@gmail.com
SMTP_PASSWORD=your_16_char_google_app_password
```

### B. Execution & Cron Logic (`server/src/index.ts`)
- The server runs via `tsx src/index.ts` (using `nodemon` for dev).
- **Startup Check:** On startup, if the time is past 9:00 AM and `Article.countDocuments({ runDate: today }) === 0`, it spawns the worker to catch up.
- **Cron Job:** `node-cron` runs exactly at `0 9 * * *` (9:00 AM Asia/Kolkata).
- **Worker Spawning:** The worker is executed as a separate process: `exec("npx tsx src/worker.ts")`. If it fails, implement exponential backoff retry logic (2m, 4m, 8m).

### C. Scraping & Concurrency (`server/src/worker.ts`)
- Use `rss-parser` to hit Google News RSS.
- **Google News URL format:** `https://news.google.com/rss/search?q={query}&hl=en-IN&gl=IN&ceid=IN:en`
- Use `cheerio` to clean HTML: 
  `$('script, style, nav, footer, iframe, noscript').remove(); content = $('body').text().replace(/\s+/g, ' ').trim();`
- **Race Condition Prevention:** When saving articles, use `Article.findOneAndUpdate({ sourceUrl: link }, articleData, { upsert: true, new: true })`. This guarantees no duplicates even if multiple async promises resolve simultaneously.

### D. LLM Summarization (`server/src/services/summarizationService.ts`)
- Must use `@google/genai` library with the `gemini-3.5-flash-lite` model.
- **Prompt requirement:** Instruct the LLM to read the raw HTML text and return exactly a 3-bullet-point summary and a short category string.
- Return format must be explicitly requested as JSON:
  `{ "category": "Tech", "summary": ["Point 1", "Point 2", "Point 3"] }`

### E. Email Notifications (`server/src/routes/articleRoutes.ts`)
- Implement `POST /api/articles/:id/notify`.
- Use `nodemailer.createTransport` with `service: "gmail"` using `process.env.SMTP_EMAIL` and `SMTP_PASSWORD`.
- The email `html` body must include the article `title`, an anchor link to the `sourceUrl`, and an `<ul>` list mapping over the `summary` array.

---

## 5. Critical Implementation Details (Frontend)

### A. API Integration (`client/src/components/DailyView.tsx`)
- Wrap the app in `<QueryClientProvider>`.
- Use `@tanstack/react-query` to fetch articles (`useQuery`) based on the `runDate` state.
- Create `useMutation` hooks for:
  - `PATCH /api/articles/:id/status` (Review status)
  - `PATCH /api/articles/:id/postStatus` (Post status)
  - `PATCH /api/articles/:id/assign` (Writer assignment)
  - `DELETE /api/articles/:id` (Delete)
  - `POST /api/articles/:id/notify` (Send email)
- After every mutation success, call `queryClient.invalidateQueries({ queryKey: ["articles", runDate] })` to auto-refresh the UI.

### B. UI / UX Design (`ArticleCard.tsx`)
- Must use Tailwind CSS for all styling.
- **Layout:** Flexbox for headers. `space-y-6` for article lists.
- **Color Coding:** 
  - APPROVED = `text-green-600`
  - REJECTED = `text-red-600`
  - PENDING = `text-yellow-600`
- **Dropdowns:** Include HTML `<select>` elements for `postStatus` and `assignedTo`.
- **Writers List:** Hardcode a `WRITERS` array in the component: `{ name: "Rachit Dadhich", email: "rachit.dadhich@matrixedu.in" }`
- **Notify Button:** Only render the "✉️ Notify" button if `article.assignedTo` is truthy.

### C. The "Similar Coverage" Feature
- In `ArticleCard.tsx`, include a "Show Similar Coverage" toggle button.
- When clicked, it calls `GET /api/articles/:id/similar`.
- **Backend Logic for Similar:** The backend takes the article title, strips the publisher name (usually the text after the last hyphen `-`), URL-encodes the core title, hits Google News RSS with it, and returns up to 3 links that do NOT contain the original publisher's name.

### D. Manual Addition 
- Add an input field at the top of `DailyView.tsx`.
- Calls `POST /api/articles/manual`.
- **Backend Logic for Manual:** If the input starts with `http`, fetch the URL and scrape it. If it doesn't, treat it as a topic query, hit Google News RSS, grab the top link, and scrape that instead.
