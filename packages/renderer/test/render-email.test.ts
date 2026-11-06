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

  // MJML's strict validation rejects more than CSS does, so anything that loads
  // has to get through it, or an email could be edited but never exported.
  const accepted: [string, (email: BlocksDocument) => void][] = [
    [
      "a short hex color",
      (email) => {
        email.settings.backgroundColor = "#FFF";
      },
    ],
    [
      "an rgb() color",
      (email) => {
        email.settings.backgroundColor = "rgb(1, 2, 3)";
      },
    ],
    [
      "an rgba() color",
      (email) => {
        email.settings.backgroundColor = "rgba(1,2,3,0.5)";
      },
    ],
    [
      "the narrowest email",
      (email) => {
        email.settings.width = 1;
      },
    ],
    [
      "the widest email",
      (email) => {
        email.settings.width = Number.MAX_SAFE_INTEGER;
      },
    ],
    [
      "an empty font family",
      (email) => {
        email.settings.fontFamily = "";
      },
    ],
    [
      "a font family with quotes",
      (email) => {
        email.settings.fontFamily = `"Times New Roman", <serif>`;
      },
    ],
    [
      "the narrowest Column",
      (email) => {
        const [row] = email.rows;
        if (row) {
          row.columns = [
            { blocks: [], id: "narrow", props: {}, width: 1 },
            { blocks: [], id: "wide", props: {}, width: 99 },
          ];
        }
      },
    ],
    [
      "rounded Column widths",
      (email) => {
        const [row] = email.rows;
        if (row) {
          row.columns = [
            { blocks: [], id: "a", props: {}, width: 33.33 },
            { blocks: [], id: "b", props: {}, width: 33.33 },
            { blocks: [], id: "c", props: {}, width: 33.34 },
          ];
        }
      },
    ],
    [
      "no Rows",
      (email) => {
        email.rows = [];
      },
    ],
  ];

  it.each(accepted)("exports %s", async (_name, change) => {
    const email = emailWithText("Hi");
    change(email);

    await expect(renderEmail(email)).resolves.toMatch(/^<!doctype html>/iu);
  });

  const refused: [string, (email: BlocksDocument) => unknown, RegExp][] = [
    ["nothing", () => null, /object/iu],
    [
      "a newer version",
      (email) => ({ ...email, version: 2 }),
      /version 2 is newer/iu,
    ],
    ["a malformed document", ({ rows: _rows, ...email }) => email, /rows/u],
    [
      "a Column width that would break out of its attribute",
      (email) => {
        const column = email.rows[0]?.columns[0] as unknown as {
          width: string;
        };
        column.width = '100"><script>alert(1)</script>';
        return email;
      },
      /rows\.0\.columns\.0\.width/u,
    ],
  ];

  it.each(refused)(
    "refuses %s, with the reason",
    async (_name, damage, reason) => {
      const document = damage(emailWithText("Hi"));

      await expect(renderEmail(document as BlocksDocument)).rejects.toThrow(
        reason
      );
    }
  );

  it("doesn't change a document it refuses", async () => {
    const document = { ...emailWithText("Hi"), version: 2 };
    const before = structuredClone(document);

    await expect(renderEmail(document)).rejects.toThrow(/newer/u);

    expect(document).toStrictEqual(before);
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
