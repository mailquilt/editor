import { test } from "@playwright/test";

import { freshProjects } from "../fresh-projects.ts";
import {
  checkLoadSaveExport,
  checkRefusedDocument,
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
