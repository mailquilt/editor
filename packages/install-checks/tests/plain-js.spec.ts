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

test("a plain JS project's Shell opens, saves and reopens", async ({
  page,
}) => {
  await checkShell(page, `${url}shell/`);
});

test("the docs' server code builds, renders and refuses an email in Node", async () => {
  const { stdout } = await promisify(execFile)(
    "node",
    [
      "--input-type=module",
      "--eval",
      `const { email } = await import("./server/build-an-email.js");
       const { htmlFor } = await import("./server/render.js");
       const refusal = await htmlFor({ kind: "blocks" }).catch(({ message }) => message);
       console.log("RESULT" + JSON.stringify({ html: await htmlFor(email), refusal }));`,
    ],
    { cwd: freshProjectDir("plain-js") }
  );
  const { html, refusal } = JSON.parse(
    stdout.slice(stdout.indexOf("RESULT") + "RESULT".length)
  );

  expect(html).toContain("{{first_name}}");
  expect(refusal).toMatch(/^This email can't be sent/u);
});

test("the docs' Merge Tag code fills and escapes each value, in text and in a link, with spaces inside its braces, and refuses a tag with no value", async () => {
  const { stdout } = await promisify(execFile)(
    "node",
    [
      "--input-type=module",
      "--eval",
      `const { createEditor } = await import("@mailquilt/core");
       const { email } = await import("./server/build-an-email.js");
       const { htmlFor } = await import("./server/render.js");
       const { fillMergeTags } = await import("./server/fill-merge-tags.js");
       const editor = createEditor({ document: email });
       const button = editor.apply({ blockType: "button", rowIndex: 0, type: "insertBlockInNewRow" });
       editor.apply({ blockId: button.createdId, props: { href: "{{ cta_url }}" }, type: "updateBlockProps" });
       const text = editor.apply({ blockType: "text", rowIndex: 0, type: "insertBlockInNewRow" });
       const paragraph = { content: [{ text: "Signed up as {{ customer.preferred_name }}.", type: "text" }], type: "paragraph" };
       editor.apply({ blockId: text.createdId, props: { content: { content: [paragraph], type: "doc" } }, type: "updateBlockProps" });
       const html = await htmlFor(editor.getDocument());
       const filled = fillMergeTags(html, {
         cta_url: "https://example.com/track?id=1&to=2",
         "customer.preferred_name": "Ada",
         first_name: "Ada <b>&</b> \\"Lovelace\\" O'Brien",
       });
       let missing;
       try {
         fillMergeTags(html, { "customer.preferred_name": "Ada", first_name: "Ada" });
       } catch ({ message }) {
         missing = message;
       }
       console.log("RESULT" + JSON.stringify({ filled, missing }));`,
    ],
    { cwd: freshProjectDir("plain-js") }
  );
  const { filled, missing } = JSON.parse(
    stdout.slice(stdout.indexOf("RESULT") + "RESULT".length)
  );

  expect(filled).toContain(
    "Hi Ada &lt;b&gt;&amp;&lt;/b&gt; &quot;Lovelace&quot; O&#39;Brien, your order has shipped."
  );
  expect(filled).toContain('href="https://example.com/track?id=1&amp;to=2"');
  expect(filled).toContain("Signed up as Ada.");
  expect(filled).not.toMatch(/\{\{[^{}]+\}\}/u);
  expect(missing).toBe("No value for {{ cta_url }}");
});
