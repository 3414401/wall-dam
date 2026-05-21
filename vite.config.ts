import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages: 레포 이름이 team-wall-app 이면 /team-wall-app/
const base = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
