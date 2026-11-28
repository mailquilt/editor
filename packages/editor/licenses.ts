import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** Each license's standard text, after its copyright line. */
const STANDARD_TEXTS = {
  ISC: `Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`,
  MIT: `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
};

/** For a package with no license file: its copyright line, then its license. */
const standardText = (name: string, license: string, author?: string) => {
  // Such as slick's "MIT (http://mootools.net/license.txt)", but not "MIT-0".
  const id = /^(?:ISC|MIT)(?=$|\s)/u.exec(license)?.[0] as
    | keyof typeof STANDARD_TEXTS
    | undefined;
  if (!(id && author)) {
    throw new Error(
      `${name} has no license file. Add the standard text for ${license}, with its copyright holder.`
    );
  }
  return `${id} License\n\nCopyright (c) ${author}\n\n${STANDARD_TEXTS[id]}`;
};

/** A package's name, version and license, from its folder. */
export const licenseOf = (root: string) => {
  const manifest = JSON.parse(
    readFileSync(path.join(root, "package.json"), "utf-8")
  );
  const { author, name, version } = manifest;
  const license: string | undefined =
    manifest.license?.type ?? manifest.license ?? manifest.licenses?.[0]?.type;
  if (!license) {
    throw new Error(`${name} has no license in its package.json.`);
  }
  const file = readdirSync(root).find((each) => /^licen[cs]e/iu.test(each));
  return `${name}@${version} (${license})\n\n${
    file
      ? readFileSync(path.join(root, file), "utf-8").trim()
      : standardText(name, license, author?.name ?? author)
  }`;
};
