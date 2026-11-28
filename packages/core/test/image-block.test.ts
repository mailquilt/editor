import { describe, expect, it } from "vitest";

import { createEditor, createEmail } from "../src/index.js";
import type { BlocksDocument } from "../src/index.js";
import { blockSettingsFields, blockStyles } from "../src/internal.js";

const withImage = (props: Record<string, unknown>): BlocksDocument => {
  const document = createEmail();
  const column = document.rows[0]?.columns[0];
  if (column) {
    column.blocks = [{ id: "image-1", props, type: "image" }];
  }
  return document;
};

const propsOf = (document: BlocksDocument) =>
  document.rows[0]?.columns[0]?.blocks[0]?.props;

const setProps = (props: Record<string, unknown>) => {
  const editor = createEditor({ document: withImage({}) });
  const result = editor.apply({
    blockId: "image-1",
    props,
    type: "updateBlockProps",
  });
  return { document: editor.getDocument(), result };
};

/** Marks an Image with these props as decorative. */
const markDecorative = (props: Record<string, unknown>) => {
  const editor = createEditor({ document: withImage(props) });
  const result = editor.apply({
    blockId: "image-1",
    props: { decorative: true },
    type: "updateBlockProps",
  });
  return { document: editor.getDocument(), result };
};

const linkField = (props: Record<string, unknown>) =>
  blockSettingsFields({ props, type: "image" }).find(
    ({ key }) => key === "href"
  );

describe("Image Block", () => {
  it("stores a URL, alt text, width and link", () => {
    const props = {
      alt: "Our logo",
      href: "https://shop.example",
      src: "https://cdn.example/logo.png",
      width: 240,
    };

    const { document, result } = setProps(props);

    expect(result).toStrictEqual({ ok: true });
    expect(propsOf(document)).toStrictEqual(props);
  });

  it.each([
    ["https://cdn.example/logo.png"],
    ["http://cdn.example/logo.png"],
    ["HTTPS://cdn.example/logo.png"],
    ["{{logo_url}}"],
    ["{{cdn}}/logo.png"],
  ])("accepts the image URL %s", (src) => {
    const { document, result } = setProps({ src });

    expect(result).toStrictEqual({ ok: true });
    expect(propsOf(document)).toStrictEqual({ src });
  });

  it.each([
    // oxlint-disable-next-line no-script-url -- What's being refused.
    ["javascript:alert(1)"],
    // oxlint-disable-next-line no-script-url -- What's being refused.
    ["JaVaScRiPt:alert(1)"],
    // oxlint-disable-next-line no-script-url -- What's being refused.
    [" javascript:alert(1)"],
    ["java\tscript:alert(1)"],
    // Unicode case folding would read ſ as s.
    ["httpſ://cdn.example/logo.png"],
    ["data:image/svg+xml,<svg onload=alert(1)>"],
    ["vbscript:msgbox(1)"],
    // oxlint-disable-next-line no-script-url -- What's being refused.
    ["{{x}}javascript:alert(1)"],
    ["mailto:sales@shop.example"],
    ["tel:+15551234567"],
    ["/logo.png"],
    [""],
  ])("refuses the image URL %j", (src) => {
    const { document, result } = setProps({ src });

    expect(result).toStrictEqual({
      code: "invalidProps",
      ok: false,
      reason: expect.stringMatching(/src/u),
    });
    expect(propsOf(document)).toStrictEqual({});
  });

  it("refuses a link the allowlist refuses", () => {
    expect(
      // oxlint-disable-next-line no-script-url -- What's being refused.
      setProps({ alt: "Our logo", href: "javascript:alert(1)" }).result
    ).toStrictEqual({
      code: "invalidProps",
      ok: false,
      reason: expect.stringMatching(/href/u),
    });
  });

  it("refuses a width of 0", () => {
    expect(setProps({ width: 0 }).result).toStrictEqual({
      code: "invalidProps",
      ok: false,
      reason: expect.stringMatching(/width/u),
    });
  });

  it.each([
    ["no alt text", {}],
    ["alt text of only spaces", { alt: "   " }],
  ])("refuses a link with %s, as nothing would name it", (_name, props) => {
    const { document, result } = setProps({
      ...props,
      href: "https://shop.example",
    });

    expect(result).toStrictEqual({
      code: "invalidProps",
      ok: false,
      reason: expect.stringMatching(/alt text/u),
    });
    expect(propsOf(document)).toStrictEqual({});
  });

  it("can lose its link and alt text together", () => {
    const editor = createEditor({
      document: withImage({ alt: "Logo", href: "https://shop.example" }),
    });

    expect(
      editor.apply({
        blockId: "image-1",
        props: { alt: null, href: null },
        type: "updateBlockProps",
      })
    ).toStrictEqual({ ok: true });
  });

  it("has no CSS until a width is set", () => {
    expect(blockStyles({ props: {}, type: "image" })).toStrictEqual({});
    expect(blockStyles({ props: { width: 240 }, type: "image" })).toStrictEqual(
      { width: "240px" }
    );
  });

  it("doesn't offer a link until it has alt text", () => {
    expect(linkField({})).toMatchObject({ disabled: true });
    expect(linkField({ alt: "   " })).toMatchObject({ disabled: true });
    expect(linkField({ alt: "Logo" })).not.toHaveProperty("disabled");
  });

  describe("marked as decorative", () => {
    it("is stored on an Image with neither alt text nor a link", () => {
      const { document, result } = markDecorative({
        src: "https://cdn.example/a.png",
      });

      expect(result).toStrictEqual({ ok: true });
      expect(propsOf(document)).toStrictEqual({
        decorative: true,
        src: "https://cdn.example/a.png",
      });
    });

    it.each([
      ["alt text", { alt: "A line of beans" }],
      ["a link", { alt: "Shop", href: "https://shop.example" }],
    ])("refuses an Image with %s, unchanged", (_name, props) => {
      const { document, result } = markDecorative(props);

      expect(result).toStrictEqual({
        code: "invalidProps",
        ok: false,
        reason: expect.stringMatching(/decorative/u),
      });
      expect(propsOf(document)).toStrictEqual(props);
    });

    it("refuses a link given with it, as decorative rather than as missing alt text", () => {
      const { document, result } = setProps({
        decorative: true,
        href: "https://shop.example",
      });

      expect(result).toStrictEqual({
        code: "invalidProps",
        ok: false,
        reason: expect.not.stringMatching(/needs alt text/u),
      });
      expect(propsOf(document)).toStrictEqual({});
    });

    it("refuses alt text once it's decorative", () => {
      const editor = createEditor({
        document: withImage({ decorative: true }),
      });

      expect(
        editor.apply({
          blockId: "image-1",
          props: { alt: "A line of beans" },
          type: "updateBlockProps",
        })
      ).toMatchObject({ code: "invalidProps", ok: false });
    });

    it("has no alt text field, and no link to add", () => {
      const fields = blockSettingsFields({
        props: { decorative: true },
        type: "image",
      });

      expect(fields.map(({ key }) => key)).not.toContain("alt");
      expect(linkField({ decorative: true })).toMatchObject({
        descriptionId: "field.link.decorative",
        disabled: true,
      });
    });
  });
});
