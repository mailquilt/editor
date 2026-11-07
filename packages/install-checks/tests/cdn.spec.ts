import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { cdnPort, freshProjects } from "../fresh-projects.ts";
import { checkLoadSaveExport } from "./load-save-export.ts";

const pageUrl = `http://localhost:${freshProjects.cdn.port}/`;
const cdnBuildUrl = `http://localhost:${cdnPort}/dist/cdn/`;

/** Checks `load` fetches MJML from beside the CDN build, and that nothing did before. */
const checkMjmlLoadsOnlyFor = async (page: Page, load: () => Promise<void>) => {
  const fetched: string[] = [];
  page.on("request", (request) => fetched.push(request.url()));
  await page.goto(pageUrl);
  await expect(page.getByRole("textbox", { name: "Text Block" })).toHaveText(
    "Hello"
  );
  const fetchedBeforehand = fetched.length;

  await load();

  const mjml = fetched.slice(fetchedBeforehand);
  expect(mjml).toHaveLength(1);
  expect(mjml[0]).toContain(cdnBuildUrl);
};

test("a page with no bundler loads, saves and exports an email", async ({
  page,
}) => {
  await checkLoadSaveExport(page, pageUrl);
});

test("a refused document fires mq-error", async ({ page }) => {
  await page.goto(pageUrl);
  const text = page.getByRole("textbox", { name: "Text Block" });
  await expect(text).toHaveText("Hello");

  await page.evaluate(() => {
    const editor = document.querySelector("mail-quilt") as unknown as {
      value: unknown;
    };
    editor.value = { kind: "blocks", rows: [], version: 2 };
  });

  await expect(page.getByTestId("load-error")).toContainText(
    /version 2 is newer/iu
  );
  await expect(text).toHaveText("Hello");
});

test("MJML loads from beside the CDN build, only for export", async ({
  page,
}) => {
  await checkMjmlLoadsOnlyFor(page, async () => {
    await page.getByRole("button", { name: "Export HTML" }).click();
    await expect(page.getByTestId("exported-html")).toContainText("Hello");
  });
});

test("MJML loads from beside the CDN build, only for preview", async ({
  page,
}) => {
  await checkMjmlLoadsOnlyFor(page, async () => {
    await page.getByRole("button", { exact: true, name: "Preview" }).click();
    await expect(
      page.frameLocator("iframe[title='Email preview']").locator("body")
    ).toContainText("Hello");
  });
});
