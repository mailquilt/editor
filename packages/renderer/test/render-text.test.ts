import { describe, expect, it } from "vitest";

import { renderText } from "../src/index.js";
import { emailWith } from "./email-with.js";

const paragraph = (...content: Record<string, unknown>[]) => ({
  content,
  type: "paragraph",
});

const words = (text: string, marks?: Record<string, unknown>[]) => ({
  text,
  type: "text",
  ...(marks && { marks }),
});

const link = (href: string) => ({ attrs: { href }, type: "link" });

const text = (...content: Record<string, unknown>[]) => ({
  props: { content: { content, type: "doc" } },
  type: "text" as const,
});

describe("the plain text", () => {
  it("writes a Heading in capitals and a Text Block's paragraphs as lines, with Merge Tags as written", () => {
    expect(
      renderText(
        emailWith(
          {
            props: {
              content: {
                content: [paragraph(words("Hello {{first_name}}"))],
                type: "doc",
              },
              level: 1,
            },
            type: "heading",
          },
          text(
            paragraph(words("Your price holds until {{Day Name}}.")),
            paragraph(
              words("Line one"),
              { type: "hardBreak" },
              words("line two")
            )
          )
        )
      )
    ).toBe(
      "HELLO {{first_name}}\n\nYour price holds until {{Day Name}}.\nLine one\nline two"
    );
  });

  it("writes a link as its text and URL, once for a link across bold, and the URL alone where it's the text", () => {
    const shop = link("https://shop.example/{{id}}");
    expect(
      renderText(
        emailWith(
          {
            props: {
              content: {
                content: [
                  paragraph(
                    words("Our menu", [link("https://shop.example/menu")])
                  ),
                ],
                type: "doc",
              },
              level: 2,
            },
            type: "heading",
          },
          text(
            paragraph(
              words("See "),
              words("the ", [shop]),
              words("roast", [shop, { type: "bold" }]),
              words(" or "),
              words("https://shop.example", [link("https://shop.example")]),
              words(" or "),
              words("ana@shop.example", [link("mailto:ana@shop.example")])
            )
          )
        )
      )
    ).toBe(
      "OUR MENU (https://shop.example/menu)\n\nSee the roast (https://shop.example/{{id}}) or https://shop.example or ana@shop.example"
    );
  });

  it("keeps a Heading's URLs as written, linked or not, and its capitals in the email's language", () => {
    const email = emailWith(
      {
        props: {
          content: {
            content: [
              paragraph(
                words("https://shop.example/Sale", [
                  link("https://shop.example/Sale"),
                ]),
                words(" or www.shop.example/Spring")
              ),
            ],
            type: "doc",
          },
          level: 1,
        },
        type: "heading",
      },
      {
        props: {
          content: { content: [paragraph(words("indirim"))], type: "doc" },
          level: 2,
        },
        type: "heading",
      }
    );
    email.settings.language = "tr";
    expect(renderText(email)).toBe(
      "https://shop.example/Sale OR www.shop.example/Spring\n\nİNDİRİM"
    );
  });

  it("writes a link across a line break once", () => {
    const shop = link("https://shop.example");
    expect(
      renderText(
        emailWith(
          text(
            paragraph(
              words("Shop", [shop]),
              { type: "hardBreak" },
              words("now", [shop])
            )
          )
        )
      )
    ).toBe("Shop\nnow (https://shop.example)");
  });

  it("writes a Button as its label and URL", () => {
    expect(
      renderText(
        emailWith(
          {
            props: {
              href: "https://shop.example/{{id}}",
              label: "Shop the roast",
            },
            type: "button",
          },
          { props: { label: "No link yet" }, type: "button" }
        )
      )
    ).toBe("Shop the roast: https://shop.example/{{id}}\n\nNo link yet");
  });

  it("writes an Image's alt text, and its link, and leaves out one with no image", () => {
    const src = "https://shop.example/beans.jpg";
    expect(
      renderText(
        emailWith(
          { props: { alt: "Roasted beans", src }, type: "image" },
          {
            props: { alt: "Our shop", href: "https://shop.example", src },
            type: "image",
          },
          { props: { src }, type: "image" },
          {
            props: { alt: "Not chosen yet", href: "https://shop.example/gone" },
            type: "image",
          },
          { props: {}, type: "divider" },
          { props: {}, type: "spacer" }
        )
      )
    ).toBe("[Roasted beans]\n\n[Our shop] (https://shop.example)");
  });

  it("writes a Social Block's links that have a URL, each with its network", () => {
    expect(
      renderText(
        emailWith({
          props: {
            links: [
              { network: "instagram", url: "https://instagram.com/shop" },
              { network: "facebook" },
              { network: "website", url: "{{site_url}}" },
            ],
          },
          type: "social",
        })
      )
    ).toBe("Instagram: https://instagram.com/shop\nWebsite: {{site_url}}");
  });

  it("writes a bulleted List's items with a dash and a numbered List's from 1", () => {
    const list = (type: string, ...items: string[]) => ({
      content: items.map((item) => ({
        content: [paragraph(words(item))],
        type: "listItem",
      })),
      type,
    });
    expect(
      renderText(
        emailWith(
          text(
            paragraph(words("Pack:")),
            list("bulletList", "Beans", "Filters"),
            list("orderedList", "Grind", "Pour")
          )
        )
      )
    ).toBe("Pack:\n- Beans\n- Filters\n1. Grind\n2. Pour");
  });

  it("throws with the reason for an email it can't accept", () => {
    expect(() => renderText({ kind: "blocks" })).toThrow(/version/u);
  });
});
