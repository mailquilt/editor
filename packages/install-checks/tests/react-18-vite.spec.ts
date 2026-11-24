import { expect, test } from "@playwright/test";

import { freshProjects } from "../ports.ts";
import {
  checkLoadSaveExport,
  checkRefusedDocument,
  checkShell,
} from "./load-save-export.ts";

const url = `http://localhost:${freshProjects["react-18-vite"].port}/`;

test("a React 18 app built with Vite loads, saves and exports an email", async ({
  page,
}) => {
  await checkLoadSaveExport(page, url);
});

test("a refused document reaches onError in a React 18 app", async ({
  page,
}) => {
  await checkRefusedDocument(page, url);
});

test("a React 18 app's Shell opens, saves and reopens", async ({ page }) => {
  await checkShell(page, `${url}shell/`);
});

test("className reaches a React 18 app's element as its class, and false leaves hidden and inert off", async ({
  page,
}) => {
  await page.goto(`${url}props/`);
  const editor = page.locator("mail-quilt");

  await expect(editor).toHaveClass("editor");
  await expect(editor).not.toHaveAttribute("hidden");
  await expect(editor).not.toHaveAttribute("inert");
  await expect(page.getByRole("textbox", { name: "Text Block" })).toHaveText(
    "Hello"
  );
});
