import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { expect, test } from "@playwright/test";

import { freshProjectDir, freshProjects } from "../fresh-projects.ts";
import {
  checkLoadSaveExport,
  checkRefusedDocument,
  checkShell,
} from "./load-save-export.ts";

const url = `http://localhost:${freshProjects.nextjs.port}/`;

/** The docs' example email, as an app would have saved it. */
const exampleEmail: unknown = JSON.parse(
  readFileSync(
    path.join(
      import.meta.dirname,
      "../../../apps/docs/docs/_document-format/example-email.json"
    ),
    "utf-8"
  )
);

test("a Next.js project loads, saves and exports an email", async ({
  page,
}) => {
  await checkLoadSaveExport(page, url);
});

test("a refused document reaches onError in a Next.js project", async ({
  page,
}) => {
  await checkRefusedDocument(page, url);
});

test("renders on a server, with nothing for the element there", async () => {
  const { stdout } = await promisify(execFile)("node", ["server-render.js"], {
    cwd: freshProjectDir("nextjs"),
  });

  expect(JSON.parse(stdout)).toStrictEqual({
    html: "<mail-quilt></mail-quilt>",
    shellHtml:
      '<mail-quilt-shell actions="export-html" save-key="my-app:email"></mail-quilt-shell>',
  });
});

test("a Route Handler renders a saved email, and says why it refuses one", async ({
  request,
}) => {
  const rendered = await request.post(`${url}email-html`, {
    data: exampleEmail,
  });
  expect(rendered.status()).toBe(200);
  expect(rendered.headers()["content-type"]).toContain("text/html");
  const html = await rendered.text();
  expect(html).toMatch(/<!doctype html>/iu);
  expect(html).toContain("Thanks, {{first_name}}");

  const refused = await request.post(`${url}email-html`, {
    data: { kind: "blocks" },
  });
  expect(refused.status()).toBe(422);
  const { reason } = await refused.json();
  expect(reason).toContain("rows");
});

test("a Server Component's Shell opens, saves and reopens", async ({
  page,
}) => {
  await checkShell(page, `${url}shell`);
});
