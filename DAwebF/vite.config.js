import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
// Note: Avoid aggressive manualChunks for @mui + react — can cause
// "Cannot access before initialization" (TDZ) in production bundles.
export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2020",
    cssMinify: true,
    sourcemap: false,
    chunkSizeWarningLimit: 700,
  },
});
