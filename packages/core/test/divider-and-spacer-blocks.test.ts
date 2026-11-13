import { describe, expect, it } from "vitest";

import { blockStyles, createEditor, createEmail } from "../src/index.js";
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
    type: "updateBlockProps",
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
    ["a color that isn't hex or rgb()", { color: "red" }, /color/u],
    ["a thickness over the limit", { thickness: 101 }, /thickness/u],
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
});

describe("Spacer Block", () => {
  it("stores a height", () => {
    const { document, result } = setProps("spacer", { height: 40 });

    expect(result).toStrictEqual({ ok: true });
    expect(propsOf(document)).toStrictEqual({ height: 40 });
  });

  it.each([["a height over the limit", { height: 1001 }, /height/u]])(
    "rejects %s",
    (_name, props, reason) => {
      expect(setProps("spacer", props).result).toStrictEqual({
        ok: false,
        reason: expect.stringMatching(reason),
      });
    }
  );

  it("has a height until its settings change it", () => {
    expect(blockStyles({ props: {}, type: "spacer" })).toStrictEqual({
      height: "24px",
    });
    expect(
      blockStyles({ props: { height: 40 }, type: "spacer" })
    ).toStrictEqual({ height: "40px" });
  });
});
