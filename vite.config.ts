import { defineConfig } from "vite";

export default defineConfig({
  base: "/first-captain/",
  build: { chunkSizeWarningLimit: 900 },
});