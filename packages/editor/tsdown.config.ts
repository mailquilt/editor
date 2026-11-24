import { readFileSync } from "node:fs";

import { defineConfig } from "tsdown";
import type { Rolldown } from "tsdown";

import { licenseOf } from "./licenses.ts";

const packageRoot = /^.*[/\\]node_modules[/\\](?:@[^/\\]+[/\\])?[^/\\]+/u;

/**
 * mjml-browser has packages bundled into its own file, whose licenses
 * scripts/mjml-browser-licenses.ts lists for the version it's run on.
 */
const bundledInMjml = (root: string) => {
  const { version } = JSON.parse(readFileSync(`${root}/package.json`, "utf-8"));
  const listed = readFileSync(
    new URL("mjml-browser-licenses.txt", import.meta.url),
    "utf-8"
  ).trim();
  if (!listed.startsWith(`Bundled in mjml-browser@${version}:`)) {
    throw new Error(
      `mjml-browser-licenses.txt isn't for mjml-browser@${version}. Run: node scripts/mjml-browser-licenses.ts`
    );
  }
  return listed;
};

/** Minifying drops most license notices, which the bundled packages require. */
const thirdPartyLicenses: Rolldown.Plugin = {
  generateBundle(_options, bundle) {
    const roots = Object.values(bundle)
      .flatMap((file) => (file.type === "chunk" ? file.moduleIds : []))
      .flatMap((id) => packageRoot.exec(id)?.[0] ?? []);
    const licenses = [...new Set(roots)].flatMap((root) =>
      /[/\\]mjml-browser$/u.test(root)
        ? [licenseOf(root), bundledInMjml(root)]
        : [licenseOf(root)]
    );
    this.emitFile({
      fileName: "THIRD-PARTY-LICENSES.txt",
      source: `${licenses.join(`\n\n${"-".repeat(72)}\n\n`)}\n`,
      type: "asset",
    });
  },
  name: "third-party-licenses",
};

export default defineConfig([
  {
    dts: true,
    // The texts are an entry of their own, which defines no elements, so a
    // server can read them.
    entry: ["src/index.ts", "src/strings.ts"],
    platform: "browser",
    // The target @repo/typescript-config states.
    target: "es2023",
  },
  // For pages with no bundler, which can't resolve a bare import. Everything is
  // bundled, and MJML stays in a chunk of its own beside the entry. Each file
  // says where the licenses of what's bundled in it are, as minifying drops
  // their own notices.
  {
    banner: {
      js: "/*! Part of @mailquilt/editor's CDN build. The licenses of the packages bundled in it are in THIRD-PARTY-LICENSES.txt, beside this file. */",
    },
    deps: { alwaysBundle: /./u },
    dts: false,
    entry: ["src/index.ts"],
    minify: true,
    outDir: "dist/cdn",
    platform: "browser",
    plugins: [thirdPartyLicenses],
    sourcemap: false,
    target: "es2023",
  },
]);
