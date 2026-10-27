const { spawn } = require("child_process");
const path = require("path");

console.log("====================================================");
console.log("🚀 Starting Site Visual Diff Monitor...");
console.log("📡 Backend: http://localhost:5002");
console.log("💻 Frontend: http://localhost:5175");
console.log("====================================================");

const server = spawn("node", ["--experimental-strip-types", "server/src/monitorServer.ts"], {
	stdio: "inherit",
	shell: true,
	env: { ...process.env, PORT: process.env.PORT || "5002" },
});

const clientPort = process.env.CLIENT_PORT || "5175";
const client = spawn(
	process.platform === "win32" ? "npm.cmd" : "npm",
	["run", "dev", "--prefix", "client", "--", "--port", clientPort],
	{
		stdio: "inherit",
		shell: true,
		env: { ...process.env, VITE_API_URL: "http://localhost:5002" },
	}
);

server.on("error", (err) => console.error("[Server Error]", err));
client.on("error", (err) => console.error("[Client Error]", err));

function cleanup() {
	server.kill();
	client.kill();
	process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
