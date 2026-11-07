import type { BlocksDocument } from "@mailquilt/core";
import { describe, expect, it } from "vitest";

import { renderEmail } from "../src/node.js";

const emailWith = (
  ...blocks: { props: Record<string, unknown>; type: string }[]
): BlocksDocument => ({
  kind: "blocks",
  rows: [
    {
      columns: [
        {
          blocks: blocks.map((block, index) => ({
            id: `block-${index}`,
            ...block,
          })),
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
    backgroundColor: "#ffffff",
    fontFamily: "Arial, Helvetica, sans-serif",
    width: 600,
  },
  version: 1,
});

const image = (props: Record<string, unknown>) => ({ props, type: "image" });
const divider = (props: Record<string, unknown> = {}) => ({
  props,
  type: "divider",
});
const spacer = (props: Record<string, unknown> = {}) => ({
  props,
  type: "spacer",
});

/** The opening tag of the image, with its attributes. */
const imageTag = (html: string) => html.match(/<img\s[^>]*>/u)?.[0] ?? "";

const LOGO = "https://cdn.example/logo.png";

describe("an Image Block", () => {
  it("includes its alt text", async () => {
    const html = await renderEmail(
      emailWith(image({ alt: "Our logo", src: LOGO }))
    );

    expect(imageTag(html)).toContain('alt="Our logo"');
  });

  it("has an empty alt rather than none, so its URL isn't read out", async () => {
    const html = await renderEmail(emailWith(image({ src: LOGO })));

    expect(imageTag(html)).toContain('alt=""');
  });

  it("escapes its alt text and URLs", async () => {
    const html = await renderEmail(
      emailWith(
        image({
          alt: 'A "quoted" <b> & more',
          href: "https://shop.example/?a=1&b=2",
          src: "https://cdn.example/i.png?a=1&b=2",
        })
      )
    );

    expect(imageTag(html)).toContain(
      'alt="A &quot;quoted&quot; &lt;b&gt; &amp; more"'
    );
    expect(imageTag(html)).toContain(
      'src="https://cdn.example/i.png?a=1&amp;b=2"'
    );
    expect(html).toContain('href="https://shop.example/?a=1&amp;b=2"');
  });

  it("keeps Merge Tags in its URL, link and alt text", async () => {
    const html = await renderEmail(
      emailWith(
        image({
          alt: "{{company}} logo",
          href: "{{site_url}}",
          src: "{{logo_url}}",
        })
      )
    );

    expect(imageTag(html)).toContain('src="{{logo_url}}"');
    expect(imageTag(html)).toContain('alt="{{company}} logo"');
    expect(html).toContain('href="{{site_url}}"');
  });

  it("is only a link if it has one", async () => {
    const html = await renderEmail(emailWith(image({ src: LOGO })));

    expect(html).not.toMatch(/<a\s/u);
  });

  it("stops at the Column's width, less its padding", async () => {
    const html = await renderEmail(
      emailWith(image({ src: LOGO, width: 5000 }))
    );

    expect(imageTag(html)).toContain('width="568"');
  });

  it("leaves nothing in the email until it has a URL", async () => {
    const html = await renderEmail(
      emailWith(
        image({ alt: "Logo", href: "https://shop.example", width: 100 })
      )
    );

    expect(html).not.toContain("<img");
    expect(html).not.toContain("shop.example");
  });

  it.each([
    // oxlint-disable-next-line no-script-url -- What's being refused.
    ["an executable URL", { src: "javascript:alert(1)" }, /src/u],
    // oxlint-disable-next-line no-script-url -- What's being refused.
    ["an executable link", { href: "javascript:alert(1)", src: LOGO }, /href/u],
  ])("refuses to export %s", async (_name, props, reason) => {
    await expect(renderEmail(emailWith(image(props)))).rejects.toThrow(reason);
  });

  it("matches the saved HTML with every setting", async () => {
    await expect(
      renderEmail(
        emailWith(
          image({
            alt: "{{company}} logo",
            href: "{{site_url}}",
            src: "{{logo_url}}",
            width: 240,
          })
        )
      )
    ).resolves.toMatchFileSnapshot("expected/image-every-setting.html");
  });

  it("matches the saved HTML with only a URL", async () => {
    await expect(
      renderEmail(emailWith(image({ src: LOGO })))
    ).resolves.toMatchFileSnapshot("expected/image-url-only.html");
  });
});

describe("a Divider Block", () => {
  it("renders a line of its color and thickness", async () => {
    const html = await renderEmail(
      emailWith(divider({ color: "#ff0000", thickness: 4 }))
    );

    expect(html).toContain("border-top:solid 4px #ff0000");
  });

  it("has a look of its own with nothing set", async () => {
    const html = await renderEmail(emailWith(divider()));

    expect(html).toContain("border-top:solid 1px #d4d4d8");
  });

  it("matches the saved HTML with every setting", async () => {
    await expect(
      renderEmail(emailWith(divider({ color: "#123456", thickness: 3 })))
    ).resolves.toMatchFileSnapshot("expected/divider-every-setting.html");
  });

  it("matches the saved HTML with nothing set", async () => {
    await expect(
      renderEmail(emailWith(divider()))
    ).resolves.toMatchFileSnapshot("expected/divider-defaults.html");
  });
});

describe("a Spacer Block", () => {
  it("renders space of its height", async () => {
    const html = await renderEmail(emailWith(spacer({ height: 40 })));

    expect(html).toMatch(/height:40px;\s*line-height:40px/u);
  });

  it("has a height of its own with nothing set", async () => {
    const html = await renderEmail(emailWith(spacer()));

    expect(html).toMatch(/height:24px;\s*line-height:24px/u);
  });

  it("matches the saved HTML with its height set", async () => {
    await expect(
      renderEmail(emailWith(spacer({ height: 40 })))
    ).resolves.toMatchFileSnapshot("expected/spacer-height.html");
  });

  it("matches the saved HTML with nothing set", async () => {
    await expect(renderEmail(emailWith(spacer()))).resolves.toMatchFileSnapshot(
      "expected/spacer-defaults.html"
    );
  });
});
