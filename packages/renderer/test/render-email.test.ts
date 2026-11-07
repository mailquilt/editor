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

const emailWithInline = (...inline: unknown[]): BlocksDocument => {
  const email = emailWithText("");
  const block = email.rows[0]?.columns[0]?.blocks[0];
  if (block) {
    block.props = {
      content: {
        content: [{ content: inline, type: "paragraph" }],
        type: "doc",
      },
    };
  }
  return email;
};

const linked = (href: string, text = "Click") => ({
  marks: [{ attrs: { href }, type: "link" }],
  text,
  type: "text",
});

const emailWithColumns = (
  ...columns: { texts: string[]; width: number }[]
): BlocksDocument => ({
  ...emailWithText(""),
  rows: [
    {
      columns: columns.map(({ texts, width }, columnIndex) => ({
        blocks: texts.map((text, blockIndex) => ({
          id: `block-${columnIndex}-${blockIndex}`,
          props: {
            content: {
              content: [
                { content: [{ text, type: "text" }], type: "paragraph" },
              ],
              type: "doc",
            },
          },
          type: "text",
        })),
        id: `column-${columnIndex}`,
        props: {},
        width,
      })),
      id: "row-1",
      props: {},
    },
  ],
});

describe(renderEmail, () => {
  it("matches the saved HTML for one Text Block", async () => {
    const html = await renderEmail(
      emailWithText("Hello {{first_name}},", "", "Welcome aboard.")
    );

    await expect(html).toMatchFileSnapshot("expected/one-text-block.html");
  });

  it.each([
    [
      "50-50",
      emailWithColumns(
        { texts: ["Left"], width: 50 },
        { texts: ["Right"], width: 50 }
      ),
    ],
    [
      "33-67",
      emailWithColumns(
        { texts: ["Narrow"], width: 33 },
        { texts: ["Wide"], width: 67 }
      ),
    ],
    [
      "67-33",
      emailWithColumns(
        { texts: ["Wide"], width: 67 },
        { texts: ["Narrow"], width: 33 }
      ),
    ],
    [
      "33-33-33",
      emailWithColumns(
        { texts: ["One"], width: 33.33 },
        { texts: ["Two"], width: 33.33 },
        { texts: ["Three"], width: 33.34 }
      ),
    ],
    [
      "25-25-25-25",
      emailWithColumns(
        { texts: ["One"], width: 25 },
        { texts: ["Two"], width: 25 },
        { texts: ["Three"], width: 25 },
        { texts: ["Four"], width: 25 }
      ),
    ],
    [
      "50-50-empty-column",
      emailWithColumns(
        { texts: [], width: 50 },
        { texts: ["Right"], width: 50 }
      ),
    ],
    [
      "33-33-33-empty-columns",
      emailWithColumns(
        { texts: ["Only"], width: 33.33 },
        { texts: [], width: 33.33 },
        { texts: [], width: 33.34 }
      ),
    ],
    [
      "50-50-all-empty",
      emailWithColumns({ texts: [], width: 50 }, { texts: [], width: 50 }),
    ],
  ])("matches the saved HTML for the %s Row", async (name, email) => {
    await expect(renderEmail(email)).resolves.toMatchFileSnapshot(
      `expected/columns-${name}.html`
    );
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

  it("matches the saved HTML for formatted text", async () => {
    const html = await renderEmail(
      emailWithInline(
        { text: "Plain, ", type: "text" },
        { marks: [{ type: "bold" }], text: "bold, ", type: "text" },
        { marks: [{ type: "italic" }], text: "italic, ", type: "text" },
        { marks: [{ type: "underline" }], text: "underlined", type: "text" },
        { type: "hardBreak" },
        {
          marks: [
            { attrs: { href: "{{cta_url}}" }, type: "link" },
            { type: "bold" },
            { type: "italic" },
          ],
          text: "a bold italic link",
          type: "text",
        }
      )
    );

    await expect(html).toMatchFileSnapshot("expected/formatted-text.html");
  });

  it.each([
    ["bold", "<strong>x</strong>"],
    ["italic", "<em>x</em>"],
    ["underline", "<u>x</u>"],
  ])("renders %s with its own tag", async (type, expected) => {
    const html = await renderEmail(
      emailWithInline({ marks: [{ type }], text: "x", type: "text" })
    );

    expect(html).toContain(expected);
  });

  it("puts a link around the other marks on its text", async () => {
    const html = await renderEmail(
      emailWithInline({
        marks: [
          { attrs: { href: "https://example.com" }, type: "link" },
          { type: "bold" },
        ],
        text: "x",
        type: "text",
      })
    );

    expect(html).toContain(
      '<a href="https://example.com" target="_blank"><strong>x</strong></a>'
    );
  });

  it("keeps a Merge Tag in a link intact", async () => {
    const html = await renderEmail(emailWithInline(linked("{{cta_url}}")));

    expect(html).toContain('<a href="{{cta_url}}" target="_blank">Click</a>');
  });

  it("escapes a link URL so it can't become markup", async () => {
    const html = await renderEmail(
      emailWithInline(linked(`https://a.b/?x="><script>&y=</mj-text>`))
    );

    expect(html).toContain(
      'href="https://a.b/?x=&quot;&gt;&lt;script&gt;&amp;y=&lt;/mj-text&gt;"'
    );
    expect(html).not.toContain("<script>");
  });

  it("escapes formatted text", async () => {
    const html = await renderEmail(
      emailWithInline({
        marks: [{ type: "bold" }],
        text: "<b>&",
        type: "text",
      })
    );

    expect(html).toContain("<strong>&lt;b&gt;&amp;</strong>");
  });

  it("refuses to render an executable link", async () => {
    await expect(
      // oxlint-disable-next-line eslint/no-script-url -- This is what the test refuses.
      renderEmail(emailWithInline(linked("javascript:alert(1)")))
    ).rejects.toThrow(/link/iu);
  });

  it("renders a line break, ignoring marks left on it", async () => {
    const html = await renderEmail(
      emailWithInline(
        { text: "a", type: "text" },
        { marks: [{ type: "bold" }], type: "hardBreak" },
        { text: "b", type: "text" }
      )
    );

    expect(html).toContain(
      '<p style="margin:0;white-space:pre-wrap">a<br />b</p>'
    );
  });

  it("keeps the empty line after a line break at the end, as the canvas shows it", async () => {
    const html = await renderEmail(
      emailWithInline({ text: "a", type: "text" }, { type: "hardBreak" })
    );

    expect(html).toContain(
      '<p style="margin:0;white-space:pre-wrap">a<br /><br /></p>'
    );
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
