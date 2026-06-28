import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/search": "http://127.0.0.1:8000",
      "/cases": "http://127.0.0.1:8000",
      "/agent": "http://127.0.0.1:8000",
      "/discover": "http://127.0.0.1:8000",
      "/assets": "http://127.0.0.1:8000",
      "/data": "http://127.0.0.1:8000",
    },
  },
});
