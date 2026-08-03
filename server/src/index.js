"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
console.log("Index loaded!");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const articleRoutes_1 = __importDefault(require("./routes/articleRoutes"));
const node_cron_1 = __importDefault(require("node-cron"));
const child_process_1 = require("child_process");
const Article_1 = __importDefault(require("./models/Article"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Middleware
app.use((0, cors_1.default)()); // Allows our React frontend to talk to this API
app.use(express_1.default.json()); // Allows us to read JSON bodies in POST/PATCH requests
// Routes
app.use("/api/articles", articleRoutes_1.default);
// Database Connection
if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not defined in .env file");
    process.exit(1);
}
const runWorker = (attempt = 1) => {
    console.log(`[Worker] Starting scraping job (Attempt ${attempt})...`);
    (0, child_process_1.exec)("npx tsx src/worker.ts", (error, stdout, stderr) => {
        if (error) {
            console.error(`[Worker] Execution error: ${error.message}`);
            if (attempt <= 3) {
                const delayMs = Math.pow(2, attempt) * 60000; // Exponential backoff: 2m, 4m, 8m
                console.log(`[Worker] Retrying in ${delayMs / 60000} minutes...`);
                setTimeout(() => runWorker(attempt + 1), delayMs);
            }
            return;
        }
        if (stderr)
            console.error(`[Worker] stderr: ${stderr}`);
        console.log(`[Worker] finished:\n${stdout}`);
    });
};
const checkMissedRun = async () => {
    try {
        const now = new Date();
        const today = now.toISOString().split("T")[0];
        // If the server starts and it is past 9 AM local time
        if (now.getHours() >= 9) {
            const count = await Article_1.default.countDocuments({ runDate: today });
            if (count === 0) {
                console.log("[Startup Check] Past 9 AM and no articles found for today. Running catch-up job!");
                runWorker();
            }
        }
    }
    catch (error) {
        console.error("Error during startup check:", error);
    }
};
mongoose_1.default.connect(process.env.MONGO_URI)
    .then(() => {
    console.log("Connected to MongoDB");
    checkMissedRun();
})
    .catch((err) => console.error("MongoDB connection error:", err));
// Automated Cron Job (Runs exactly at 9:00 AM if server is already running)
node_cron_1.default.schedule("0 9 * * *", () => {
    console.log("[Cron] 9:00 AM reached.");
    runWorker();
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
//# sourceMappingURL=index.js.map