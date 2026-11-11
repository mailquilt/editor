import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { expect, test } from "@playwright/test";

import { freshProjectDir, freshProjects } from "../fresh-projects.ts";
import {
  checkLoadSaveExport,
  checkRefusedDocument,
  checkShell,
} from "./load-save-export.ts";

const url = `http://localhost:${freshProjects["plain-js"].port}/`;

test("a plain JS project loads, saves and exports an email", async ({
  page,
}) => {
  await checkLoadSaveExport(page, url);
});

test("a refused document fires mq-error", async ({ page }) => {
  await checkRefusedDocument(page, url);
});

test("a plain JS project's Shell opens, saves, exports and refuses", async ({
  page,
}) => {
  await checkShell(page, `${url}shell/`);
});

test("the docs' server code builds and renders an email in Node", async () => {
  const { stdout } = await promisify(execFile)(
    "node",
    [
      "--input-type=module",
      "--eval",
      `const { email } = await import("./server/build-an-email.js");
       const { htmlFor } = await import("./server/render.js");
       console.log("RESULT" + JSON.stringify(await htmlFor(email)));`,
    ],
    { cwd: freshProjectDir("plain-js") }
  );

  expect(
    JSON.parse(stdout.slice(stdout.indexOf("RESULT") + "RESULT".length))
  ).toContain("{{first_name}}");
});
