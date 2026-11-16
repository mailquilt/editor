import { tmpdir } from "node:os";
import path from "node:path";

/** Outside the repo, so pnpm can't find its workspace from a fresh project. */
export const freshProjectsDir = path.join(tmpdir(), "mailquilt-install-checks");

export const freshProjects = {
  cdn: { port: 4177 },
  "plain-js": { port: 4175 },
  react: { port: 4176 },
  "react-vite": { port: 4180 },
} as const;

/** Serves `@mailquilt/editor` as a CDN would. */
export const cdnPort = 4178;

export const freshProjectDir = (name: keyof typeof freshProjects) =>
  path.join(freshProjectsDir, name);
