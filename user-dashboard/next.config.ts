import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
// Load .env* from this folder even if `npm run dev` was started with a different cwd (fixes missing DYNAMODB_TABLE_NAME).
loadEnvConfig(projectRoot);

// Anchor to this directory (where next.config.ts lives), not cwd and not a parent
// package-lock.json — fixes /api routes and broken PostCSS resolution from C:\Users\…
const tailwindRoot = path.join(projectRoot, "node_modules", "tailwindcss");

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
    resolveAlias: {
      tailwindcss: tailwindRoot,
    },
  },
};

export default nextConfig;
