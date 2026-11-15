import { describe, expect, it } from "vitest";

import { renderEmail } from "../src/index.js";
import { emailWith } from "./email-with.js";

const image = (props: Record<string, unknown>) => ({ props, type: "image" });
const divider = (props: Record<string, unknown>) => ({
  props,
  type: "divider",
});
const spacer = (props: Record<string, unknown>) => ({
  props,
  type: "spacer",
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
      )
    ).resolves.toMatchFileSnapshot("expected/image-every-setting.html");
  });

  it("has empty alt text and no link with only a URL", async () => {
    const html = await renderEmail(emailWith(image({ src: LOGO })));

    expect(imageTag(html)).toContain('alt=""');
    expect(html).not.toMatch(/<a\s[^>]*>\s*<img/u);
  });
});

describe("a Divider Block", () => {
  it("draws its line in its color and thickness, inside the Block's padding", async () => {
    const html = await renderEmail(
      emailWith(divider({ color: "#123456", thickness: 3 }))
    );

    expect(html).toContain('style="border-top:solid 3px #123456;');
    expect(html).toContain(
      'style="font-size:0px;padding:16px;word-break:break-word;"'
    );
  });
});

describe("a Spacer Block", () => {
  it("takes up its height and no padding", async () => {
    const html = await renderEmail(emailWith(spacer({ height: 40 })));

    expect(html).toContain('style="height:40px;line-height:40px;"');
    expect(html).toContain('style="font-size:0px;word-break:break-word;"');
  });
});
