"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pino_1 = __importDefault(require("pino"));
// Create a Pino logger instance
const logger = (0, pino_1.default)({
    level: process.env.LOG_LEVEL || "info",
    // In development, we use pino-pretty for human-readable logs in the terminal.
    // In production, we let it output raw JSON for log aggregators (like Datadog/AWS).
    transport: process.env.NODE_ENV !== "production"
        ? {
            target: "pino-pretty",
            options: {
                colorize: true,
                translateTime: "SYS:standard",
                ignore: "pid,hostname",
            },
        }
        : undefined,
});
exports.default = logger;
//# sourceMappingURL=logger.js.map