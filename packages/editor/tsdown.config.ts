import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { defineConfig } from "tsdown";
import type { Rolldown } from "tsdown";

const packageRoot = /^.*[/\\]node_modules[/\\](?:@[^/\\]+[/\\])?[^/\\]+/u;

const licenseOf = (root: string) => {
  const { author, license, name, version } = JSON.parse(
    readFileSync(path.join(root, "package.json"), "utf-8")
  );
  const file = readdirSync(root).find((each) => /^licen[cs]e/iu.test(each));
  // A package with no license file still gets its copyright line.
  const text = file
    ? readFileSync(path.join(root, file), "utf-8").trim()
    : `Copyright (c) ${author?.name ?? author}`;
  return `${name}@${version} (${license})\n\n${text}`;
};

/** Minifying drops most license notices, which the bundled packages require. */
const thirdPartyLicenses: Rolldown.Plugin = {
  generateBundle(_options, bundle) {
    const roots = Object.values(bundle)
      .flatMap((file) => (file.type === "chunk" ? file.moduleIds : []))
      .flatMap((id) => packageRoot.exec(id)?.[0] ?? []);
    const licenses = [...new Set(roots)].map(licenseOf);
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
    entry: ["src/index.ts"],
    platform: "browser",
  },
  // For pages with no bundler, which can't resolve a bare import. Everything is
  // bundled, and MJML stays in a chunk of its own beside the entry.
  {
    deps: { alwaysBundle: /./u },
    dts: false,
    entry: ["src/index.ts"],
    minify: true,
    outDir: "dist/cdn",
    platform: "browser",
    plugins: [thirdPartyLicenses],
    sourcemap: false,
  },
]);
