import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  cdnPort,
  freshProjectDir,
  freshProjects,
  freshProjectsDir,
} from "./fresh-projects.ts";

const packages = ["core", "renderer", "editor", "react"];
const here = import.meta.dirname;
const tarballs = path.join(freshProjectsDir, "tarballs");

const pnpm = (cwd: string, ...args: string[]) => {
  execFileSync("pnpm", args, { cwd, stdio: "inherit" });
};

rmSync(freshProjectsDir, { force: true, recursive: true });
mkdirSync(tarballs, { recursive: true });

// Packed packages name each other by version, which isn't on npm yet.
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

for (const name of Object.keys(
  freshProjects
) as (keyof typeof freshProjects)[]) {
  const dir = freshProjectDir(name);
  cpSync(path.join(here, "projects", name), dir, { recursive: true });
  cpSync(
    path.join(here, "projects", "starter-email.js"),
    path.join(dir, "starter-email.js")
  );
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

const cdnPage = path.join(freshProjectDir("cdn"), "index.html");
writeFileSync(
  cdnPage,
  readFileSync(cdnPage, "utf-8").replaceAll("CDN_PORT", String(cdnPort))
);
