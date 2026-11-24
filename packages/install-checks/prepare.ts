import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  freshProjectDir,
  freshProjectsDir,
  projectNames,
} from "./fresh-projects.ts";
import type { ProjectName } from "./fresh-projects.ts";

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
 * it from beside them. Vue, Angular and Svelte's is typed from the editor.
 */
const starterEmails = {
  angular: { dirs: ["src/app"], file: "other-frameworks/starter-email.ts" },
  cdn: { dirs: ["."], file: "starter-email.js" },
  nextjs: { dirs: ["app"], file: "starter-email.ts" },
  "plain-js": { dirs: [".", "save", "shell"], file: "starter-email.js" },
  "react-vite": { dirs: ["src"], file: "starter-email.ts" },
  svelte: { dirs: ["src"], file: "other-frameworks/starter-email.ts" },
  vue: { dirs: ["src"], file: "other-frameworks/starter-email.ts" },
} as const;
/** Read by each project with TypeScript, which its build type-checks. */
const publishedTypes = {
  file: path.join(here, "published-types.ts"),
  into: { nextjs: "app", "react-vite": "src" },
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
// The repo's TypeScript reads the published types, as the packages' own checks
// do. Vue's, Angular's and Svelte's checkers call TypeScript's JS API, which
// TypeScript 7 doesn't have, so those projects take the TypeScript they name.
const { devDependencies } = JSON.parse(
  readFileSync(path.join(here, "..", "..", "package.json"), "utf-8")
);
const ownTypeScript = new Set<ProjectName>(["angular", "svelte", "vue"]);
/**
 * Angular's build tools have install scripts it builds without, and pnpm 11
 * won't install a package whose scripts are neither allowed nor declined.
 */
const declinedBuilds = [
  "@parcel/watcher",
  "esbuild",
  "lmdb",
  "msgpackr-extract",
];

const workspaceFor = (project: ProjectName) => {
  const overrides: Record<string, string> = Object.fromEntries(
    Object.entries(packed).map(([name, file]) => [name, `file:${file}`])
  );
  if (!ownTypeScript.has(project)) {
    overrides.typescript = devDependencies.typescript;
  }
  return [
    "overrides:",
    ...Object.entries(overrides).map(
      ([name, version]) => `  "${name}": "${version}"`
    ),
    ...(project === "angular"
      ? ["allowBuilds:", ...declinedBuilds.map((name) => `  "${name}": false`)]
      : []),
    "",
  ].join("\n");
};

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

for (const project of projectNames) {
  const dir = freshProjectDir(project);
  // The React project with React 18. It's built from the same code, and its
  // own files then replace the React project's.
  const name = project === "react-18-vite" ? "react-vite" : project;
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
  if (name in publishedTypes.into) {
    cpSync(
      publishedTypes.file,
      path.join(
        dir,
        publishedTypes.into[name as keyof typeof publishedTypes.into],
        "published-types.ts"
      )
    );
  }
  const { dirs, file } = starterEmails[name];
  for (const each of dirs) {
    cpSync(
      path.join(quickStart, file),
      path.join(dir, each, path.basename(file))
    );
  }
  if (project !== name) {
    cpSync(path.join(here, "projects", project), dir, { recursive: true });
  }
  writeFileSync(path.join(dir, "pnpm-workspace.yaml"), workspaceFor(project));
  pnpm(dir, "install");
  checkInstalledFromTarballs(dir);
  // A page with no bundler has no build step.
  if (name !== "cdn") {
    pnpm(dir, "run", "build");
  }
}
