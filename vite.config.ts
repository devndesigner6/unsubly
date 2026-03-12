import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react()],
    define: {
      global: "globalThis",
      "process.env": {},
      "process.browser": true,
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(env.VITE_SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(env.VITE_SUPABASE_PUBLISHABLE_KEY),
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
