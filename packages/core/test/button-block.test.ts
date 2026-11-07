import { describe, expect, it } from "vitest";

import {
  blockSettingsFields,
  blockStyles,
  createEditor,
  createEmail,
  loadDocument,
} from "../src/index.js";
import type { BlocksDocument } from "../src/index.js";

const withButton = (props: Record<string, unknown>): BlocksDocument => {
  const document = createEmail();
  const column = document.rows[0]?.columns[0];
  if (column) {
    column.blocks = [{ id: "button-1", props, type: "button" }];
  }
  return document;
};

const setup = () => ({
  editor: createEditor({ document: withButton({ label: "Buy" }) }),
});

const propsOf = (document: BlocksDocument) =>
  document.rows[0]?.columns[0]?.blocks[0]?.props;

const setHref = (href: unknown) => {
  const { editor } = setup();
  const result = editor.apply({
    blockId: "button-1",
    props: { href },
    type: "updateProps",
  });
  return { document: editor.getDocument(), result };
};

describe("Button Block", () => {
  it("is added with a label and no link", () => {
    const document = createEmail();
    const columnId = document.rows[0]?.columns[0]?.id as string;
    const editor = createEditor({ document });

    const result = editor.apply({
      blockType: "button",
      columnId,
      index: 0,
      type: "insertBlock",
    });

    expect(result.ok).toBeTruthy();
    expect(propsOf(editor.getDocument())).toStrictEqual({ label: "Button" });
  });

  it("stores a label, link, background color, text color and alignment", () => {
    const { editor } = setup();
    const props = {
      align: "center",
      backgroundColor: "#ff0000",
      color: "#00ff00",
      href: "https://shop.example/sale",
      label: "Hi {{first_name}}",
    };

    expect(
      editor.apply({ blockId: "button-1", props, type: "updateProps" })
    ).toStrictEqual({ ok: true });

    expect(propsOf(editor.getDocument())).toStrictEqual(props);
  });

  it.each([
    ["https://shop.example"],
    ["http://shop.example"],
    ["mailto:sales@shop.example"],
    ["tel:+15551234567"],
    ["{{cta_url}}"],
    ["{{base_url}}/sale?id=1"],
  ])("accepts the link %s", (href) => {
    const { document, result } = setHref(href);

    expect(result).toStrictEqual({ ok: true });
    expect(propsOf(document)).toStrictEqual({ href, label: "Buy" });
  });

  it.each([
    // oxlint-disable-next-line no-script-url -- What's being refused.
    ["javascript:alert(1)"],
    // oxlint-disable-next-line no-script-url -- What's being refused.
    ["JaVaScRiPt:alert(1)"],
    // oxlint-disable-next-line no-script-url -- What's being refused.
    [" javascript:alert(1)"],
    ["java\tscript:alert(1)"],
    ["data:text/html,<script>alert(1)</script>"],
    ["vbscript:msgbox(1)"],
    // oxlint-disable-next-line no-script-url -- What's being refused.
    ["{{x}}javascript:alert(1)"],
    ["/relative"],
    [""],
  ])("refuses the link %j", (href) => {
    const { document, result } = setHref(href);

    expect(result).toStrictEqual({
      ok: false,
      reason: expect.stringMatching(/href/u),
    });
    expect(propsOf(document)).toStrictEqual({ label: "Buy" });
  });

  it("can have its link removed", () => {
    const { editor } = setup();
    editor.apply({
      blockId: "button-1",
      props: { href: "https://shop.example" },
      type: "updateProps",
    });

    expect(
      editor.apply({
        blockId: "button-1",
        props: { href: null },
        type: "updateProps",
      })
    ).toStrictEqual({ ok: true });

    expect(propsOf(editor.getDocument())).toStrictEqual({ label: "Buy" });
  });

  it.each([
    ["no label", { label: null }, /label/u],
    ["an empty label", { label: "" }, /label/u],
    ["a label of only spaces", { label: "   " }, /label/u],
    ["a label that isn't text", { label: 1 }, /label/u],
    ["rich text as its label", { label: { type: "doc" } }, /label/u],
    ["an unknown alignment", { align: "justify" }, /align/u],
    ["a background MJML can't read", { backgroundColor: "red" }, /background/u],
    [
      "a see-through background, which MJML would paint twice",
      { backgroundColor: "rgba(37, 99, 235, 0.5)" },
      /backgroundColor/u,
    ],
    ["a text color MJML can't read", { color: "red" }, /color/u],
    ["a property it doesn't have", { fontSize: 20 }, /fontSize/u],
  ])("rejects %s", (_name, props, reason) => {
    const { editor } = setup();

    expect(
      editor.apply({ blockId: "button-1", props, type: "updateProps" })
    ).toStrictEqual({ ok: false, reason: expect.stringMatching(reason) });
  });

  it.each([["#123456"], ["#123"], ["rgb(1, 2, 3)"]])(
    "accepts the solid background %s",
    (backgroundColor) => {
      const { editor } = setup();

      expect(
        editor.apply({
          blockId: "button-1",
          props: { backgroundColor },
          type: "updateProps",
        })
      ).toStrictEqual({ ok: true });
    }
  );

  it("accepts see-through text, which is painted once", () => {
    const { editor } = setup();

    expect(
      editor.apply({
        blockId: "button-1",
        props: { color: "rgba(255, 255, 255, 0.5)" },
        type: "updateProps",
      })
    ).toStrictEqual({ ok: true });
  });

  it("makes one undo step of a change to its label", () => {
    const { editor } = setup();

    editor.apply({
      blockId: "button-1",
      props: { label: "Sell" },
      type: "updateProps",
    });
    editor.undo();

    expect(propsOf(editor.getDocument())).toStrictEqual({ label: "Buy" });
  });

  it("loads from a saved email", () => {
    const document = withButton({
      align: "right",
      backgroundColor: "#111111",
      color: "#eeeeee",
      href: "{{cta_url}}",
      label: "Go",
    });

    expect(loadDocument(document)).toStrictEqual({ document, ok: true });
  });

  it.each([
    ["no label", { href: "https://shop.example" }],
    // oxlint-disable-next-line no-script-url -- What's being refused.
    ["an executable link", { href: "javascript:alert(1)", label: "Go" }],
  ])("refuses a saved email with %s", (_name, props) => {
    expect(loadDocument(withButton(props))).toStrictEqual({
      ok: false,
      reason: expect.stringContaining('Block "button-1"'),
    });
  });

  it("has a look until its settings change it", () => {
    expect(
      blockStyles({ props: { label: "Go" }, type: "button" })
    ).toStrictEqual({
      "background-color": "#2563eb",
      color: "#ffffff",
      "text-align": "left",
    });
  });

  it("uses its own settings over that look", () => {
    expect(
      blockStyles({
        props: {
          align: "right",
          backgroundColor: "#111111",
          color: "#eeeeee",
          label: "Go",
        },
        type: "button",
      })
    ).toStrictEqual({
      "background-color": "#111111",
      color: "#eeeeee",
      "text-align": "right",
    });
  });

  it("offers its label, link, colors and alignment as settings", () => {
    expect(
      blockSettingsFields({ props: { label: "Go" }, type: "button" }).map(
        ({ key }) => key
      )
    ).toStrictEqual(["label", "href", "backgroundColor", "color", "align"]);
  });
});
