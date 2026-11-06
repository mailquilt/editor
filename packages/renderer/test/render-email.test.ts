import { execFileSync } from "node:child_process";

import type { BlocksDocument } from "@mailquilt/core";
import { describe, expect, it } from "vitest";

import { renderEmail } from "../src/node.js";

const emailWithText = (...paragraphs: string[]): BlocksDocument => ({
  kind: "blocks",
  rows: [
    {
      columns: [
        {
          blocks: [
            {
              id: "block-1",
              props: {
                content: {
                  content: paragraphs.map((text) =>
                    text
                      ? {
                          content: [{ text, type: "text" }],
                          type: "paragraph",
                        }
                      : { type: "paragraph" }
                  ),
                  type: "doc",
                },
              },
              type: "text",
            },
          ],
          id: "column-1",
          props: {},
          width: 100,
        },
      ],
      id: "row-1",
      props: {},
    },
  ],
  settings: {
    backgroundColor: "#f4f4f5",
    fontFamily: "Arial, Helvetica, sans-serif",
    width: 600,
  },
  version: 1,
});

describe(renderEmail, () => {
  it("matches the saved HTML for one Text Block", async () => {
    const html = await renderEmail(
      emailWithText("Hello {{first_name}},", "", "Welcome aboard.")
    );

    await expect(html).toMatchFileSnapshot("expected/one-text-block.html");
  });

  it("keeps Merge Tags intact", async () => {
    const html = await renderEmail(emailWithText("Hi {{first_name}}!"));

    expect(html).toContain("Hi {{first_name}}!");
  });

  it("escapes text so it can't become markup", async () => {
    const html = await renderEmail(
      emailWithText(`<script>alert("x")</script> & </mj-text>`)
    );

    expect(html).toContain(
      `&lt;script&gt;alert("x")&lt;/script&gt; &amp; &lt;/mj-text&gt;`
    );
    expect(html).not.toContain("<script>");
  });

  it("keeps repeated spaces, as the canvas shows them", async () => {
    const html = await renderEmail(emailWithText("a    b", "   "));

    expect(html).toContain(
      '<p style="margin:0;white-space:pre-wrap">a    b</p>'
    );
    expect(html).toContain('<p style="margin:0;white-space:pre-wrap">   </p>');
  });

  it("refuses a Block type it can't render", async () => {
    const email = emailWithText("Hi");
    const block = email.rows[0]?.columns[0]?.blocks[0];
    if (block) {
      block.type = "hologram";
    }

    await expect(renderEmail(email)).rejects.toThrow(/hologram/u);
  });

  it("runs in plain Node with no DOM, editor or Tiptap code loaded", () => {
    // Runs the built package in its own process, because the test runner's own
    // modules would hide what the package actually loads.
    const script = `
      import { registerHooks } from "node:module";
      const loaded = [];
      registerHooks({
        resolve(specifier, context, nextResolve) {
          const result = nextResolve(specifier, context);
          loaded.push(result.url);
          return result;
        },
      });
      const { renderEmail } = await import("@mailquilt/renderer");
      const html = await renderEmail(${JSON.stringify(emailWithText("Hi {{first_name}}"))});
      console.log(JSON.stringify({
        hasDom: typeof document !== "undefined" || typeof window !== "undefined",
        html,
        loaded,
      }));
    `;

    const output = execFileSync(
      process.execPath,
      ["--input-type=module", "--no-warnings", "-e", script],
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
    );
    const { hasDom, html, loaded } = JSON.parse(output) as {
      hasDom: boolean;
      html: string;
      loaded: string[];
    };

    expect(hasDom).toBeFalsy();
    expect(html).toContain("Hi {{first_name}}");
    expect(loaded.some((url) => url.includes("/mjml/"))).toBeTruthy();
    expect(
      loaded.filter((url) =>
        /tiptap|prosemirror|\/node_modules\/lit|\/packages\/editor\//u.test(url)
      )
    ).toStrictEqual([]);
  });
});
