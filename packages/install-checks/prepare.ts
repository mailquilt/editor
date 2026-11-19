import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  freshProjectDir,
  freshProjectsDir,
  projectNames,
} from "./fresh-projects.ts";

const packages = ["core", "renderer", "editor", "react"];
const here = import.meta.dirname;
/** The code the quick start shows, which each fresh project is built from. */
const quickStart = path.join(
  here,
  "..",
  "..",
  "apps",
  "docs",
  "docs",
  "_quick-start"
);
/** The Shell's examples, each copied into a fresh project as a page of its own. */
const shellExamples = path.join(quickStart, "..", "_shell");
const shellPages = {
  nextjs: path.join("app", "shell"),
  "plain-js": "shell",
  "react-vite": "src",
} as const;
/** Where each quick start imports the starter email from. */
const starterEmailDirs = {
  cdn: ".",
  nextjs: "app",
  "plain-js": ".",
  "react-vite": "src",
} as const;
/** The docs' server-side examples, run in Node against the packed packages. */
const serverCode = path.join(quickStart, "..", "_code");
/** The Next.js guide's own files, added to the Next.js project. */
const nextjsGuide = path.join(quickStart, "..", "_nextjs");
const tarballs = path.join(freshProjectsDir, "tarballs");

const pnpm = (cwd: string, ...args: string[]) => {
  execFileSync("pnpm", args, { cwd, stdio: "inherit" });
};

mkdirSync(tarballs, { recursive: true });

// Packed packages name each other by version, so each is pointed at its
// tarball, or the install would fetch that version from npm instead.
const overrides = packages
  .map((name) => {
    const { filename } = JSON.parse(
      execFileSync("pnpm", ["pack", "--json", "--pack-destination", tarballs], {
        cwd: path.join(here, "..", name),
        encoding: "utf-8",
      })
    );
    return `  "@mailquilt/${name}": "file:${filename}"`;
  })
  .join("\n");

for (const name of projectNames) {
  const dir = freshProjectDir(name);
  cpSync(path.join(here, "projects", name), dir, { recursive: true });
  cpSync(path.join(quickStart, name), dir, { recursive: true });
  cpSync(
    path.join(here, "projects", "starter-email.js"),
    path.join(dir, starterEmailDirs[name], "starter-email.js")
  );
  if (name === "plain-js") {
    cpSync(serverCode, path.join(dir, "server"), { recursive: true });
  }
  if (name === "nextjs") {
    cpSync(nextjsGuide, dir, { recursive: true });
  }
  if (name in shellPages) {
    cpSync(
      path.join(shellExamples, name),
      path.join(dir, shellPages[name as keyof typeof shellPages]),
      { recursive: true }
    );
  }
  writeFileSync(
    path.join(dir, "pnpm-workspace.yaml"),
    `overrides:\n${overrides}\n`
  );
  pnpm(dir, "install");
  // A page with no bundler has no build step.
  if (name !== "cdn") {
    pnpm(dir, "run", "build");
  }
}
