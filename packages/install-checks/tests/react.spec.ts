import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { expect, test } from "@playwright/test";

import { freshProjectDir, freshProjects } from "../fresh-projects.ts";
import {
  checkLoadSaveExport,
  checkRefusedDocument,
  checkShell,
} from "./load-save-export.ts";

const url = `http://localhost:${freshProjects.react.port}/`;

test("a React project loads, saves and exports an email", async ({ page }) => {
  await checkLoadSaveExport(page, url);
});

test("a refused document reaches onError", async ({ page }) => {
  await checkRefusedDocument(page, url);
});

test("a server-rendered page sends the empty element", async ({ request }) => {
  const response = await request.get(url);

  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("<mail-quilt></mail-quilt>");
});

test("a Server Component can use MailQuilt", async ({ page }) => {
  await page.goto(`${url}server-component`);

  await expect
    .poll(() =>
      page.evaluate(() => customElements.get("mail-quilt") !== undefined)
    )
    .toBe(true);
});

test("the element registers in the browser", async ({ page }) => {
  await page.goto(url);

  await expect
    .poll(() =>
      page.evaluate(() => customElements.get("mail-quilt") !== undefined)
    )
    .toBe(true);
});

test("rendering on a server doesn't register the element", async () => {
  const { stdout } = await promisify(execFile)("node", ["server-render.js"], {
    cwd: freshProjectDir("react"),
  });

  expect(JSON.parse(stdout)).toStrictEqual({
    customElements: "undefined",
    html: "<mail-quilt></mail-quilt>",
    shellHtml: '<mail-quilt-shell save-key="my-app:email"></mail-quilt-shell>',
  });
});

test("a Server Component's Shell opens, saves, exports and refuses", async ({
  page,
}) => {
  await checkShell(page, `${url}shell`);
});

test("a server-rendered Shell sends its attributes", async ({ request }) => {
  const response = await request.get(`${url}shell`);

  expect(response.status()).toBe(200);
  expect(await response.text()).toContain(
    '<mail-quilt-shell save-key="my-app:email"></mail-quilt-shell>'
  );
});
