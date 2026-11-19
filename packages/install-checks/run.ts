// Prepares the fresh projects in this run's own folder, runs the checks there,
// and removes the folder. Arguments go to `playwright test`.
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

import { freshProjectsDir } from "./fresh-projects.ts";

// Ctrl+C stops the child it reaches, and this process removes the folder.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    process.exitCode = 1;
  });
}

try {
  await import("./prepare.ts");
  const { error, status } = spawnSync(
    "playwright",
    ["test", ...process.argv.slice(2)],
    { stdio: "inherit" }
  );
  if (error) {
    throw error;
  }
  process.exitCode = status ?? 1;
} finally {
  rmSync(freshProjectsDir, { force: true, recursive: true });
}
