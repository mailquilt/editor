import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

import { BLOCK_TYPES, createEditor } from "@mailquilt/core";
import type { Block, BlocksDocument } from "@mailquilt/core";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { renderEmail } from "../src/index.js";
import { emailWith, readable } from "./email-with.js";

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

const bold = (text: string) => ({
  marks: [{ type: "bold" }],
  text,
  type: "text",
});

const plain = (text: string) => ({ text, type: "text" });

/** A List's item, of one paragraph holding `inline`. */
const item = (...inline: unknown[]) => ({
  content: [
    inline.length > 0
      ? { content: inline, type: "paragraph" }
      : { type: "paragraph" },
  ],
  type: "listItem",
});

interface ColumnTexts {
  texts: string[];
  width: number;
}

/** A Row of Text Blocks, whose IDs all start with its own. */
const rowWith = (
  id: string,
  props: Record<string, unknown>,
  ...columns: ColumnTexts[]
): BlocksDocument["rows"][0] => ({
  columns: columns.map(({ texts, width }, columnIndex) => ({
    blocks: texts.map((text, blockIndex) => ({
      id: `${id}-block-${columnIndex}-${blockIndex}`,
      props: {
        content: {
          content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
          type: "doc",
        },
      },
      type: "text",
    })),
    id: `${id}-column-${columnIndex}`,
    props: {},
    width,
  })),
  id,
  props,
});

const emailWithColumns = (...columns: ColumnTexts[]): BlocksDocument => ({
  ...emailWithText(""),
  rows: [rowWith("row-1", {}, ...columns)],
});

