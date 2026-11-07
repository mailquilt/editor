import { describe, expect, it } from "vitest";

import {
  blockSettingsFields,
  blockStyles,
  createEditor,
  createEmail,
  loadDocument,
} from "../src/index.js";
import type { BlocksDocument, SettingsField } from "../src/index.js";

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
  it("is added empty, at level 1", () => {
    const document = createEmail();
    const columnId = document.rows[0]?.columns[0]?.id as string;
    const editor = createEditor({ document });

    const result = editor.apply({
      blockType: "heading",
      columnId,
      index: 0,
      type: "insertBlock",
    });

    expect(result.ok).toBeTruthy();
    expect(propsOf(editor.getDocument())).toStrictEqual({
      content: emptyText,
      level: 1,
    });
  });

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
        type: "updateProps",
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
    ["level 0", { level: 0 }, /level/u],
    ["level 4", { level: 4 }, /level/u],
    ["a level written as text", { level: "1" }, /level/u],
    ["no level", { level: null }, /level/u],
    ["an unknown alignment", { align: "middle" }, /align/u],
    ["a color MJML can't read", { color: "red" }, /color/u],
    ["a fractional font size", { fontSize: 12.5 }, /fontSize/u],
    ["a font size past the limit", { fontSize: 201 }, /fontSize/u],
    ["a property it doesn't have", { href: "https://a.example" }, /href/u],
    [
      "a link with an executable scheme",
      {
        content: {
          content: [
            {
              content: [
                {
                  // oxlint-disable-next-line no-script-url -- What's being refused.
                  marks: [{ attrs: { href: "javascript:x" }, type: "link" }],
                  text: "Click",
                  type: "text",
                },
              ],
              type: "paragraph",
            },
          ],
          type: "doc",
        },
      },
      /href/u,
    ],
  ])("rejects %s", (_name, props, reason) => {
    const { editor } = setup();
    const before = editor.getDocument();

    const result = editor.apply({
      blockId: "heading-1",
      props,
      type: "updateProps",
    });

    expect(result).toStrictEqual({
      ok: false,
      reason: expect.stringMatching(reason),
    });
    expect(editor.getDocument()).toStrictEqual(before);
  });

  it("makes one undo step of a change to its level", () => {
    const { editor } = setup();

    editor.apply({
      blockId: "heading-1",
      props: { level: 2 },
      type: "updateProps",
    });
    editor.undo();

    expect(propsOf(editor.getDocument())).toStrictEqual({
      content: emptyText,
      level: 1,
    });
  });

  it("loads from a saved email", () => {
    const document = withHeading({
      align: "right",
      color: "#333333",
      content: emptyText,
      fontSize: 18,
      level: 2,
    });

    expect(loadDocument(document)).toStrictEqual({ document, ok: true });
  });

  it.each([
    ["no level", { content: emptyText }],
    ["no content", { level: 1 }],
    ["level 7", { content: emptyText, level: 7 }],
  ])("refuses a saved email with %s", (_name, props) => {
    expect(loadDocument(withHeading(props))).toStrictEqual({
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

  it("uses its own settings over its level's look", () => {
    expect(
      blockStyles({
        props: {
          align: "right",
          color: "#123456",
          content: emptyText,
          fontSize: 50,
          level: 3,
        },
        type: "heading",
      })
    ).toStrictEqual({
      color: "#123456",
      "font-size": "50px",
      "font-weight": "700",
      "text-align": "right",
    });
  });

  it("offers its level, alignment, color and font size as settings", () => {
    const fields = blockSettingsFields({
      props: { content: emptyText, level: 1 },
      type: "heading",
    });

    expect(fields.map(({ key }) => key)).toStrictEqual([
      "level",
      "align",
      "color",
      "fontSize",
    ]);
    expect(fields[0]).toMatchObject({
      options: [
        { label: "Heading 1", value: 1 },
        { label: "Heading 2", value: 2 },
        { label: "Heading 3", value: 3 },
      ],
      type: "select",
    });
  });
});
