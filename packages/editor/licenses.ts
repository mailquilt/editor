import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** A package's name, version and license, from its folder. */
export const licenseOf = (root: string) => {
  const { author, license, name, version } = JSON.parse(
    readFileSync(path.join(root, "package.json"), "utf-8")
  );
  const file = readdirSync(root).find((each) => /^licen[cs]e/iu.test(each));
  // A package with no license file still gets its copyright line.
  const text = file
    ? readFileSync(path.join(root, file), "utf-8").trim()
    : `Copyright (c) ${author?.name ?? author}`;
  return `${name}@${version} (${license?.type ?? license})\n\n${text}`;
};
