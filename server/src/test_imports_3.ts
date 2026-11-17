console.log("Starting test imports 3");
const originalExit = process.exit;
process.exit = function(code) {
  console.error("PROCESS.EXIT CALLED WITH CODE:", code);
  console.error(new Error().stack);
  return originalExit.call(process, code);
};
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
require("./routes/articleRoutes");
console.log("Done");
