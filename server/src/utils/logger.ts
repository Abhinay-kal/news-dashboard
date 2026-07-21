import pino from "pino";

// Create a Pino logger instance
const logger = pino({
	level: process.env.LOG_LEVEL || "info",
	// In development, we use pino-pretty for human-readable logs in the terminal.
	// In production, we let it output raw JSON for log aggregators (like Datadog/AWS).
	transport:
		process.env.NODE_ENV !== "production"
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

export default logger;
