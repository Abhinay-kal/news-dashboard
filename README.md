# News Dashboard (Content Curation)

A full-stack daily content curation dashboard that ingests RSS feeds, categorizes content using a hybrid keyword/LLM pipeline, and presents summaries in a fast, cached React interface for human review.

## 🏗 Architecture Overview

This repository is split into two primary environments:

1.  **Frontend (`/client`)**
    *   **Framework:** React 19 + Vite
    *   **Styling:** Tailwind CSS v4
    *   **State & Caching:** TanStack React Query
    *   **Pattern:** Stale-While-Revalidate caching for instantaneous date-based navigation.

2.  **Backend (`/server`)**
    *   **Framework:** Node.js + Express
    *   **Database:** MongoDB (via Mongoose)
    *   **Data Ingestion:** Dedicated Background Worker process (`worker.ts`) decoupled from the API server.
    *   **Logging:** Pino (Structured JSON Logging)

## ✨ Core Features

*   **Decoupled ETL Worker:** Heavy RSS parsing and AI summarization happens in a dedicated background worker, completely preventing the Express API from blocking the Node.js event loop.
*   **Hybrid Summarization Pipeline:** Optimizes cost and speed by using Regex keyword-matching for generic topic categorization, saving the LLM tokens exclusively for bullet-point summarization.
*   **Instant Date Navigation:** React Query caches the `runDate` queries, ensuring that navigating back and forth between previous days requires zero network latency.

## 🚀 Getting Started

### Prerequisites
*   Node.js (v20+)
*   MongoDB (Local instance or Atlas URI)

### Backend Setup
1. Navigate to the server directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the API Server:
   ```bash
   npm run dev
   ```
4. *Optional:* Run the background worker to fetch new articles:
   ```bash
   npx ts-node src/worker.ts
   ```

### Frontend Setup
1. Navigate to the client directory:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the Vite development server:
   ```bash
   npm run dev
   ```

## 🛡 Code Quality & CI/CD
This project utilizes **Biome** for instantaneous formatting and linting across the entire repository. A GitHub Action is configured in `.github/workflows/ci.yml` to automatically run `npx @biomejs/biome ci .` on every pull request, ensuring code quality and blocking merging if standards are not met.
