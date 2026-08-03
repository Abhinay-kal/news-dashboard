# AI News Dashboard Pro

An automated, AI-driven content curation dashboard built with React, Node.js, Express, MongoDB, and Google Gemini. 

This tool automatically scrapes trending news topics via Google News RSS, summarizes the articles into clean bullet points using AI, categorizes them, and presents them in a beautiful UI. It includes editorial workflows for approving, assigning, and emailing content writers.

## Features
- 🤖 **AI Summarization:** Automatically summarizes long articles into 3 bullet points using Google Gemini.
- ⏰ **Automated Cron Jobs:** Runs daily to fetch and curate news automatically.
- ✍️ **Writer Assignments:** Assign articles to writers and automatically notify them via a perfectly formatted email directly from the dashboard.
- 🔍 **Similar Coverage:** One-click search to find how other publishers are covering the exact same topic.
- ➕ **Manual Addition:** Paste any URL or plain text topic to instantly scrape and summarize it on the fly.
- 🎨 **Modern UI:** Built with Tailwind CSS and React Query for a snappy, optimistic-UI experience.

## Prerequisites
Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/en/) (v18 or higher)
- [MongoDB](https://www.mongodb.com/try/download/community) (Running locally or via MongoDB Atlas)
- A [Google Gemini API Key](https://aistudio.google.com/app/apikey) (Free)
- A Google Account with an [App Password](https://myaccount.google.com/apppasswords) for sending automated emails.

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
Open your terminal and install dependencies for both the frontend and backend.

```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 2. Environment Setup
Navigate to the `server` directory and rename the `.env.example` file to `.env` (or create a new `.env` file).

Fill in the following variables:
```env
PORT=5001
MONGO_URI=mongodb://localhost:27017/news-dashboard
API_KEY=your_google_gemini_api_key_here
SMTP_EMAIL=your_email@gmail.com
SMTP_PASSWORD=your_16_character_app_password
```

### 3. Start the Application
You need to run two terminal windows to start the frontend and backend separately.

**Terminal 1 (Backend):**
```bash
cd server
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd client
npm run dev
```

Visit `http://localhost:5173` in your browser to view the dashboard!

---

## Customization

### Changing the Writers List
To update the list of writers that appears in the assignment dropdown, open `client/src/components/ArticleCard.tsx` and modify the `WRITERS` array at the top of the file:

```typescript
const WRITERS = [
	{ name: "Unassigned", email: "" },
	{ name: "Jane Doe", email: "jane@example.com" },
	{ name: "John Smith", email: "john@example.com" },
];
```

### Changing the Scraping Schedule
By default, the automated scraper runs every day at 9:00 AM (Asia/Kolkata timezone). To change this, open `server/src/index.ts` and modify the cron schedule string:

```typescript
cron.schedule("0 9 * * *", () => { ... }) // Change to your preferred time
```
