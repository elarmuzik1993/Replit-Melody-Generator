import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  // Use GitHub Pages base path only when explicitly deploying to GH Pages
  const isGitHubPages = process.env.DEPLOY_TARGET === "github";
  
  return {
    root: "client",
    base: isGitHubPages ? "/Replit-Melody-Generator/" : "/",
    build: {
      outDir: "../dist",
      emptyOutDir: true,
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "client/src"),
        "@shared": path.resolve(__dirname, "shared"),
        "@assets": path.resolve(__dirname, "attached_assets"),
      },
    },
  };
});