import { describe, expect, it } from "vitest";

import { createEditor, createEmail, loadDocument } from "../src/index.js";
import type { BlocksDocument, RichTextDocument } from "../src/index.js";
import { blockSettingsFields, blockStyles } from "../src/internal.js";
import type { BlockProps, SettingsField } from "../src/internal.js";

const emptyText: RichTextDocument = {
  content: [{ type: "paragraph" }],
  type: "doc",
};

type Level = BlockProps["heading"]["level"];

const withHeading = (props: BlockProps["heading"]): BlocksDocument => {
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

const fontSizeField = (level: Level) =>
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
  ])("refuses %s", (_name, props, reason) => {
    const { editor } = setup();
    const before = editor.getDocument();

    const result = editor.apply({
      blockId: "heading-1",
      props,
      type: "updateBlockProps",
    });

    expect(result).toStrictEqual({
      code: "invalidProps",
      ok: false,
      reason: expect.stringMatching(reason),
    });
    expect(editor.getDocument()).toStrictEqual(before);
  });

  it("refuses a saved email with no content", () => {
    // Cast, as its props are wrong on purpose.
    const props = { level: 1 } as BlockProps["heading"];

    expect(loadDocument(withHeading(props))).toStrictEqual({
      ok: false,
      reason: expect.stringMatching(/blocks\.0\.props\.content: /u),
    });
  });

  it.each<[Level, string, string]>([
    [1, "32px", "48px"],
    [2, "24px", "36px"],
    [3, "20px", "30px"],
  ])(
    "sizes level %i as %s until a font size is set",
    (level, fontSize, lineHeight) => {
      const props = { content: emptyText, level };

      expect(blockStyles({ props, type: "heading" })).toStrictEqual({
        color: "#000000",
        "font-size": fontSize,
        "font-weight": "700",
        "line-height": lineHeight,
        "text-align": "left",
      });
      expect(`${fontSizeField(level).default}px`).toBe(fontSize);
    }
  );
});