describe(renderEmail, () => {
  it("matches the saved HTML for a 33/33/33 Row with an empty Column", async () => {
    const email = emailWithColumns(
      { texts: ["One"], width: 33.33 },
      { texts: [], width: 33.33 },
      { texts: ["Three"], width: 33.34 }
    );

    await expect(
      renderEmail(email).then(readable)
    ).resolves.toMatchFileSnapshot(
      "expected/columns-33-33-33-empty-column.html"
    );
  });

  it("gives Columns that share a Row a desktop width that never adds up to more than the email", async () => {
    const email = emailWithColumns(
      { texts: ["One"], width: 33.33 },
      { texts: ["Two"], width: 33.33 },
      { texts: ["Three"], width: 33.34 }
    );
    email.settings.width = 599;

    const html = await renderEmail(email);
    const widths = [
      ...html.matchAll(/mq-column" style="[^"]*max-width:(?<px>[\d.]+)px;"/gu),
    ].map(({ groups }) => Number(groups?.px));

    expect(widths).toStrictEqual([199.64, 199.64, 199.7]);
    expect(widths.reduce((sum, width) => sum + width)).toBeLessThanOrEqual(599);
  });

  it("matches the saved HTML for Rows with padding, hidden on phones, and kept side by side on phones", async () => {
    const email = emailWithText("");
    email.rows = [
      rowWith(
        "padded",
        { paddingBottom: 8, paddingLeft: 20, paddingRight: 30, paddingTop: 10 },
        { texts: ["Padded"], width: 33 },
        { texts: ["Stacks"], width: 67 }
      ),
      rowWith(
        "hidden",
        { hideOnPhone: true },
        { texts: ["Hidden on phones"], width: 100 }
      ),
      rowWith(
        "grouped",
        { paddingLeft: 40, paddingRight: 40, stackOnPhone: false },
        { texts: ["Side"], width: 50 },
        { texts: ["By side"], width: 50 }
      ),
    ];

    await expect(
      renderEmail(email).then(readable)
    ).resolves.toMatchFileSnapshot("expected/row-settings.html");
  });

  it("adds no width to a preheader or Button label that reads like MJML's Column markup", async () => {
    const markup =
      'class="mj-column-per-50 mj-outlook-group-fix mq-column" style="width:100%;';
    const email = emailWithColumns(
      { texts: ["One"], width: 50 },
      { texts: ["Two"], width: 50 }
    );
    email.settings.preheader = markup;
    email.rows[0]?.columns[0]?.blocks.push({
      id: "button-1",
      props: { label: markup },
      type: "button",
    });

    const html = await renderEmail(email);

    expect(html.match(/max-width:300px;/gu)).toHaveLength(2);
    // The preheader as typed. The label has break points, as text does.
    expect(html).toContain(`>${markup}`);
  });

  it("matches the saved HTML for an email with every setting", async () => {
    const email = emailWithText("Hello {{first_name}},", "", "Welcome aboard.");
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

    await expect(
      renderEmail(email).then(readable)
    ).resolves.toMatchFileSnapshot("expected/every-setting.html");
  });

  it("matches the saved HTML for bulleted and numbered Lists", async () => {
    const email = emailWithParagraphs([
      { content: [plain("Before")], type: "paragraph" },
      {
        content: [
          item(
            bold("Bold"),
            plain(" and "),
            { attrs: { name: "first_name" }, type: "mergeTag" },
            { type: "hardBreak" },
            linked("https://example.com", "a second line")
          ),
          item(plain("Two")),
        ],
        type: "bulletList",
      },
      {
        content: [item(plain("First")), item()],
        type: "orderedList",
      },
      { content: [plain("After")], type: "paragraph" },
    ]);
    email.version = 3;

    await expect(
      renderEmail(email).then(readable)
    ).resolves.toMatchFileSnapshot("expected/lists.html");
  });

  it("keeps a saved language that isn't a code, safely", async () => {
    const email = emailWithText("Hi");
    email.settings.language = 'en"><script>alert(1)</script>';

    const html = await renderEmail(email);

    expect(html).not.toContain("<script>");
    expect(html).toContain('lang="en&quot;&gt;&lt;script&gt;');
  });

  it("leaves out MJML's line breaks and indents, to keep the email small, and the text's own spaces", async () => {
    const html = await renderEmail(emailWithText("a b c"));

    expect(html).not.toContain("\n");
    expect(html).toContain(">a b c</p>");
  });

  it("keeps no-break spaces at the ends of a Button's label and in text, and as typed in a Merge Tag", async () => {
    const noBreak = String.fromCodePoint(0xa0);
    const email = emailWithText(
      `${noBreak}a${noBreak}{{${noBreak}name${noBreak}}}`
    );
    email.rows[0]?.columns[0]?.blocks.push({
      id: "button-1",
      props: { label: `${noBreak}${noBreak}Go${noBreak}${noBreak}` },
      type: "button",
    });

    const html = await renderEmail(email);

    expect(html).toContain(`>&#160;a&#160;{{${noBreak}name${noBreak}}}</p>`);
    expect(html).toContain("> &#160;&#160;Go&#160;&#160; </p>");
  });

  // Without a line break in it, a run of whitespace was once read again from
  // each of its characters: 3 s for 80,000 tabs, blocking the server process.
  it("renders a long run of tabs and spaces in time that grows with its length", async () => {
    const email = emailWith({
      props: { label: `a${" \t".repeat(100_000)}b` },
      type: "button",
    });

    const start = performance.now();
    await renderEmail(email);

    expect(performance.now() - start).toBeLessThan(2500);
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
      `&lt;script&gt;alert("x")&lt;/&#8203;script&gt; &amp; &lt;/mj-text&gt;`
    );
    expect(html).not.toContain("<script>");
  });

  it("keeps repeated spaces and those starting a line, as the canvas shows them", async () => {
    const html = await renderEmail(
      emailWithInline(
        { text: " a   b ", type: "text" },
        { marks: [{ type: "bold" }], text: " c", type: "text" },
        { type: "hardBreak" },
        { text: " d", type: "text" }
      )
    );

    expect(html).toContain(
      '<p style="margin:0;word-break:break-word;overflow-wrap:anywhere;font-family:Arial, Helvetica, sans-serif;line-height:24px;mso-line-height-rule:exactly">&nbsp;a &nbsp;&nbsp;b <strong>&nbsp;c</strong><br />&nbsp;d</p>'
    );
    expect(html).not.toContain("pre-wrap");
  });

  it("lets a word of 20 or more typed characters wrap after its slashes and dots, in clients that won't break it", async () => {
    const html = await renderEmail(
      emailWithText(
        "Saved as projects/mail-quilt/welcome_v2.json, or short.example/x and fish&chips/today.ok"
      )
    );

    expect(html).toContain(
      ">Saved as projects/&#8203;mail-&#8203;quilt/&#8203;welcome_&#8203;v2.&#8203;json, or short.example/x and fish&amp;chips/today.ok</p>"
    );
  });

  it("lets a word of 20 or more characters wrap however it's formatted, as it's measured whole", async () => {
    const html = await renderEmail(
      emailWithInline(
        plain("projects/mail-"),
        bold("quilt/welcome"),
        plain(" or short."),
        bold("example/x"),
        plain(" for {{ user.first"),
        bold("_name_long_value }}")
      )
    );

    expect(html).toContain(
      ">projects/&#8203;mail-&#8203;<strong>quilt/&#8203;welcome</strong> or short.<strong>example/x</strong> for {{ user.first<strong>_name_long_value }}</strong></p>"
    );
  });

  it("ends a URL written as text before Japanese or Chinese written straight after it, or their punctuation", async () => {
    const html = await renderEmail(
      emailWithText(
        "詳細はhttps://x.jp/aまで、www.y.jpへ。https://example.jp/をご覧ください。详见https://x.cn/b，然后"
      )
    );

    expect(html).toContain(
      '>詳細は<a href="https://x.jp/a" target="_blank" style="color:#000000;text-decoration:underline">https://&#8203;x.&#8203;jp/&#8203;a</a>まで、<a href="http://www.y.jp" target="_blank" style="color:#000000;text-decoration:underline">www.&#8203;y.&#8203;jp</a>へ。<a href="https://example.jp/" target="_blank" style="color:#000000;text-decoration:underline">https://&#8203;example.&#8203;jp/&#8203;</a>をご覧ください。详见<a href="https://x.cn/b" target="_blank" style="color:#000000;text-decoration:underline">https://&#8203;x.&#8203;cn/&#8203;b</a>，然后</p>'
    );
  });

  it("links a URL written as text, as Apple Mail and Gmail did before its break points", async () => {
    const html = await renderEmail(
      emailWithText("See https://example.com/a/long_path?x=1&y=2.")
    );

    expect(html).toContain(
      '>See <a href="https://example.com/a/long_path?x=1&amp;y=2" target="_blank" style="color:#000000;text-decoration:underline">https://&#8203;example.&#8203;com/&#8203;a/&#8203;long_&#8203;path?&#8203;x=&#8203;1&amp;&#8203;y=&#8203;2</a>.</p>'
    );
  });

  it("keeps a Merge Tag whole in a long word, escaped, so it's still filled in", async () => {
    const html = await renderEmail(
      emailWithText(
        "https://example.com/{{unsubscribe_token.value}}/x and files/{{a&b<c>}}/welcome_v2.json"
      )
    );

    expect(html).toContain(
      '<a href="https://example.com/{{unsubscribe_token.value}}/x" target="_blank" style="color:#000000;text-decoration:underline">https://&#8203;example.&#8203;com/&#8203;{{unsubscribe_token.value}}/&#8203;x</a> and files/&#8203;{{a&amp;b&lt;c&gt;}}/&#8203;welcome_&#8203;v2.&#8203;json</p>'
    );
  });

  // Saved from the export before version 3, so the migration can't change it.
  it("exports an email saved with version 2 as it did before Merge Tags became nodes", async () => {
    const email: unknown = JSON.parse(
      readFileSync(
        new URL("fixtures/merge-tags-version-2.json", import.meta.url),
        "utf-8"
      )
    );

    await expect(
      renderEmail(email).then(readable)
    ).resolves.toMatchFileSnapshot("expected/merge-tags-version-2.html");
  });

  // Saved from the export before version 4, so the migration and Email style
  // can't change it.
  it("exports an email saved with version 3 as it did before Email style", async () => {
    const email: unknown = JSON.parse(
      readFileSync(new URL("fixtures/version-3.json", import.meta.url), "utf-8")
    );

    await expect(
      renderEmail(email).then(readable)
    ).resolves.toMatchFileSnapshot("expected/version-3.html");
  });

  it("keeps a Merge Tag with spaces inside its braces whole, so it's still filled in", async () => {
    const html = await renderEmail(
      emailWithText(
        "Hi {{ customer.preferred_name }} and {{ a  b }}, see projects/{{ id }}/welcome_v2.json"
      )
    );

    expect(html).toContain(
      ">Hi {{ customer.preferred_name }} and {{ a  b }}, see projects/&#8203;{{ id }}/&#8203;welcome_&#8203;v2.&#8203;json</p>"
    );
  });

  it("links a URL written as text whole, Merge Tags with spaces and all", async () => {
    const html = await renderEmail(
      emailWithText(
        "Open https://example.com/{{ user id }}/x, https://example.com/{{ id }}. or https://x.test/{{ id }}"
      )
    );

    expect(html).toContain(
      '>Open <a href="https://example.com/{{ user id }}/x" target="_blank" style="color:#000000;text-decoration:underline">https://&#8203;example.&#8203;com/&#8203;{{ user id }}/&#8203;x</a>, <a href="https://example.com/{{ id }}" target="_blank" style="color:#000000;text-decoration:underline">https://&#8203;example.&#8203;com/&#8203;{{ id }}</a>. or <a href="https://x.test/{{ id }}" target="_blank" style="color:#000000;text-decoration:underline">https://&#8203;x.&#8203;test/&#8203;{{ id }}</a></p>'
    );
  });

  it("links a URL written as text with a closing bracket it opened, and without one it didn't", async () => {
    const html = await renderEmail(
      emailWithText(
        "See https://x.test/(b) (or https://x.test/(d)), https://x.co/((e)), https://x.co/?q=(f or https://x.co/a)b"
      )
    );

    expect(html).toContain(
      '>See <a href="https://x.test/(b)" target="_blank" style="color:#000000;text-decoration:underline">https://x.test/(b)</a> (or <a href="https://x.test/(d)" target="_blank" style="color:#000000;text-decoration:underline">https://&#8203;x.&#8203;test/&#8203;(d)</a>), <a href="https://x.co/((e))" target="_blank" style="color:#000000;text-decoration:underline">https://x.co/((e))</a>, <a href="https://x.co/?q=(f" target="_blank" style="color:#000000;text-decoration:underline">https://x.co/?q=(f</a> or <a href="https://x.co/a)b" target="_blank" style="color:#000000;text-decoration:underline">https://x.co/a)b</a></p>'
    );
  });

  it("links a www. URL written as text, and one with its scheme in capitals, as other URLs", async () => {
    const html = await renderEmail(
      emailWithText(
        "Visit www.x.test/a, HTTPS://X.TEST, WWW.X.TEST, swww.x.test or éwww.x.test."
      )
    );

    expect(html).toContain(
      '>Visit <a href="http://www.x.test/a" target="_blank" style="color:#000000;text-decoration:underline">www.x.test/a</a>, <a href="HTTPS://X.TEST" target="_blank" style="color:#000000;text-decoration:underline">HTTPS://X.TEST</a>, <a href="http://WWW.X.TEST" target="_blank" style="color:#000000;text-decoration:underline">WWW.X.TEST</a>, swww.x.test or éwww.x.test.</p>'
    );
  });

  it("links an email address written as text as mailto:, so its break points don't stop it working", async () => {
    const html = await renderEmail(
      emailWithText(
        "Write to first.last-name@mail.example.com or o'brien@x.test, not {{ first }}sales@x.test, wait...@x.test or x.co/a@b.co."
      )
    );

    expect(html).toContain(
      `>Write to <a href="mailto:first.last-name@mail.example.com" target="_blank" style="color:#000000;text-decoration:underline">first.&#8203;last-&#8203;name@mail.&#8203;example.&#8203;com</a> or <a href="mailto:o'brien@x.test" target="_blank" style="color:#000000;text-decoration:underline">o'brien@x.test</a>, not {{ first }}sales@x.&#8203;test, wait...@x.test or x.co/a@b.co.</p>`
    );
  });

  it.each([
    ["a letter outside ASCII in its name", "müller@x.test", "müller@x.test"],
    [
      "a letter outside ASCII in its domain",
      "info@sub.müller.de",
      "info@sub.müller.de",
    ],
    ["an _ straight after it", "a@b.c_d", undefined],
    ["a - straight after it", "a@b.co-", undefined],
    ["an @ straight before it", "a@b@c.de", undefined],
    ["Japanese written around it", "連絡先a@x.jpまで", "a@x.jp"],
  ])(
    "links an email address as written, with %s, or not at all",
    async (_name, text, address) => {
      const html = await renderEmail(emailWithText(`Write ${text} now`));

      expect(html).toContain(
        `>Write ${
          address === undefined
            ? text
            : text.replace(
                address,
                `<a href="mailto:${address}" target="_blank" style="color:#000000;text-decoration:underline">${address}</a>`
              )
        } now</p>`
      );
    }
  );

  it("doesn't link an email address inside a Merge Tag, so the tag is still filled in", async () => {
    const html = await renderEmail(
      emailWithText('Write to {{ to | default: "help@x.test" }}')
    );

    expect(html).toContain('>Write to {{ to | default: "help@x.test" }}</p>');
  });

  it("doesn't link a URL again inside a link", async () => {
    const html = await renderEmail(
      emailWithInline(
        linked("https://x.test", "https://example.com/a/long/path")
      )
    );

    expect(html.match(/<a\b/gu)).toHaveLength(1);
    expect(html).toContain(
      ">https://&#8203;example.&#8203;com/&#8203;a/&#8203;long/&#8203;path</a>"
    );
  });

  it.each([
    [
      "a URL",
      [plain("https://example.co"), bold("m")],
      '<a href="https://example.com" target="_blank" style="color:#000000;text-decoration:underline">https://example.co<strong>m</strong></a>',
    ],
    [
      "an email address",
      [bold("foo"), plain("bar@example.com")],
      '<a href="mailto:foobar@example.com" target="_blank" style="color:#000000;text-decoration:underline"><strong>foo</strong>bar@example.com</a>',
    ],
    [
      "a www. URL",
      [plain("www.exa"), bold("mple.com")],
      '<a href="http://www.example.com" target="_blank" style="color:#000000;text-decoration:underline">www.exa<strong>mple.com</strong></a>',
    ],
  ])(
    "links %s written as text whole when its formatting changes partway",
    async (_name, inline, expected) => {
      const html = await renderEmail(emailWithInline(...inline));

      expect(html).toContain(`exactly">${expected}</p>`);
    }
  );

  it("doesn't link a URL written as text that runs into a link, so no link goes to a part of it", async () => {
    const html = await renderEmail(
      emailWithInline(
        plain("https://exa"),
        linked("https://x.test", "mple.com")
      )
    );

    expect(html).toContain(
      'exactly">https://exa<a href="https://x.test" target="_blank" style="color:#000000;text-decoration:underline">mple.com</a></p>'
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
      '<p style="margin:0;word-break:break-word;overflow-wrap:anywhere;font-family:Arial, Helvetica, sans-serif;line-height:24px;mso-line-height-rule:exactly">Plain, <strong>bold, </strong><em>italic, </em><u>underlined</u><br /><a href="{{cta_url}}" target="_blank" style="color:#000000;text-decoration:underline"><strong><em>a bold italic link</em></strong></a></p>'
    );
  });

  it("colors a link as its Text Block, so it reads on the Block's background", async () => {
    const email = emailWithInline(linked("https://x.test"));
    const block = email.rows[0]?.columns[0]?.blocks[0] as Block;
    block.props = { ...block.props, color: "#ff0000" };

    await expect(renderEmail(email)).resolves.toContain(
      '<a href="https://x.test" target="_blank" style="color:#ff0000;text-decoration:underline">'
    );
  });

  it("gives each paragraph and List item the email's font itself, as some clients give a paragraph their own", async () => {
    const email = emailWithParagraphs([
      { content: [plain("Before")], type: "paragraph" },
      { content: [item(plain("One"))], type: "bulletList" },
      { content: [item(plain("First"))], type: "orderedList" },
    ]);
    email.version = 3;
    email.settings.fontFamily = 'Georgia, "Times New Roman", serif';
    const html = await renderEmail(email);

    const tags =
      html.match(/<(?:p|li) style="margin:0;word-break[^"]*"/gu) ?? [];
    expect(tags).toHaveLength(3);
    for (const tag of tags) {
      expect(tag).toContain(
        "font-family:Georgia, &quot;Times New Roman&quot;, serif"
      );
    }
  });

  it("gives text an exact line height in pixels, as classic Outlook draws thin lines under text with 1.5", async () => {
    const email = emailWithText("Hello");
    const block = email.rows[0]?.columns[0]?.blocks[0] as Block;
    block.props = { ...block.props, fontSize: 15 };
    const html = await renderEmail(email);

    expect(html).toContain(
      '<p style="margin:0;word-break:break-word;overflow-wrap:anywhere;font-family:Arial, Helvetica, sans-serif;line-height:23px;mso-line-height-rule:exactly">Hello</p>'
    );
    expect(html).toMatch(/<div style="[^"]*line-height:23px;/u);
    expect(html).not.toContain("line-height:1.5");
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

  it("keeps a line break in text between marks, which shows as a space", async () => {
    const html = await renderEmail(
      emailWithInline(
        { marks: [{ type: "bold" }], text: "a", type: "text" },
        { text: "\n", type: "text" },
        { marks: [{ type: "italic" }], text: "b", type: "text" }
      )
    );

    expect(html).toContain("<strong>a</strong>&#10;<em>b</em>");
  });

  it("keeps a line break in a link address, which browsers leave out, rather than making it a space", async () => {
    const html = await renderEmail(
      emailWithInline(linked("https://x.test/a\nb"))
    );

    expect(html).toContain('href="https://x.test/a&#10;b"');
  });

  // Values core accepts that would end their attribute, or run, if not escaped.
  it.each([
    [
      "a quoted font name holding a double quote",
      () => {
        const email = emailWithText("Hi");
        email.settings.fontFamily = `'x" onmouseover "', serif`;
        return email;
      },
      `<div style="font-family:'x&quot; onmouseover &quot;', serif;`,
    ],
    [
      "an entity-encoded scheme after a Merge Tag",
      () => emailWithInline(linked("{{x}}javascript&#58;alert(1)")),
      '<a href="{{x}}javascript&amp;#58;alert(1)"',
    ],
  ])("keeps %s as text", async (_name, email, expected) => {
    await expect(renderEmail(email())).resolves.toContain(expected);
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
      '<a href="https://x.test" target="_blank" style="color:#000000;text-decoration:underline">Shop the <strong>sale</strong><br />now</a> or <a href="https://y.test" target="_blank" style="color:#000000;text-decoration:underline">later</a>'
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
      '<a href="https://x.test" target="_blank" style="color:#000000;text-decoration:underline"><strong>Sale</strong> now</a>'
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
      '<p style="margin:0;word-break:break-word;overflow-wrap:anywhere;font-family:Arial, Helvetica, sans-serif;line-height:24px;mso-line-height-rule:exactly">a<br />b</p>'
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

  // A type this package doesn't handle fails to compile, but its defaults still
  // have to get through MJML's strict validation, or a new Block couldn't export.
  it.each(BLOCK_TYPES.map(({ type }) => type))(
    "renders a %s Block with its defaults",
    async (blockType) => {
      const editor = createEditor({ document: emailWithText("") });
      const columnId = editor.getDocument().rows[0]?.columns[0]?.id ?? "";

      expect(
        editor.apply({ blockType, columnId, index: 0, type: "insertBlock" })
      ).toMatchObject({ ok: true });
      await expect(renderEmail(editor.getDocument())).resolves.toContain(
        "<!doctype html>"
      );
    }
  );

  it("runs in plain Node with no DOM, editor or ProseMirror code loaded", async () => {
    // Runs the package, built as it's published, in its own process, because
    // the test runner's own modules would hide what the package actually loads.
    // It's built here, so it's never an older build, and into a folder of its
    // own, so it can't change one another task is reading.
    const outDir = fileURLToPath(
      new URL("../node_modules/.cache/plain-node", import.meta.url)
    );
    const { build } = await import("tsdown");
    await build({
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      dts: false,
      logLevel: "silent",
      outDir,
    });
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
      const { renderEmail } = await import(${JSON.stringify(pathToFileURL(`${outDir}/index.js`).href)});
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
