import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  define: {
    // Ensure Supabase env vars are always available in preview
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || "https://zqgvevdoeftqmjreszzr.supabase.co"),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxZ3ZldmRvZWZ0cW1qcmVzenpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MzY3MDYsImV4cCI6MjA4ODAxMjcwNn0.2JzsFCigPZZLLWw-9MUZ7MK0O4ipropzO-BKaF1Edlg"),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
