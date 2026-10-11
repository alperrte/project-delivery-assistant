#!/usr/bin/env node
// `npm run analyze`: a webpack production build with @next/bundle-analyzer switched on (ANALYZE=1). It writes the treemap
// reports to .next/analyze/ and replaces .next, so run it when no dev/start server uses this folder.
// Turbopack alternative that does not touch the normal build: `npx next experimental-analyze`.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const result = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build", "--webpack"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, ANALYZE: "1" },
});
process.exit(result.status ?? 1);
