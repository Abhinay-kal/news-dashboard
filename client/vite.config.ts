import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const backendTarget = process.env.VITE_API_URL || "http://localhost:5002";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		host: true,
		proxy: {
			"/api": {
				target: backendTarget,
				changeOrigin: true,
			},
			"/screenshots": {
				target: backendTarget,
				changeOrigin: true,
			},
		},
	},
});
