import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import cartographer from "@replit/vite-plugin-cartographer"; // import normally

export default defineConfig({
  root: ".", // index.html is in project root
  base: "/Replit-Melody-Generator/", // GitHub Pages base path
  build: {
    outDir: path.resolve(__dirname, "dist"), // build output folder
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "index.html"), // point to root index.html
    },
  },
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
      ? [await import("@replit/vite-plugin-cartographer").then((m) => m.cartographer())]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"), // main.tsx is here
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
