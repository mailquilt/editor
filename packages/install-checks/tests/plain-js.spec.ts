import { test } from "@playwright/test";

import { freshProjects } from "../fresh-projects.ts";
import { checkLoadSaveExport } from "./load-save-export.ts";

test("a plain JS project loads, saves and exports an email", async ({
  page,
}) => {
  await checkLoadSaveExport(
    page,
    `http://localhost:${freshProjects["plain-js"].port}/`
  );
});
