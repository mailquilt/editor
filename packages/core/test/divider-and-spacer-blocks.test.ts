import { describe, expect, it } from "vitest";

import {
  BLOCK_TYPES,
  blockSettingsFields,
  blockStyles,
  createEditor,
  createEmail,
  loadDocument,
} from "../src/index.js";
import type { BlocksDocument } from "../src/index.js";

const withBlock = (
  type: string,
  props: Record<string, unknown> = {}
): BlocksDocument => {
  const document = createEmail();
  const column = document.rows[0]?.columns[0];
  if (column) {
    column.blocks = [{ id: "block-1", props, type }];
  }
  return document;
};

const propsOf = (document: BlocksDocument) =>
  document.rows[0]?.columns[0]?.blocks[0]?.props;

const setProps = (type: string, props: Record<string, unknown>) => {
  const editor = createEditor({ document: withBlock(type) });
  const result = editor.apply({
    blockId: "block-1",
    props,
    type: "updateProps",
  });
  return { document: editor.getDocument(), result };
};

describe.each(["divider", "spacer"])("a %s Block", (type) => {
  it("is added with nothing set", () => {
    const document = createEmail();
    const columnId = document.rows[0]?.columns[0]?.id as string;
    const editor = createEditor({ document });

    const result = editor.apply({
      blockType: type,
      columnId,
      index: 0,
      type: "insertBlock",
    });

    expect(result.ok).toBeTruthy();
    expect(propsOf(editor.getDocument())).toStrictEqual({});
  });

  it("is offered in the palette", () => {
    expect(BLOCK_TYPES.map((block) => block.type)).toContain(type);
  });
});

describe("Divider Block", () => {
  it("stores a color and thickness", () => {
    const props = { color: "#ff0000", thickness: 4 };

    const { document, result } = setProps("divider", props);

    expect(result).toStrictEqual({ ok: true });
    expect(propsOf(document)).toStrictEqual(props);
  });

  it("accepts a see-through color, which is painted once", () => {
    expect(
      setProps("divider", { color: "rgba(0, 0, 0, 0.5)" }).result
    ).toStrictEqual({ ok: true });
  });

  it.each([
    ["a color MJML can't read", { color: "red" }, /color/u],
    ["a thickness of 0", { thickness: 0 }, /thickness/u],
    ["a thickness over the limit", { thickness: 101 }, /thickness/u],
    ["a fractional thickness", { thickness: 1.5 }, /thickness/u],
    ["a thickness that isn't a number", { thickness: "2px" }, /thickness/u],
    ["a property it doesn't have", { height: 10 }, /height/u],
  ])("rejects %s", (_name, props, reason) => {
    expect(setProps("divider", props).result).toStrictEqual({
      ok: false,
      reason: expect.stringMatching(reason),
    });
  });

  it("has a look until its settings change it", () => {
    expect(blockStyles({ props: {}, type: "divider" })).toStrictEqual({
      "border-color": "#d4d4d8",
      "border-width": "1px",
    });
  });

  it("uses its own settings over that look", () => {
    expect(
      blockStyles({
        props: { color: "#111111", thickness: 8 },
        type: "divider",
      })
    ).toStrictEqual({ "border-color": "#111111", "border-width": "8px" });
  });

  it("offers its color and thickness as settings", () => {
    expect(
      blockSettingsFields({ props: {}, type: "divider" }).map(({ key }) => key)
    ).toStrictEqual(["color", "thickness"]);
  });

  it("makes one undo step of a change", () => {
    const editor = createEditor({ document: withBlock("divider") });

    editor.apply({
      blockId: "block-1",
      props: { thickness: 4 },
      type: "updateProps",
    });
    editor.undo();

    expect(propsOf(editor.getDocument())).toStrictEqual({});
  });

  it("loads from a saved email", () => {
    const document = withBlock("divider", { color: "#123", thickness: 2 });

    expect(loadDocument(document)).toStrictEqual({ document, ok: true });
  });

  it("refuses a saved email with a thickness of 0", () => {
    expect(loadDocument(withBlock("divider", { thickness: 0 }))).toStrictEqual({
      ok: false,
      reason: expect.stringContaining('Block "block-1"'),
    });
  });
});

describe("Spacer Block", () => {
  it("stores a height", () => {
    const { document, result } = setProps("spacer", { height: 40 });

    expect(result).toStrictEqual({ ok: true });
    expect(propsOf(document)).toStrictEqual({ height: 40 });
  });

  it.each([
    ["a height of 0", { height: 0 }, /height/u],
    ["a height over the limit", { height: 1001 }, /height/u],
    ["a fractional height", { height: 1.5 }, /height/u],
    ["a height that isn't a number", { height: "40px" }, /height/u],
    ["a property it doesn't have", { color: "#000000" }, /color/u],
  ])("rejects %s", (_name, props, reason) => {
    expect(setProps("spacer", props).result).toStrictEqual({
      ok: false,
      reason: expect.stringMatching(reason),
    });
  });

  it("has a height until its settings change it", () => {
    expect(blockStyles({ props: {}, type: "spacer" })).toStrictEqual({
      height: "24px",
    });
    expect(
      blockStyles({ props: { height: 40 }, type: "spacer" })
    ).toStrictEqual({ height: "40px" });
  });

  it("offers its height as a setting", () => {
    expect(
      blockSettingsFields({ props: {}, type: "spacer" }).map(({ key }) => key)
    ).toStrictEqual(["height"]);
  });

  it("makes one undo step of a change", () => {
    const editor = createEditor({ document: withBlock("spacer") });

    editor.apply({
      blockId: "block-1",
      props: { height: 40 },
      type: "updateProps",
    });
    editor.undo();

    expect(propsOf(editor.getDocument())).toStrictEqual({});
  });

  it("loads from a saved email", () => {
    const document = withBlock("spacer", { height: 40 });

    expect(loadDocument(document)).toStrictEqual({ document, ok: true });
  });

  it("refuses a saved email with a height of 0", () => {
    expect(loadDocument(withBlock("spacer", { height: 0 }))).toStrictEqual({
      ok: false,
      reason: expect.stringContaining('Block "block-1"'),
    });
  });
});
