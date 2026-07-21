import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fetchRssFeed } from './services/rssService';
import { determineCategory, generateSummary } from './services/summarizationService';
import Article from './models/Article';

dotenv.config();

/**
 * BACKGROUND WORKER
 * This process runs completely independently of the Express API server.
 */

const TARGET_RSS_FEED = 'https://news.ycombinator.com/rss'; // Example feed

async function runScrapingJob() {
  console.log(`[Worker] Starting scraping job at ${new Date().toISOString()}`);
  
  try {
    // We would connect to the DB here in a real scenario
    // await mongoose.connect(process.env.MONGO_URI as string);
    console.log('[Worker] Connected to database (Simulated).');
    
    // 1. RSS Service: Fetch raw articles
    console.log(`[Worker] Step 1: Fetching articles from ${TARGET_RSS_FEED}...`);
    const rawArticles = await fetchRssFeed(TARGET_RSS_FEED);
    
    const runDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const processedArticles = [];

    // 2. Summarization Service: Process each article
    console.log(`[Worker] Step 2: Processing ${rawArticles.length} articles...`);
    for (const raw of rawArticles.slice(0, 5)) { // Limit to 5 for demo purposes
      console.log(`Processing: ${raw.title}`);
      
      const category = determineCategory(raw.originalContent || raw.title);
      const summary = await generateSummary(raw.originalContent || raw.title);
      
      processedArticles.push({
        title: raw.title,
        sourceUrl: raw.sourceUrl,
        topicCategory: category,
        summary: summary,
        status: 'PENDING',
        runDate: runDate
      });
    }
    
    // 3. Article Model: Save to database
    console.log(`[Worker] Step 3: Saving ${processedArticles.length} articles to database...`);
    // await Article.insertMany(processedArticles);
    console.log('[Worker] Database save successful (Simulated).');
    
  } catch (error) {
    console.error('[Worker] Error during scraping job:', error);
  } finally {
    // await mongoose.disconnect();
    console.log('[Worker] Job completed.');
  }
}

runScrapingJob();
