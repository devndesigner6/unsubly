import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl = env.VITE_SUPABASE_URL || "https://ipnywrvwszqlaykbkske.supabase.co";
  const backendPublishableKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlwbnl3cnZ3c3pxbGF5a2Jrc2tlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTg0NDksImV4cCI6MjA4ODQ3NDQ0OX0.xUcUpKQ52PVFGAjKokKDwhf9p8RZYmEOgMmu7HAm-sk";

  return {
    server: {
      host: "0.0.0.0",
      port: 5000,
      allowedHosts: true,
    },
    plugins: [react()],
    define: {
      global: "globalThis",
      "process.env": {},
      "process.browser": true,
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(backendUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(backendPublishableKey),
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
  };
});
