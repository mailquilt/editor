import { test } from "@playwright/test";

import { freshProjects } from "../ports.ts";
import {
  checkLoadSaveExport,
  checkRefusedDocument,
  checkShell,
} from "./load-save-export.ts";

const url = `http://localhost:${freshProjects["react-vite"].port}/`;

test("a React app built with Vite loads, saves and exports an email", async ({
  page,
}) => {
  await checkLoadSaveExport(page, url);
});

test("a refused document reaches onError in a Vite React app", async ({
  page,
}) => {
  await checkRefusedDocument(page, url);
});

test("a Vite React app's Shell opens, saves and reopens", async ({ page }) => {
  await checkShell(page, `${url}shell/`);
});
