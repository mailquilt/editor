import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
/**
 * The starter email the setup pages show, and each folder whose samples import
 * it from beside them.
 */
const starterEmails = {
  cdn: { dirs: ["."], file: "starter-email.js" },
  nextjs: { dirs: ["app"], file: "starter-email.ts" },
  "plain-js": { dirs: [".", "save", "shell"], file: "starter-email.js" },
  "react-vite": { dirs: ["src"], file: "starter-email.ts" },
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
const packed: Record<string, string> = Object.fromEntries(
  packages.map((name) => {
    const { filename } = JSON.parse(
      execFileSync("pnpm", ["pack", "--json", "--pack-destination", tarballs], {
        cwd: path.join(here, "..", name),
        encoding: "utf-8",
      })
    );
    return [`@mailquilt/${name}`, filename];
  })
);
// The repo's TypeScript reads the published types, as the packages' own checks do.
const { devDependencies } = JSON.parse(
  readFileSync(path.join(here, "..", "..", "package.json"), "utf-8")
);
const overrides = Object.entries({
  ...Object.fromEntries(
    Object.entries(packed).map(([name, file]) => [name, `file:${file}`])
  ),
  typescript: devDependencies.typescript,
})
  .map(([name, version]) => `  "${name}": "${version}"`)
  .join("\n");

interface Listed {
  dependencies?: Record<string, Listed>;
  devDependencies?: Record<string, Listed>;
  resolved?: string;
}

/**
 * Throws unless every package of ours the project installed is the tarball
 * packed here. Once a version is on npm, one fetched from there would pass.
 */
const checkInstalledFromTarballs = (dir: string) => {
  const listed: Listed[] = JSON.parse(
    execFileSync("pnpm", ["list", "--json", "--depth", "Infinity"], {
      cwd: dir,
      encoding: "utf-8",
    })
  );
  const pending = [...listed];
  for (const each of pending) {
    for (const [name, dependency] of Object.entries({
      ...each.dependencies,
      ...each.devDependencies,
    })) {
      const tarball = packed[name];
      const from = dependency.resolved?.replace(/^file:/u, "");
      if (tarball && (!from || path.resolve(dir, from) !== tarball)) {
        throw new Error(
          `${dir} installed ${name} from ${dependency.resolved}, not ${tarball}`
        );
      }
      pending.push(dependency);
    }
  }
};

for (const name of projectNames) {
  const dir = freshProjectDir(name);
  cpSync(path.join(here, "projects", name), dir, { recursive: true });
  cpSync(path.join(quickStart, name), dir, { recursive: true });
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
  const { dirs, file } = starterEmails[name];
  for (const each of dirs) {
    cpSync(path.join(quickStart, file), path.join(dir, each, file));
  }
  writeFileSync(
    path.join(dir, "pnpm-workspace.yaml"),
    `overrides:\n${overrides}\n`
  );
  pnpm(dir, "install");
  checkInstalledFromTarballs(dir);
  // A page with no bundler has no build step.
  if (name !== "cdn") {
    pnpm(dir, "run", "build");
  }
}
