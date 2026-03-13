import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  define: {
    global: "globalThis",
    "process.env": {},
    "process.browser": true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      buffer: "buffer/",
    },
  },
  optimizeDeps: {
    include: ["buffer", "@perawallet/connect"],
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
});
