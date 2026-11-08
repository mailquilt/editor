import { test } from "@playwright/test";

import { freshProjects } from "../fresh-projects.ts";
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
