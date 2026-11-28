import { describe, expect, it } from "vitest";

import { renderEmail } from "../src/index.js";
import { emailWith, readable } from "./email-with.js";

const richText = (...paragraphs: unknown[][]) => ({
  content: paragraphs.map((content) =>
    content.length > 0 ? { content, type: "paragraph" } : { type: "paragraph" }
  ),
  type: "doc",
});

const text = (value: string, marks?: unknown[]) => ({
  ...(marks ? { marks } : {}),
  text: value,
  type: "text",
});

const heading = (props: Record<string, unknown>) => ({
  props,
  type: "heading" as const,
});

const button = (props: Record<string, unknown>) => ({
  props,
  type: "button" as const,
});

/** The opening tag of the Button's link, with its attributes. */
const buttonLink = (html: string) => html.match(/<a\s[^>]*>/u)?.[0] ?? "";

describe("a Heading Block", () => {
  it("matches the saved HTML with every setting", async () => {
    await expect(
      renderEmail(
        emailWith(
          heading({
            align: "center",
            color: "#123456",
            content: richText([text("Hello {{first_name}}")]),
            fontSize: 44,
            level: 2,
          })
        )
      ).then(readable)
    ).resolves.toMatchFileSnapshot("expected/heading-every-setting.html");
  });

  it("stays one heading across paragraphs, as lines", async () => {
    const html = await renderEmail(
      emailWith(
        heading({
          content: richText([text("One")], [], [text("Two")]),
          level: 1,
        })
      )
    );

    expect(html.match(/<h1\b/gu)).toHaveLength(1);
    expect(html).toContain(">One<br /><br />Two</h1>");
  });

  it("keeps a last empty line, as the canvas shows it", async () => {
    const html = await renderEmail(
      emailWith(heading({ content: richText([text("One")], []), level: 1 }))
    );

    expect(html).toContain(">One<br /><br /></h1>");
  });

  it.each([
    ["no text", richText([])],
    ["only spaces", richText([text("   ")])],
    ["only line breaks", richText([{ type: "hardBreak" }])],
  ])("is no heading to a screen reader with %s", async (_name, content) => {
    const html = await renderEmail(emailWith(heading({ content, level: 1 })));

    expect(html).not.toMatch(/<h1\b/u);
    // It still takes up the space it does on the canvas.
    expect(html).toMatch(/<p style="[^"]*font-size:32px[^"]*">/u);
  });

  it("has an exact line height in pixels, as classic Outlook needs", async () => {
    const html = await renderEmail(
      emailWith(heading({ content: richText([text("Hi")]), level: 3 }))
    );

    expect(html).toMatch(
      /<h3 style="[^"]*;line-height:30px;mso-line-height-rule:exactly;[^"]*">Hi<\/h3>/u
    );
    expect(html).not.toContain("line-height:1.5");
  });

  it("colors a link as the Heading", async () => {
    const link = { attrs: { href: "https://x.test" }, type: "link" };
    const html = await renderEmail(
      emailWith(
        heading({
          color: "#123456",
          content: richText([text("Sale", [link])]),
          level: 1,
        })
      )
    );

    expect(html).toContain(
      '<a href="https://x.test" target="_blank" style="color:#123456;text-decoration:underline">Sale</a>'
    );
  });

  it("escapes its text", async () => {
    const html = await renderEmail(
      emailWith(heading({ content: richText([text("<script>&")]), level: 1 }))
    );

    expect(html).toContain("&lt;script&gt;&amp;</h1>");
    expect(html).not.toContain("<script>");
  });
});

describe("a Button Block", () => {
  it("matches the saved HTML with every setting", async () => {
    await expect(
      renderEmail(
        emailWith(
          button({
            align: "right",
            backgroundColor: "#123456",
            color: "#fedcba",
            href: "https://shop.example/sale?a=1&b=2",
            label: "Buy now",
          })
        )
      ).then(readable)
    ).resolves.toMatchFileSnapshot("expected/button-every-setting.html");
  });

  it("has no link with only a label", async () => {
    const html = await renderEmail(emailWith(button({ label: "Pay now" })));

    expect(html).toContain("Pay now");
    expect(buttonLink(html)).toBe("");
  });

  it("keeps a Merge Tag intact in its link and label", async () => {
    const html = await renderEmail(
      emailWith(button({ href: "{{cta_url}}", label: "Hi {{first_name}}" }))
    );

    expect(buttonLink(html)).toContain('href="{{cta_url}}"');
    expect(html).toMatch(/>\s*Hi \{\{first_name\}\}\s*<\/a>/u);
  });

  it("lets a label's word of 20 or more characters wrap, in clients that won't break it", async () => {
    const html = await renderEmail(
      emailWith(
        button({
          href: "https://x.test",
          label: "Download welcome_guide_v2.pdf now",
        })
      )
    );

    expect(html).toMatch(
      />\s*Download welcome_&#8203;guide_&#8203;v2.&#8203;pdf now\s*<\/a>/u
    );
  });

  it("keeps a label plain text, whatever it holds", async () => {
    const html = await renderEmail(
      emailWith(
        button({
          href: "https://shop.example",
          label: "</mj-button><script>alert(1)</script><b>&",
        })
      )
    );

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>");
    expect(html).toContain(
      "&lt;/&#8203;mj-&#8203;button&gt;&lt;script&gt;alert(1)&lt;/&#8203;script&gt;&lt;b&gt;&amp;"
    );
  });

  it("can't break out of its link", async () => {
    const html = await renderEmail(
      emailWith(
        button({
          href: 'https://shop.example/"onclick="alert(1)',
          label: "Buy",
        })
      )
    );

    expect(buttonLink(html)).not.toContain('onclick="');
    expect(buttonLink(html)).toContain("&quot;onclick=&quot;");
  });
});
