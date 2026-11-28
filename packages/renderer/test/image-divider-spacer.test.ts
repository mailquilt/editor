import { describe, expect, it } from "vitest";

import { renderEmail } from "../src/index.js";
import { emailWith, readable } from "./email-with.js";

const image = (props: Record<string, unknown>) => ({
  props,
  type: "image" as const,
});
const divider = (props: Record<string, unknown>) => ({
  props,
  type: "divider" as const,
});
const spacer = (props: Record<string, unknown>) => ({
  props,
  type: "spacer" as const,
});

/** The opening tag of the image, with its attributes. */
const imageTag = (html: string) => html.match(/<img\s[^>]*>/u)?.[0] ?? "";

const LOGO = "https://cdn.example/logo.png";

describe("an Image Block", () => {
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

  // Core sets no maximum Image width and relies on this.
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
      ).then(readable)
    ).resolves.toMatchFileSnapshot("expected/image-every-setting.html");
  });

  it("has empty alt text and no link with only a URL", async () => {
    const html = await renderEmail(emailWith(image({ src: LOGO })));

    expect(imageTag(html)).toContain('alt=""');
    expect(html).not.toMatch(/<a\s[^>]*>\s*<img/u);
  });

  it("matches the saved HTML when it's decorative", async () => {
    await expect(
      renderEmail(
        emailWith(image({ decorative: true, src: LOGO, width: 240 }))
      ).then(readable)
    ).resolves.toMatchFileSnapshot("expected/image-decorative.html");
  });
});

describe("a Divider Block", () => {
  it("matches the saved HTML with its color and thickness", async () => {
    await expect(
      renderEmail(emailWith(divider({ color: "#123456", thickness: 3 }))).then(
        readable
      )
    ).resolves.toMatchFileSnapshot("expected/divider.html");
  });
});

describe("a Spacer Block", () => {
  it("matches the saved HTML with its height", async () => {
    await expect(
      renderEmail(emailWith(spacer({ height: 40 }))).then(readable)
    ).resolves.toMatchFileSnapshot("expected/spacer.html");
  });
});
