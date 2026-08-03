import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import articleRoutes from "./routes/articleRoutes";
import cron from "node-cron";
import { exec } from "child_process";
import Article from "./models/Article";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Allows our React frontend to talk to this API
app.use(express.json()); // Allows us to read JSON bodies in POST/PATCH requests

// Routes
app.use("/api/articles", articleRoutes);

// Database Connection
if (!process.env.MONGO_URI) {
	console.error("MONGO_URI is not defined in .env file");
	process.exit(1);
}
const runWorker = (attempt = 1) => {
	console.log(`[Worker] Starting scraping job (Attempt ${attempt})...`);
	exec("npx tsx src/worker.ts", (error, stdout, stderr) => {
		if (error) {
			console.error(`[Worker] Execution error: ${error.message}`);
			if (attempt <= 3) {
				const delayMs = Math.pow(2, attempt) * 60000; // Exponential backoff: 2m, 4m, 8m
				console.log(`[Worker] Retrying in ${delayMs / 60000} minutes...`);
				setTimeout(() => runWorker(attempt + 1), delayMs);
			}
			return;
		}
		if (stderr) console.error(`[Worker] stderr: ${stderr}`);
		console.log(`[Worker] finished:\n${stdout}`);
	});
};

const checkMissedRun = async () => {
	try {
		const now = new Date();
		const today = now.toISOString().split("T")[0];
		
		// If the server starts and it is past 9 AM local time
		if (now.getHours() >= 9) {
			const count = await Article.countDocuments({ runDate: today } as any);
			if (count === 0) {
				console.log("[Startup Check] Past 9 AM and no articles found for today. Running catch-up job!");
				runWorker();
			}
		}
	} catch (error) {
		console.error("Error during startup check:", error);
	}
};

mongoose.connect(process.env.MONGO_URI)
	.then(() => {
		console.log("Connected to MongoDB");
		checkMissedRun();
	})
	.catch((err) => console.error("MongoDB connection error:", err));

// Automated Cron Job (Runs exactly at 9:00 AM if server is already running)
cron.schedule("0 9 * * *", () => {
	console.log("[Cron] 9:00 AM reached.");
	runWorker();
}, {
	timezone: "Asia/Kolkata"
} as any);

app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
