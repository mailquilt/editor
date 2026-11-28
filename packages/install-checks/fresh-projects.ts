import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";

export const projectNames = [
  "angular",
  "cdn",
  "nextjs",
  "plain-js",
  "react-18-vite",
  "react-vite",
  "svelte",
  "vue",
] as const;
export type ProjectName = (typeof projectNames)[number];

/** Holds this run's ports, which `run.ts` picks once the projects are built. */
export const portsVariable = "MAILQUILT_INSTALL_CHECKS_PORTS";

// Each run has its own folder, and its own ports, so two checkouts can run the
// checks at once. `run.ts` picks them, and Playwright and its workers inherit
// them through the environment. `run.ts` removes the folder, so it always makes
// its own, and a variable left in a shell can't make it remove another one.
const folderVariable = "MAILQUILT_INSTALL_CHECKS_FOLDER";
const startedByRun = path.basename(process.argv[1] ?? "") === "run.ts";
const folder =
  (startedByRun ? undefined : process.env[folderVariable]) ??
  // Outside the repo, so pnpm can't find its workspace from a fresh project.
  path.join(tmpdir(), `mailquilt-install-checks-${randomUUID()}`);
process.env[folderVariable] = folder;

export const freshProjectsDir = folder;

export const freshProjectDir = (name: ProjectName) =>
  path.join(freshProjectsDir, name);
