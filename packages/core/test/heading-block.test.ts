import { describe, expect, it } from "vitest";

import { createEditor, createEmail, loadDocument } from "../src/index.js";
import type { BlocksDocument } from "../src/index.js";
import { blockSettingsFields, blockStyles } from "../src/internal.js";
import type { SettingsField } from "../src/internal.js";

const emptyText = { content: [{ type: "paragraph" }], type: "doc" };

const withHeading = (props: Record<string, unknown>): BlocksDocument => {
  const document = createEmail();
  const column = document.rows[0]?.columns[0];
  if (column) {
    column.blocks = [{ id: "heading-1", props, type: "heading" }];
  }
  return document;
};

const setup = () => {
  const document = withHeading({ content: emptyText, level: 1 });
  return { editor: createEditor({ document }) };
};

const propsOf = (document: BlocksDocument) =>
  document.rows[0]?.columns[0]?.blocks[0]?.props;

const fontSizeField = (level: number) =>
  blockSettingsFields({
    props: { content: emptyText, level },
    type: "heading",
  }).find(({ key }) => key === "fontSize") as SettingsField;

describe("Heading Block", () => {
  it("stores rich text, a level, alignment, color and font size", () => {
    const { editor } = setup();
    const content = {
      content: [
        {
          content: [
            {
              marks: [{ attrs: { href: "{{url}}" }, type: "link" }],
              text: "Hello {{first_name}}",
              type: "text",
            },
          ],
          type: "paragraph",
        },
      ],
      type: "doc",
    };

    expect(
      editor.apply({
        blockId: "heading-1",
        props: {
          align: "center",
          color: "#ff0000",
          content,
          fontSize: 40,
          level: 3,
        },
        type: "updateBlockProps",
      })
    ).toStrictEqual({ ok: true });

    expect(propsOf(editor.getDocument())).toStrictEqual({
      align: "center",
      color: "#ff0000",
      content,
      fontSize: 40,
      level: 3,
    });
  });

  it.each([
    ["level 4", { level: 4 }, /level/u],
    ["no level", { level: null }, /level/u],
  ])("rejects %s", (_name, props, reason) => {
    const { editor } = setup();
    const before = editor.getDocument();

    const result = editor.apply({
      blockId: "heading-1",
      props,
      type: "updateBlockProps",
    });

    expect(result).toStrictEqual({
      ok: false,
      reason: expect.stringMatching(reason),
    });
    expect(editor.getDocument()).toStrictEqual(before);
  });

  it("refuses a saved email with no content", () => {
    expect(loadDocument(withHeading({ level: 1 }))).toStrictEqual({
      ok: false,
      reason: expect.stringContaining('Block "heading-1"'),
    });
  });

  it.each([
    [1, "32px"],
    [2, "24px"],
    [3, "20px"],
  ])("sizes level %i as %s until a font size is set", (level, fontSize) => {
    const props = { content: emptyText, level };

    expect(blockStyles({ props, type: "heading" })).toStrictEqual({
      color: "#000000",
      "font-size": fontSize,
      "font-weight": "700",
      "text-align": "left",
    });
    expect(`${fontSizeField(level).default}px`).toBe(fontSize);
  });
});
