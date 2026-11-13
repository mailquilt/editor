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

test("rendering on a server doesn't register the element", async () => {
  const { stdout } = await promisify(execFile)("node", ["server-render.js"], {
    cwd: freshProjectDir("react"),
  });

  expect(JSON.parse(stdout)).toStrictEqual({
    customElements: "undefined",
    html: "<mail-quilt></mail-quilt>",
    shellHtml:
      '<mail-quilt-shell actions="export-html" save-key="my-app:email"></mail-quilt-shell>',
  });
});

test("a Server Component's Shell opens, saves and reopens", async ({
  page,
}) => {
  await checkShell(page, `${url}shell`);
});
