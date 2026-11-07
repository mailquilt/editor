import { tmpdir } from "node:os";
import path from "node:path";

/** Outside the repo, so pnpm can't find its workspace from a fresh project. */
export const freshProjectsDir = path.join(tmpdir(), "mailquilt-install-checks");

export const freshProjects = {
  "plain-js": { port: 4175 },
  react: { port: 4176 },
} as const;

export const freshProjectDir = (name: keyof typeof freshProjects) =>
  path.join(freshProjectsDir, name);
