import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const mainBackend = "http://localhost:5001";
const monitorBackend = process.env.VITE_MONITOR_URL || mainBackend;

// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		host: true,
		proxy: {
			"/api/monitor": {
				target: monitorBackend,
				changeOrigin: true,
			},
			"/api": {
				target: mainBackend,
				changeOrigin: true,
			},
			"/screenshots": {
				target: mainBackend,
				changeOrigin: true,
			},
			"/socket.io": {
				target: mainBackend,
				ws: true,
				changeOrigin: true,
			},
		},
	},
});
