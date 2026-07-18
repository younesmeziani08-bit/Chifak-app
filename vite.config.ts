import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  appType: "spa",
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    // Redirige les appels API vers le backend -> tout sur le même origine (5173)
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
    // Autorise l'accès via un lien public (tunnel) type *.trycloudflare.com
    allowedHosts: true,
  },
  preview: {
    port: 5173,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
