import { describe, expect, it } from "vitest";

import { createEditor, createEmail } from "../src/index.js";

const paragraph = (text: string) => ({
  content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
  type: "doc",
});

const firstBlock = (document: ReturnType<typeof createEmail>) => {
  const block = document.rows[0]?.columns[0]?.blocks[0];
  if (!block) {
    throw new Error("Expected an email with one Block");
  }
  return block;
};

describe(createEmail, () => {
  it("gives every Row, Column and Block its own ID in each email", () => {
    const ids = [createEmail(), createEmail()].flatMap((email) =>
      email.rows.flatMap((row) => [
        row.id,
        ...row.columns.flatMap((column) => [
          column.id,
          ...column.blocks.map((block) => block.id),
        ]),
      ])
    );

    expect(new Set(ids).size).toBe(6);
  });
});

describe("applying a Command", () => {
  it("changes a Text Block's text", () => {
    const document = createEmail();
    const editor = createEditor({ document });
    const blockId = firstBlock(document).id;

    const result = editor.apply({
      blockId,
      props: { content: paragraph("Hello {{first_name}}") },
      type: "updateBlockProps",
    });

    expect(result).toStrictEqual({ ok: true });
    expect(firstBlock(editor.getDocument()).props.content).toStrictEqual(
      paragraph("Hello {{first_name}}")
    );
  });

  it("keeps the editor's document safe from changes to a document it returned", () => {
    const document = createEmail();
    const editor = createEditor({ document });

    editor.getDocument().settings.width = 1;

    expect(editor.getDocument().settings.width).toBe(document.settings.width);
  });
});

describe("refusing a Command", () => {
  type Email = ReturnType<typeof createEmail>;
  const refused: [string, (email: Email) => unknown, string, RegExp][] = [
    [
      "an unknown Command type",
      () => ({ type: "explode" }),
      "invalidCommand",
      /invalid command/iu,
    ],
    [
      "a Block that doesn't exist",
      () => ({
        blockId: "missing",
        props: { content: paragraph("Hi") },
        type: "updateBlockProps",
      }),
      "noSuchBlock",
      /no block.*missing/iu,
    ],
    [
      "a Column that doesn't exist",
      () => ({
        blockType: "text",
        columnId: "missing",
        index: 0,
        type: "insertBlock",
      }),
      "noSuchColumn",
      /no column.*missing/iu,
    ],
    [
      "a Row that doesn't exist",
      () => ({ rowId: "missing", type: "removeRow" }),
      "noSuchRow",
      /no row.*missing/iu,
    ],
    [
      "a Block type that doesn't exist",
      (email) => ({
        blockType: "video",
        columnId: email.rows[0]?.columns[0]?.id,
        index: 0,
        type: "insertBlock",
      }),
      "unknownBlockType",
      /video/iu,
    ],
    [
      "an index past the end",
      () => ({ index: 5, layout: "100", type: "insertRow" }),
      "indexPastEnd",
      /past the end/iu,
    ],
    [
      "props that aren't an object",
      (email) => ({
        blockId: firstBlock(email).id,
        props: [],
        type: "updateBlockProps",
      }),
      "invalidCommand",
      /props/iu,
    ],
    [
      "a key the Block doesn't have, even one named like Object's own",
      (email) => ({
        blockId: firstBlock(email).id,
        props: JSON.parse('{"constructor":"x"}'),
        type: "updateBlockProps",
      }),
      "invalidProps",
      /constructor/iu,
    ],
  ];

  it.each(refused)(
    "refuses %s with a code and a reason",
    (_name, command, code, reason) => {
      const document = createEmail();
      const editor = createEditor({ document });

      expect(
        editor.apply(command(document) as Parameters<typeof editor.apply>[0])
      ).toStrictEqual({
        code,
        ok: false,
        reason: expect.stringMatching(reason),
      });
    }
  );
});
