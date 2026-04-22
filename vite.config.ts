/// <reference types="vitest" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl = env.VITE_SUPABASE_URL;
  const backendPublishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!backendUrl || !backendPublishableKey) {
    console.warn(
      "[vite.config] WARNING: VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are not set. " +
      "The app will fail at runtime until these are provided."
    );
  }

  return {
    server: {
      host: "0.0.0.0",
      port: 5000,
      allowedHosts: true,
    },
    plugins: [
      react(),
      {
        name: "dev-api-routes",
        async configureServer(server) {
          // Lazy-import the shared handlers so any import errors surface clearly.
          const {
            aiOptimizerHandler,
            agentRunHandler,
            advanceBillingHandler,
            agentRegistryHandler,
          } = await import("./server/handlers.mjs");

          const wrap = (h: (req: any, res: any) => Promise<void>) =>
            async (req: any, res: any, next: any) => {
              try { await h(req, res); }
              catch (err) {
                console.error("[dev-api]", err);
                if (!res.headersSent) {
                  res.statusCode = 500;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ error: "Internal server error" }));
                }
                next?.();
              }
            };

          server.middlewares.use("/api/ai-optimizer",   wrap(aiOptimizerHandler));
          server.middlewares.use("/api/agent-run",      wrap(agentRunHandler));
          server.middlewares.use("/api/advance-billing",wrap(advanceBillingHandler));
          server.middlewares.use("/api/agent/registry", wrap(agentRegistryHandler));
        },
      },
    ],
    define: {
      global: "globalThis",
      "process.env": {},
      "process.browser": true,
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(backendUrl ?? ""),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(backendPublishableKey ?? ""),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        buffer: "buffer/",
      },
    },
    optimizeDeps: {
      include: ["buffer", "@perawallet/connect"],
      esbuildOptions: { define: { global: "globalThis" } },
    },
    test: {
      environment: "happy-dom",
      globals: true,
      include: ["src/**/*.test.ts", "src/**/*.test.tsx", "server/**/*.test.mjs"],
      coverage: { provider: "v8", reporter: ["text", "html"] },
    },
  };
});
