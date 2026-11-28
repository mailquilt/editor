import type { BlocksDocument } from "@mailquilt/core";
import { describe, expect, it } from "vitest";

import { renderEmail } from "../src/index.js";
import { emailWith, readable } from "./email-with.js";

const linked = (text: string) => ({
  content: {
    content: [
      {
        content: [
          { text: "Read ", type: "text" },
          {
            marks: [{ attrs: { href: "https://example.com" }, type: "link" }],
            text,
            type: "text",
          },
        ],
        type: "paragraph",
      },
    ],
    type: "doc",
  },
});

const STYLE = {
  buttonBackgroundColor: "#2b1d14",
  buttonBorderRadius: 0,
  emailBackgroundColor: "#fbf7f1",
  heading1FontSize: 36,
  heading2FontSize: 26,
  heading3FontSize: 21,
  headingFontFamily: "Georgia, 'Times New Roman', serif",
  linkColor: "#b5652b",
  textColor: "#2b1d14",
  textFontSize: 15,
};

describe("an email with an Email style", () => {
  // Each Block that sets nothing takes the Email style, and the second of each
  // type keeps its own value over it.
  it("matches the saved HTML, with each Block's own value over the Email style", async () => {
    const email = emailWith(
      { props: linked("the story"), type: "text" },
      {
        props: { ...linked("the menu"), color: "#52525b", fontSize: 18 },
        type: "text",
      },
      { props: { ...linked("Heading 1"), level: 1 }, type: "heading" },
      { props: { ...linked("Heading 2"), level: 2 }, type: "heading" },
      { props: { ...linked("Heading 3"), level: 3 }, type: "heading" },
      {
        props: { ...linked("Big"), color: "#333333", fontSize: 48, level: 1 },
        type: "heading",
      },
      { props: { label: "Order now" }, type: "button" },
      { props: { backgroundColor: "#2563eb", label: "Later" }, type: "button" }
    );
    email.version = 4;
    email.settings.style = STYLE;

    await expect(
      renderEmail(email).then(readable)
    ).resolves.toMatchFileSnapshot("expected/email-style.html");
  });

  it("puts the email's color behind each Row that doesn't set its own", async () => {
    const email = emailWith({ props: { label: "Own" }, type: "button" });
    email.version = 4;
    email.settings.style = { emailBackgroundColor: "#fbf7f1" };
    const [row] = email.rows as [BlocksDocument["rows"][0]];
    email.rows = [
      { ...row, props: { backgroundColor: "#000000" } },
      {
        ...row,
        columns: [{ ...row.columns[0], blocks: [], id: "column-2" }],
        id: "row-2",
      } as BlocksDocument["rows"][0],
    ];

    const html = await renderEmail(email);
    const [first, second] = html.split("Own");

    expect(first).toContain("background-color:#000000");
    expect(first).not.toContain("#fbf7f1");
    expect(second).toContain("background-color:#fbf7f1");
  });
});

describe("a Text Block's List on a phone", () => {
  // A List's indent is 1.5 times the font size, on the canvas as in the email.
  it("takes its indent from the Phone font size", async () => {
    const email = emailWith({
      props: {
        content: {
          content: [
            {
              content: [
                {
                  content: [
                    {
                      content: [{ text: "Beans", type: "text" }],
                      type: "paragraph",
                    },
                  ],
                  type: "listItem",
                },
              ],
              type: "bulletList",
            },
          ],
          type: "doc",
        },
        fontSize: 36,
        phone: { fontSize: 12 },
      },
      type: "text",
    });
    email.version = 4;

    const html = await renderEmail(email);

    expect(html).toContain("margin:0 0 0 54px;padding:0");
    expect(html).toMatch(/ul, [^{]*ol \{ margin-left:18px !important;/u);
  });
});
