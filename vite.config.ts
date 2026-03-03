import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const repoRoot = import.meta.dirname;
const devCertKeyPath = path.resolve(repoRoot, "certs", "dev-ipad.key");
const devCertCrtPath = path.resolve(repoRoot, "certs", "dev-ipad.crt");
const useDevHttps = process.env.VITE_DEV_HTTPS === "1";
const hasDevCerts = fs.existsSync(devCertKeyPath) && fs.existsSync(devCertCrtPath);
const devHttpsConfig =
  useDevHttps && hasDevCerts
    ? {
        key: fs.readFileSync(devCertKeyPath),
        cert: fs.readFileSync(devCertCrtPath),
      }
    : undefined;

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(repoRoot, "client"),
  build: {
    outDir: path.resolve(repoRoot, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    https: devHttpsConfig,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
