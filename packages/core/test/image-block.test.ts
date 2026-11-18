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
      ok: false,
      reason: expect.stringMatching(/href/u),
    });
  });

  it.each([["a width of 0", { width: 0 }, /width/u]])(
    "rejects %s",
    (_name, props, reason) => {
      expect(setProps(props).result).toStrictEqual({
        ok: false,
        reason: expect.stringMatching(reason),
      });
    }
  );

  it.each([
    ["no alt text", {}],
    ["alt text of only spaces", { alt: "   " }],
  ])("refuses a link with %s, as nothing would name it", (_name, props) => {
    const { document, result } = setProps({
      ...props,
      href: "https://shop.example",
    });

    expect(result).toStrictEqual({
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
});
