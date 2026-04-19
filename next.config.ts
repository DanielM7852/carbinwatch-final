import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

// Anchor to this directory (where next.config.ts lives), not cwd and not a parent
// package-lock.json — fixes /api routes and broken PostCSS resolution from C:\Users\…
const projectRoot = path.dirname(fileURLToPath(import.meta.url));
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
