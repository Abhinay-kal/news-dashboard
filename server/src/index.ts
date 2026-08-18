console.log("Loading index.ts...");
import cors from "cors"; console.log("Loaded cors");
import dotenv from "dotenv"; console.log("Loaded dotenv");
import express from "express"; console.log("Loaded express");
import mongoose from "mongoose"; console.log("Loaded mongoose");
import http from "http"; console.log("Loaded http");
import { Server } from "socket.io"; console.log("Loaded socket.io");
import articleRoutes from "./routes/articleRoutes"; console.log("Loaded articleRoutes");
import cron from "node-cron"; console.log("Loaded node-cron");
import { spawn } from "child_process"; console.log("Loaded child_process");
import Article from "./models/Article"; console.log("Loaded Article model");
import { checkCriticalAlerts } from "./services/alertService"; console.log("Loaded alertService");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
	cors: { origin: "*" } 
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Allows our React frontend to talk to this API
app.use(express.json()); // Allows us to read JSON bodies in POST/PATCH requests

// Routes
app.use("/api/articles", articleRoutes);

let scrapingStatus = {
	isScraping: false,
	totalFeeds: 0,
	processedFeeds: 0,
	currentFeed: "",
	message: ""
};

app.get("/api/refresh/status", (req, res) => {
	res.json(scrapingStatus);
});

app.post("/api/refresh", (req, res) => {
	if (scrapingStatus.isScraping) {
		return res.status(400).json({ message: "Scraping already in progress" });
	}
	runWorker();
	res.json({ message: "Worker job started" });
});

// Database Connection
if (!process.env.MONGO_URI) {
	console.error("MONGO_URI is not defined in .env file");
	process.exit(1);
}
const runWorker = (attempt = 1) => {
	if (scrapingStatus.isScraping && attempt === 1) {
		console.log("[Worker] Job already running. Ignoring request.");
		return;
	}

	console.log(`[Worker] Starting scraping job (Attempt ${attempt})...`);
	scrapingStatus = {
		isScraping: true,
		totalFeeds: scrapingStatus.totalFeeds || 0,
		processedFeeds: 0,
		currentFeed: "",
		message: "Starting up the worker process..."
	};

	const child = spawn("npx", ["tsx", "src/worker.ts"]);

	child.stdout.on('data', (data) => {
		const lines = data.toString().split('\n');
		for (const line of lines) {
			if (!line.trim()) continue;
			console.log(`[Worker stdout] ${line}`);
			
			if (line.includes("Loaded") && line.includes("dynamic feed URLs")) {
				const match = line.match(/Loaded (\d+) dynamic/);
				if (match) scrapingStatus.totalFeeds = parseInt(match[1]);
			}
			if (line.includes("Fetching articles from")) {
				const match = line.match(/from (.*)\.\.\./);
				if (match) {
					scrapingStatus.currentFeed = match[1];
					scrapingStatus.processedFeeds += 1;
					scrapingStatus.message = `Processing feed ${scrapingStatus.processedFeeds}/${scrapingStatus.totalFeeds}`;
				}
			}
		}
	});

	child.stderr.on('data', (data) => {
		console.error(`[Worker stderr] ${data.toString().trim()}`);
	});

	child.on('close', (code) => {
		console.log(`[Worker] child process exited with code ${code}`);
		scrapingStatus.isScraping = false;
		if (code !== 0) {
			scrapingStatus.message = "Failed or finished with errors.";
			if (attempt <= 3) {
				const delayMs = Math.pow(2, attempt) * 60000;
				console.log(`[Worker] Retrying in ${delayMs / 60000} minutes...`);
				setTimeout(() => runWorker(attempt + 1), delayMs);
			}
		} else {
			scrapingStatus.message = "Finished successfully.";
		}
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

// Fast Polling Cron Job for P0 Alerts (Runs every hour)
cron.schedule("0 * * * *", () => {
	checkCriticalAlerts(io);
});

// TEST ENDPOINT — fire a fake P0 alert to verify the notification system
app.get("/api/test-alert", (_req, res) => {
	io.emit("high-priority-alert", {
		title: "🚨 P0 Test Alert: CEE Kerala NEET",
		message: "Kerala NEET UG 2026 Round 2 seat allotment result published — check now!",
		url: "https://cee.kerala.gov.in"
	});
	res.json({ success: true, message: "Test alert fired!" });
});

server.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
