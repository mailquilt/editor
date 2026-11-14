import { execFileSync } from "node:child_process";

import { BLOCK_TYPES, createEditor } from "@mailquilt/core";
import type { Block, BlocksDocument } from "@mailquilt/core";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { renderEmail } from "../src/index.js";
import { emailWith } from "./email-with.js";

/** A Text Block's email, on a background other than white. */
const emailWithParagraphs = (paragraphs: unknown[]): BlocksDocument => {
  const email = emailWith({
    props: { content: { content: paragraphs, type: "doc" } },
    type: "text",
  });
  email.settings.backgroundColor = "#f4f4f5";
  return email;
};

const emailWithText = (...paragraphs: string[]) =>
  emailWithParagraphs(
    paragraphs.map((text) =>
      text
        ? { content: [{ text, type: "text" }], type: "paragraph" }
        : { type: "paragraph" }
    )
  );

const emailWithInline = (...inline: unknown[]) =>
  emailWithParagraphs([{ content: inline, type: "paragraph" }]);

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

  it("matches the saved HTML for a 33/33/33 Row with an empty Column", async () => {
    const email = emailWithColumns(
      { texts: ["One"], width: 33.33 },
      { texts: [], width: 33.33 },
      { texts: ["Three"], width: 33.34 }
    );

    await expect(renderEmail(email)).resolves.toMatchFileSnapshot(
      "expected/columns-33-33-33-empty-column.html"
    );
  });

  it("matches the saved HTML for an email with every setting", async () => {
    const email = emailWithText("Hello {{first_name}},");
    email.settings = {
      backgroundColor: "#eeeeee",
      fontFamily: "Georgia, 'Times New Roman', serif",
      language: "pt-BR",
      preheader: "Your week, {{first_name}}",
      width: 640,
    };
    const row = email.rows[0] as BlocksDocument["rows"][0];
    row.props = { backgroundColor: "#ddeeff" };
    const block = row.columns[0]?.blocks[0] as Block;
    block.props = {
      ...block.props,
      align: "center",
      color: "#ff0000",
      fontSize: 24,
    };

    await expect(renderEmail(email)).resolves.toMatchFileSnapshot(
      "expected/every-setting.html"
    );
  });

  it("keeps a saved language that isn't a code, safely", async () => {
    const email = emailWithText("Hi");
    email.settings.language = 'en"><script>alert(1)</script>';

    const html = await renderEmail(email);

    expect(html).not.toContain("<script>");
    expect(html).toContain('lang="en&quot;&gt;&lt;script&gt;');
  });

  it("loads no web fonts, even for a font MJML would load", async () => {
    const email = emailWithText("Hi");
    email.settings.fontFamily = "Roboto, sans-serif";

    await expect(renderEmail(email)).resolves.not.toContain(
      "fonts.googleapis.com"
    );
  });

  it("escapes a preheader so it can't become markup", async () => {
    const email = emailWithText("Hi");
    email.settings.preheader = `</mj-preview><script>alert("x")</script> & {{name}}`;

    const html = await renderEmail(email);

    expect(html).toContain(
      `&lt;/mj-preview&gt;&lt;script&gt;alert("x")&lt;/script&gt; &amp; {{name}}`
    );
    expect(html).not.toContain("<script>");
  });

  it.each([
    ["rgb()", "rgb(1, 2, 3)"],
    ["rgba()", "rgba(1,2,3,0.5)"],
    ["short hex", "#FFF"],
  ])("exports %s as a Text and Row color", async (_name, color) => {
    const email = emailWithText("Hi");
    const row = email.rows[0] as BlocksDocument["rows"][0];
    row.props = { backgroundColor: color };
    const block = row.columns[0]?.blocks[0] as Block;
    block.props = { ...block.props, color };

    const html = await renderEmail(email);

    expect(html).toContain(`;color:${color}`);
    expect(html).toContain(`background-color:${color}`);
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
    const html = await renderEmail(emailWithText("a    b"));

    expect(html).toContain(
      '<p style="margin:0;white-space:pre-wrap">a    b</p>'
    );
  });

  it("renders each mark as its tag, a line break, and a link around the other marks", async () => {
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

    expect(html).toContain(
      '<p style="margin:0;white-space:pre-wrap">Plain, <strong>bold, </strong><em>italic, </em><u>underlined</u><br /><a href="{{cta_url}}" target="_blank"><strong><em>a bold italic link</em></strong></a></p>'
    );
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

  it("keeps a link one link across bold text and a line break in it", async () => {
    const link = { attrs: { href: "https://x.test" }, type: "link" };
    const html = await renderEmail(
      emailWithInline(
        { marks: [link], text: "Shop the ", type: "text" },
        { marks: [link, { type: "bold" }], text: "sale", type: "text" },
        { marks: [link], type: "hardBreak" },
        { marks: [link], text: "now", type: "text" },
        { text: " or ", type: "text" },
        linked("https://y.test", "later")
      )
    );

    expect(html).toContain(
      '<a href="https://x.test" target="_blank">Shop the <strong>sale</strong><br />now</a> or <a href="https://y.test" target="_blank">later</a>'
    );
  });

  it("keeps one link whatever order its text's marks were saved in", async () => {
    const link = { attrs: { href: "https://x.test" }, type: "link" };
    const html = await renderEmail(
      emailWithInline(
        { marks: [{ type: "bold" }, link], text: "Sale", type: "text" },
        { marks: [link], text: " now", type: "text" }
      )
    );

    expect(html).toContain(
      '<a href="https://x.test" target="_blank"><strong>Sale</strong> now</a>'
    );
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

  // MJML's strict validation rejects more than CSS does, so anything that loads
  // has to get through it, or an email could be edited but never exported.
  const accepted: [string, (email: BlocksDocument) => void][] = [
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

  it("exports a font family with quotes, escaped in a Heading's style", async () => {
    const email = emailWithText("Hi");
    email.settings.fontFamily = `"Times New Roman", serif`;
    email.rows[0]?.columns[0]?.blocks.push({
      id: "heading-1",
      props: {
        content: {
          content: [
            { content: [{ text: "Title", type: "text" }], type: "paragraph" },
          ],
          type: "doc",
        },
        level: 1,
      },
      type: "heading",
    });

    await expect(renderEmail(email)).resolves.toMatch(
      /<h1 style="[^"]*font-family:&quot;Times New Roman&quot;, serif;/u
    );
  });

  it("refuses a Column width that would break out of its attribute, with the reason", async () => {
    const email = emailWithText("Hi");
    const column = email.rows[0]?.columns[0] as unknown as { width: string };
    column.width = '100"><script>alert(1)</script>';

    await expect(renderEmail(email)).rejects.toThrow(
      /rows\.0\.columns\.0\.width/u
    );
  });

  it("refuses a document before loading MJML", async () => {
    vi.resetModules();
    onTestFinished(() => {
      vi.doUnmock(import("mjml-browser"));
      vi.resetModules();
    });
    let loadedMjml = false;
    vi.doMock(import("mjml-browser"), () => {
      loadedMjml = true;
      return { default: vi.fn<() => Promise<{ html: string }>>() };
    });
    const fresh = await import("../src/index.js");

    await expect(fresh.renderEmail({ kind: "blocks" })).rejects.toThrow(
      /Expected "rows"/u
    );

    expect(loadedMjml).toBeFalsy();
  });

  // A Block type core accepts but this package can't render would only fail on
  // export.
  it.each(BLOCK_TYPES.map(({ type }) => type))(
    "renders a %s Block with its defaults",
    async (blockType) => {
      const editor = createEditor({ document: emailWithText("") });
      const columnId = editor.getDocument().rows[0]?.columns[0]?.id ?? "";
      editor.apply({ blockType, columnId, index: 0, type: "insertBlock" });

      await expect(renderEmail(editor.getDocument())).resolves.toContain(
        "<!doctype html>"
      );
    }
  );

  it("runs in plain Node with no DOM, editor or ProseMirror code loaded", () => {
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
    expect(loaded.some((url) => url.includes("/mjml-browser/"))).toBeTruthy();
    expect(
      loaded.filter((url) =>
        /prosemirror|\/node_modules\/lit|\/packages\/editor\//u.test(url)
      )
    ).toStrictEqual([]);
  });
});
