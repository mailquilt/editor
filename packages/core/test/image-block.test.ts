import { describe, expect, it } from "vitest";

import {
  blockSettingsFields,
  blockStyles,
  createEditor,
  createEmail,
  loadDocument,
} from "../src/index.js";
import type { BlocksDocument } from "../src/index.js";

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
    type: "updateProps",
  });
  return { document: editor.getDocument(), result };
};

describe("Image Block", () => {
  it("is added with nothing set, as there's no image to show yet", () => {
    const document = createEmail();
    const columnId = document.rows[0]?.columns[0]?.id as string;
    const editor = createEditor({ document });

    const result = editor.apply({
      blockType: "image",
      columnId,
      index: 0,
      type: "insertBlock",
    });

    expect(result.ok).toBeTruthy();
    expect(propsOf(editor.getDocument())).toStrictEqual({});
  });

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

  it.each([
    ["https://shop.example"],
    ["mailto:sales@shop.example"],
    ["tel:+15551234567"],
    ["{{cta_url}}"],
  ])("accepts the link %s", (href) => {
    expect(setProps({ href }).result).toStrictEqual({ ok: true });
  });

  it.each([
    // oxlint-disable-next-line no-script-url -- What's being refused.
    ["javascript:alert(1)"],
    ["data:text/html,<script>alert(1)</script>"],
    // oxlint-disable-next-line no-script-url -- What's being refused.
    ["{{x}}javascript:alert(1)"],
    ["/relative"],
  ])("refuses the link %j", (href) => {
    expect(setProps({ href }).result).toStrictEqual({
      ok: false,
      reason: expect.stringMatching(/href/u),
    });
  });

  it.each([
    ["a width of 0", { width: 0 }, /width/u],
    ["a negative width", { width: -1 }, /width/u],
    ["a fractional width", { width: 1.5 }, /width/u],
    ["a width that isn't a number", { width: "100px" }, /width/u],
    ["alt text that isn't text", { alt: 1 }, /alt/u],
    ["a property it doesn't have", { align: "left" }, /align/u],
  ])("rejects %s", (_name, props, reason) => {
    expect(setProps(props).result).toStrictEqual({
      ok: false,
      reason: expect.stringMatching(reason),
    });
  });

  it("can have its settings removed", () => {
    const editor = createEditor({
      document: withImage({ alt: "Logo", src: "{{logo_url}}", width: 100 }),
    });

    expect(
      editor.apply({
        blockId: "image-1",
        props: { alt: null, src: null, width: null },
        type: "updateProps",
      })
    ).toStrictEqual({ ok: true });

    expect(propsOf(editor.getDocument())).toStrictEqual({});
  });

  it("makes one undo step of a change to its URL", () => {
    const editor = createEditor({
      document: withImage({ src: "{{logo_url}}" }),
    });

    editor.apply({
      blockId: "image-1",
      props: { src: "https://cdn.example/new.png" },
      type: "updateProps",
    });
    editor.undo();

    expect(propsOf(editor.getDocument())).toStrictEqual({
      src: "{{logo_url}}",
    });
  });

  it("loads from a saved email", () => {
    const document = withImage({
      alt: "Logo",
      href: "{{cta_url}}",
      src: "{{logo_url}}",
      width: 120,
    });

    expect(loadDocument(document)).toStrictEqual({ document, ok: true });
  });

  it.each([
    // oxlint-disable-next-line no-script-url -- What's being refused.
    ["an executable image URL", { src: "javascript:alert(1)" }],
    // oxlint-disable-next-line no-script-url -- What's being refused.
    ["an executable link", { href: "javascript:alert(1)" }],
  ])("refuses a saved email with %s", (_name, props) => {
    expect(loadDocument(withImage(props))).toStrictEqual({
      ok: false,
      reason: expect.stringContaining('Block "image-1"'),
    });
  });

  it("has no CSS until a width is set", () => {
    expect(blockStyles({ props: {}, type: "image" })).toStrictEqual({});
    expect(blockStyles({ props: { width: 240 }, type: "image" })).toStrictEqual(
      { width: "240px" }
    );
  });

  it("offers its URL, alt text, width and link as settings", () => {
    expect(
      blockSettingsFields({ props: {}, type: "image" }).map(({ key }) => key)
    ).toStrictEqual(["src", "alt", "width", "href"]);
  });
});
