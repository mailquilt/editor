import { test } from "@playwright/test";

import { freshProjects } from "../ports.ts";
import {
  checkLoadSaveExport,
  checkRefusedSavedEmail,
} from "./load-save-export.ts";

const url = `http://localhost:${freshProjects.angular.port}/`;

test("an Angular app loads, saves and exports an email", async ({ page }) => {
  await checkLoadSaveExport(page, url);
});

test("an Angular app hears mq-error for the saved email it opens", async ({
  page,
}) => {
  await checkRefusedSavedEmail(page, url);
});
