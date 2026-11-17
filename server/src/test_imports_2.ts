console.log("Starting test imports 2");
process.on('uncaughtException', (err) => { console.error("UNCAUGHT EXCEPTION:", err); process.exit(1); });
process.on('unhandledRejection', (err) => { console.error("UNHANDLED REJECTION:", err); process.exit(1); });
import "./utils/logger";
import "cors";
import "dotenv";
import "express";
import "helmet";
import "express-rate-limit";
import "mongoose";
import "http";
import "socket.io";
console.log("Imported socket.io");

try {
  require("./routes/articleRoutes");
  console.log("Imported articleRoutes via require");
} catch(err) {
  console.error("ERROR importing articleRoutes:", err);
}
console.log("Done");
