import { globSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";
import type { Response } from "@playwright/test";

import { freshProjectDir } from "../fresh-projects.ts";
import { cdnPort, freshProjects } from "../ports.ts";
import {
  checkLoadSaveExport,
  checkRefusedDocument,
} from "./load-save-export.ts";

const pageUrl = `http://localhost:${freshProjects.cdn.port}/`;
const cdnBuildUrl = `http://localhost:${cdnPort}/dist/cdn/`;
const repoRoot = path.join(import.meta.dirname, "../../..");

/** Only MJML itself has this. The renderer's own output never uses it. */
const mjmlOnly = "mj-accordion";

const urlsWithMjml = async (responses: Response[]) => {
  const checked = await Promise.all(
    responses.map(async (each) => {
      const body = await each.text();
      return { hasMjml: body.includes(mjmlOnly), url: each.url() };
    })
  );
  return checked.filter(({ hasMjml }) => hasMjml).map(({ url }) => url);
};

test("a page with no bundler loads, saves and exports an email", async ({
  page,
}) => {
  await checkLoadSaveExport(page, pageUrl);
});

test("a refused document fires mq-error", async ({ page }) => {
  await checkRefusedDocument(page, pageUrl);
});

test("the CDN build registers the Shell too", async ({ page }) => {
  await page.goto(pageUrl);

  await expect
    .poll(() =>
      page.evaluate(() => customElements.get("mail-quilt-shell") !== undefined)
    )
    .toBe(true);
});

test("MJML loads from beside the CDN build, only for export", async ({
  page,
}) => {
  const fetched: Response[] = [];
  page.on("response", (response) => fetched.push(response));
  await page.goto(pageUrl);
  await expect(page.getByRole("textbox", { name: "Text Block" })).toHaveText(
    "Hello"
  );
  const fetchedBeforehand = [...fetched];
  expect(await urlsWithMjml(fetchedBeforehand)).toStrictEqual([]);

  await page.getByRole("button", { name: "Export HTML" }).click();
  await expect(page.getByTestId("exported-html")).toContainText("Hello");

  const mjml = await urlsWithMjml(fetched.slice(fetchedBeforehand.length));
  expect(mjml).toHaveLength(1);
  expect(mjml[0]).toContain(cdnBuildUrl);
});

test("the CDN build lists the license of each package it bundles", async ({
  request,
}) => {
  const response = await request.get(`${cdnBuildUrl}THIRD-PARTY-LICENSES.txt`);
  expect(response.ok()).toBe(true);
  const licenses = await response.text();

  // lodash and juice are inside mjml-browser's own file.
  for (const name of [
    "cheerio",
    "juice",
    "lit",
    "lodash",
    "mjml-browser",
    "prosemirror-view",
  ]) {
    expect(licenses).toMatch(new RegExp(`^${name}@`, "mu"));
  }
  // Each entry is its package's name, then its license. A copyright line
  // alone isn't the license. The packages inside mjml-browser's own file
  // follow a line that says so.
  const withoutText = licenses
    .split(`\n${"-".repeat(72)}\n`)
    .map((entry) =>
      entry
        .trim()
        .replace(/^Bundled in .*\n+/u, "")
        .split("\n")
    )
    .filter(([, ...text]) =>
      text.every((line) => line.trim() === "" || /^copyright/iu.test(line))
    )
    .map(([header]) => header);
  expect(withoutText).toStrictEqual([]);
});

test("every CDN URL in the docs and READMEs names the editor's version", () => {
  const { version } = JSON.parse(
    readFileSync(
      path.join(
        freshProjectDir("cdn"),
        "node_modules/@mailquilt/editor/package.json"
      ),
      "utf-8"
    )
  );
  // The places a host copies a URL from. The skill's `<version>` isn't one.
  const files = globSync(
    [
      "PROJECT.md",
      "README.md",
      "apps/docs/docs/**/*",
      "packages/*/README.md",
      "skills/**/*",
    ],
    { cwd: repoRoot, withFileTypes: true }
  ).filter((each) => each.isFile());
  const urls = files.flatMap((each) => {
    const file = path.join(each.parentPath, each.name);
    return [
      ...readFileSync(file, "utf-8").matchAll(
        /\/@mailquilt\/editor@(?<named>\d[^/\s]*)\//gu
      ),
    ].map((match) => ({
      file: path.relative(repoRoot, file),
      version: match.groups?.named,
    }));
  });

  expect(urls.length).toBeGreaterThan(0);
  expect(urls.filter((url) => url.version !== version)).toStrictEqual([]);
});
