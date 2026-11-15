// Writes mjml-browser-licenses.txt: the licenses of the packages mjml-browser
// bundles into its own file, which the CDN build passes on. The bundle doesn't
// say which those are, so they're found from MJML's build for the browser:
// every package `mjml` can reach, less those it leaves out. That can list a
// package it doesn't use, but never misses one. MJML's dependencies install
// afresh, so a version, and its license text, can be newer than the one
// bundled. Run it when mjml-browser changes version:
// node scripts/mjml-browser-licenses.ts
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

import { licenseOf } from "../licenses.ts";

// The renderer is what depends on it.
const fromRenderer = createRequire(
  createRequire(import.meta.url).resolve("@mailquilt/renderer/package.json")
);
const mjmlBrowser = JSON.parse(
  readFileSync(fromRenderer.resolve("mjml-browser/package.json"), "utf-8")
);
const { version } = mjmlBrowser;

// From its webpack.config.js: what it starts from, the polyfills it adds, and
// what it leaves out or replaces with an empty stand-in.
const STARTS = [
  "mjml-core",
  "mjml-preset-core",
  "mjml-validator",
  "buffer",
  "os-browserify",
  "path-browserify",
  "process",
];
const LEFT_OUT = new Set([
  "cheerio",
  "cosmiconfig",
  "cssnano-preset-lite",
  "htmlnano",
  "terser",
  "undici",
]);

const packageName = (specifier: string) =>
  specifier
    .split("/")
    .slice(0, specifier.startsWith("@") ? 2 : 1)
    .join("/");

const scriptsIn = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const file = path.join(directory, name);
    if (name === "node_modules") {
      return [];
    }
    if (statSync(file).isDirectory()) {
      return scriptsIn(file);
    }
    return /\.[cm]?js$/u.test(name) ? [file] : [];
  });

/** Packages named in its scripts that it depends on: what a bundler follows. */
const importsOf = (root: string, dependencies: string[]) => {
  const wanted = new Set(dependencies);
  const found = new Set<string>();
  for (const file of scriptsIn(root)) {
    const source = readFileSync(file, "utf-8");
    for (const { groups } of source.matchAll(
      /(?:require\(|from |import\()\s*["'](?<specifier>[^"'.][^"']*)["']/gu
    )) {
      const name = packageName(groups?.specifier ?? "");
      if (wanted.has(name)) {
        found.add(name);
      }
    }
  }
  return found;
};

const workspace = mkdtempSync(path.join(tmpdir(), "mjml-browser-"));
try {
  writeFileSync(path.join(workspace, "package.json"), "{}");
  const dependencies = Object.entries(mjmlBrowser.dependencies ?? {}).map(
    ([name, range]) => `${name}@${range}`
  );
  execFileSync(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      `mjml@${version}`,
      "os-browserify",
      ...dependencies,
    ],
    { cwd: workspace, stdio: "inherit" }
  );

  /** As Node finds it from `from`: in the nearest node_modules that has it. */
  const locate = (name: string, from: string) => {
    for (let directory = from; ; directory = path.dirname(directory)) {
      const root = path.join(directory, "node_modules", name);
      if (existsSync(root)) {
        return root;
      }
      if (directory === workspace) {
        return;
      }
    }
  };

  const reached = new Set<string>();
  const queue = STARTS.map((name) => ({ from: workspace, name }));
  for (let next = queue.shift(); next; next = queue.shift()) {
    const root = LEFT_OUT.has(next.name)
      ? undefined
      : locate(next.name, next.from);
    if (root && !reached.has(root)) {
      reached.add(root);
      const manifest = JSON.parse(
        readFileSync(path.join(root, "package.json"), "utf-8")
      );
      for (const name of importsOf(
        root,
        Object.keys(manifest.dependencies ?? {})
      )) {
        queue.push({ from: root, name });
      }
    }
  }

  // Copies of one version in two places are listed once.
  const licenses = [...new Set([...reached].map(licenseOf))].toSorted();
  writeFileSync(
    new URL("../mjml-browser-licenses.txt", import.meta.url),
    `Bundled in mjml-browser@${version}:\n\n${licenses.join(
      `\n\n${"-".repeat(72)}\n\n`
    )}\n`
  );
} finally {
  rmSync(workspace, { force: true, recursive: true });
}
