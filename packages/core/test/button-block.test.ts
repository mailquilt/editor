import { describe, expect, it } from "vitest";

import { blockStyles, createEditor, createEmail } from "../src/index.js";
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
    type: "updateBlockProps",
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
      editor.apply({ blockId: "button-1", props, type: "updateBlockProps" })
    ).toStrictEqual({ ok: true });

    expect(propsOf(editor.getDocument())).toStrictEqual(props);
  });

  it("refuses a link the allowlist refuses", () => {
    // oxlint-disable-next-line no-script-url -- What's being refused.
    const { document, result } = setHref("javascript:alert(1)");

    expect(result).toStrictEqual({
      ok: false,
      reason: expect.stringMatching(/href/u),
    });
    expect(propsOf(document)).toStrictEqual({ label: "Buy" });
  });

  it.each([
    ["no label", { label: null }, /label/u],
    ["a label of only spaces", { label: "   " }, /label/u],
    ["a label that isn't text", { label: 1 }, /label/u],
    [
      "a background that isn't hex or rgb()",
      { backgroundColor: "red" },
      /background/u,
    ],
    [
      "a see-through background, which MJML would paint twice",
      { backgroundColor: "rgba(37, 99, 235, 0.5)" },
      /backgroundColor/u,
    ],
    ["a text color that isn't hex or rgb()", { color: "red" }, /color/u],
  ])("rejects %s", (_name, props, reason) => {
    const { editor } = setup();

    expect(
      editor.apply({ blockId: "button-1", props, type: "updateBlockProps" })
    ).toStrictEqual({ ok: false, reason: expect.stringMatching(reason) });
  });

  it("accepts see-through text, which is painted once", () => {
    const { editor } = setup();

    expect(
      editor.apply({
        blockId: "button-1",
        props: { color: "rgba(255, 255, 255, 0.5)" },
        type: "updateBlockProps",
      })
    ).toStrictEqual({ ok: true });
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
});
