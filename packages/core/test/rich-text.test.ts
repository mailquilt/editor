// oxlint-disable eslint/no-script-url -- These URLs are what the tests refuse.
import { describe, expect, it } from "vitest";

import { createEmail, loadDocument } from "../src/index.js";
import { isAllowedLinkHref } from "../src/internal.js";

/** An email whose Text holds `content`, which may be wrong, as loading checks it. */
const emailWithContent = (content: unknown) => {
  const email = createEmail();
  const block: { props: unknown } | undefined =
    email.rows[0]?.columns[0]?.blocks[0];
  if (block) {
    block.props = { content };
  }
  return email;
};

const emailWithInline = (...inline: unknown[]) =>
  emailWithContent({
    content: [{ content: inline, type: "paragraph" }],
    type: "doc",
  });

const linkTo = (href: string) => ({
  marks: [{ attrs: { href }, type: "link" }],
  text: "Click",
  type: "text",
});

describe("limited rich text", () => {
  it("keeps the marks ProseMirror leaves on a line break inside bold text", () => {
    const email = emailWithInline({
      marks: [{ type: "bold" }],
      type: "hardBreak",
    });

    expect(loadDocument(email).ok).toBeTruthy();
  });

  it.each([
    [
      "a mark it doesn't know",
      { marks: [{ type: "strike" }], text: "x" },
      /marks\.0\.type: /u,
    ],
    [
      "a mark with attributes it doesn't know",
      { marks: [{ attrs: { color: "red" }, type: "bold" }], text: "x" },
      /marks\.0\.attrs/u,
    ],
    [
      "a link with attributes it doesn't know",
      {
        marks: [
          { attrs: { href: "https://a.b", target: "_top" }, type: "link" },
        ],
        text: "x",
      },
      /marks\.0\.attrs\.target/u,
    ],
    [
      "a link with no URL",
      { marks: [{ type: "link" }], text: "x" },
      /marks\.0\.attrs/u,
    ],
    [
      "the same mark twice",
      { marks: [{ type: "bold" }, { type: "bold" }], text: "x" },
      /same mark twice/u,
    ],
  ])("refuses %s", (_name, node, reason) => {
    expect(
      loadDocument(emailWithInline({ ...node, type: "text" }))
    ).toStrictEqual({ ok: false, reason: expect.stringMatching(reason) });
  });

  it("keeps a Merge Tag's name byte for byte, and its marks", () => {
    const email = emailWithInline({
      attrs: { name: " user.name | upcase " },
      marks: [{ type: "bold" }],
      type: "mergeTag",
    });

    expect(loadDocument(email)).toStrictEqual({ document: email, ok: true });
  });

  it.each([
    ["an empty name", { name: "" }, /attrs\.name/u],
    ["a name with a brace", { name: "a}b" }, /attrs\.name/u],
    ["attributes it doesn't know", { label: "A", name: "a" }, /attrs\.label/u],
  ])("refuses a Merge Tag with %s", (_name, attrs, reason) => {
    expect(
      loadDocument(emailWithInline({ attrs, type: "mergeTag" }))
    ).toStrictEqual({ ok: false, reason: expect.stringMatching(reason) });
  });

  it("refuses an inline node it doesn't know", () => {
    const email = emailWithInline({ attrs: { src: "x" }, type: "image" });

    expect(loadDocument(email)).toStrictEqual({
      ok: false,
      reason: expect.stringMatching(/content\.0\.content\.0\.type: /u),
    });
  });

  it("refuses anything but paragraphs at the top level", () => {
    const email = emailWithContent({
      content: [{ attrs: { level: 1 }, type: "heading" }],
      type: "doc",
    });

    expect(loadDocument(email)).toStrictEqual({
      ok: false,
      reason: expect.stringMatching(/props\.content\.content\.0\.type: /u),
    });
  });

  it.each(["bulletList", "orderedList"])(
    "keeps a %s of items, each one paragraph",
    (type) => {
      const email = emailWithContent({
        content: [
          { type: "paragraph" },
          {
            content: [
              { content: [{ type: "paragraph" }], type: "listItem" },
              {
                content: [
                  {
                    content: [
                      { marks: [{ type: "bold" }], text: "Hi ", type: "text" },
                      { attrs: { name: "name" }, type: "mergeTag" },
                    ],
                    type: "paragraph",
                  },
                ],
                type: "listItem",
              },
            ],
            type,
          },
        ],
        type: "doc",
      });

      expect(loadDocument(email)).toStrictEqual({ document: email, ok: true });
    }
  );

  it.each([
    [
      "a List with no items",
      { content: [], type: "bulletList" },
      /content\.content\.0\.content: /u,
    ],
    [
      "an item of two paragraphs",
      {
        content: [
          {
            content: [{ type: "paragraph" }, { type: "paragraph" }],
            type: "listItem",
          },
        ],
        type: "bulletList",
      },
      /content\.0\.content\.0\.content\.1: .*exactly one paragraph/u,
    ],
    [
      "a List inside an item",
      {
        content: [
          {
            content: [
              {
                content: [
                  { content: [{ type: "paragraph" }], type: "listItem" },
                ],
                type: "bulletList",
              },
            ],
            type: "listItem",
          },
        ],
        type: "orderedList",
      },
      /content\.content\.0\.content\.0\.content\.0\.type: /u,
    ],
    [
      "a List with attributes",
      {
        attrs: { start: 3 },
        content: [{ content: [{ type: "paragraph" }], type: "listItem" }],
        type: "orderedList",
      },
      /attrs/u,
    ],
  ])("refuses %s", (_name, list, reason) => {
    expect(
      loadDocument(emailWithContent({ content: [list], type: "doc" }))
    ).toStrictEqual({ ok: false, reason: expect.stringMatching(reason) });
  });

  it("refuses an executable link, naming the problem", () => {
    const result = loadDocument(emailWithInline(linkTo("javascript:alert(1)")));

    expect(result).toMatchObject({ ok: false });
    expect(result.ok === false && result.reason).toContain("link");
  });
});

describe(isAllowedLinkHref, () => {
  it.each([
    "https://example.com/a?b=1&c=2",
    "http://example.com",
    "HTTPS://EXAMPLE.COM",
    "mailto:hello@example.com",
    "tel:+15551234567",
    "{{cta_url}}",
    "{{ cta_url }}",
    "{{base_url}}/welcome?id={{user_id}}",
    "{{base_url}}/a:b",
    "{{base_url}}?a=b:c",
    "{{base_url}}#a:b",
    "{{scheme_and_host}}{{path}}",
  ])("accepts %s", (href) => {
    expect(isAllowedLinkHref(href)).toBeTruthy();
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "\tjavascript:alert(1)",
    "java\nscript:alert(1)",
    "\u0001javascript:alert(1)",
    "vbscript:msgbox(1)",
    // Unicode case folding would read ſ as s.
    "httpſ://example.com",
    "data:text/html,<script>alert(1)</script>",
    "javascript:{{x}}",
    "java{{x}}script:alert(1)",
    "{{javascript:alert(1)",
    // The tag's value could be empty, or finish the scheme.
    "{{x}}javascript:alert(1)",
    "{{x}}script:alert(1)",
    "{{x}}{{y}}javascript:alert(1)",
    "{{x}}\njavascript:alert(1)",
    // A tag can't wrap a URL, as its scheme follows the tag.
    "{{#if vip}}https://example.com{{/if}}",
    "//example.com",
    "/relative",
    "",
  ])("refuses %j", (href) => {
    expect(isAllowedLinkHref(href)).toBeFalsy();
  });
});
