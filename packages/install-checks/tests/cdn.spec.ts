import { expect, test } from "@playwright/test";
import type { Response } from "@playwright/test";

import { cdnPort, freshProjects } from "../ports.ts";
import {
  checkLoadSaveExport,
  checkRefusedDocument,
} from "./load-save-export.ts";

const pageUrl = `http://localhost:${freshProjects.cdn.port}/`;
const cdnBuildUrl = `http://localhost:${cdnPort}/dist/cdn/`;

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
  expect(licenses).toContain("Permission is hereby granted");
});
