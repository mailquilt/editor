import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { gzipSync } from "node:zlib";

/** The CDN build, which sits beside the build the package's name resolves to. */
const findCdnBuild = () =>
  path.join(
    path.dirname(createRequire(import.meta.url).resolve("@mailquilt/editor")),
    "cdn"
  );

const gzipped = (file: string) => gzipSync(readFileSync(file)).byteLength;

/**
 * What a page downloads for the editor, gzipped, measured from this build so the
 * site never quotes an old number. `editor` is everything the editor needs to
 * run. `mjml` is the file it fetches the first time someone previews or exports.
 */
export const editorSize = () => {
  const directory = findCdnBuild();
  const sizes = readdirSync(directory)
    .filter((file) => file.endsWith(".js"))
    .map((file) => ({ file, size: gzipped(path.join(directory, file)) }));
  // MJML is the chunk beside the entry, and by far the largest file.
  let mjml: (typeof sizes)[number] | undefined;
  for (const entry of sizes) {
    if (entry.file !== "index.js" && entry.size > (mjml?.size ?? 0)) {
      mjml = entry;
    }
  }
  if (mjml === undefined) {
    throw new Error(`No MJML file in ${directory}. Has the build changed?`);
  }
  const all = sizes.reduce((total, { size }) => total + size, 0);
  return { editor: all - mjml.size, mjml: mjml.size };
};
