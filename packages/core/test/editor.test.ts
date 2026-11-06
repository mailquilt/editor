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
  it("creates a versioned blocks email", () => {
    expect(createEmail()).toMatchObject({ kind: "blocks", version: 1 });
  });

  it("creates one full-width Column in one Row", () => {
    const email = createEmail();

    expect(email.rows).toHaveLength(1);
    expect(email.rows[0]?.columns).toHaveLength(1);
    expect(email.rows[0]?.columns[0]?.width).toBe(100);
  });

  it("creates one empty Text Block stored as limited rich text", () => {
    expect(firstBlock(createEmail())).toMatchObject({
      props: { content: { content: [{ type: "paragraph" }], type: "doc" } },
      type: "text",
    });
  });

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

  it("creates an email that survives a JSON round trip", () => {
    const email = createEmail();

    // oxlint-disable-next-line unicorn/prefer-structured-clone -- JSON is the saved format, so this tests JSON itself.
    expect(JSON.parse(JSON.stringify(email))).toStrictEqual(email);
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
      type: "updateProps",
    });

    expect(result).toStrictEqual({ ok: true });
    expect(firstBlock(editor.getDocument()).props.content).toStrictEqual(
      paragraph("Hello {{first_name}}")
    );
  });

  it("does not change the document passed to createEditor", () => {
    const document = createEmail();
    const before = structuredClone(document);
    const editor = createEditor({ document });

    editor.apply({
      blockId: firstBlock(document).id,
      props: { content: paragraph("Changed") },
      type: "updateProps",
    });

    expect(document).toStrictEqual(before);
  });

  it("keeps the editor's document safe from changes to a document it returned", () => {
    const document = createEmail();
    const editor = createEditor({ document });

    editor.getDocument().settings.width = 1;

    expect(editor.getDocument().settings.width).toBe(document.settings.width);
  });
});

describe("rejecting a Command", () => {
  const rejected: [string, (blockId: string) => unknown, RegExp][] = [
    [
      "an unknown Command type",
      () => ({ type: "explode" }),
      /invalid command/iu,
    ],
    [
      "a Command that isn't an object",
      () => "updateProps",
      /invalid command/iu,
    ],
    [
      "a Block that doesn't exist",
      () => ({
        blockId: "missing",
        props: { content: paragraph("Hi") },
        type: "updateProps",
      }),
      /no block.*missing/iu,
    ],
    [
      "props that aren't an object",
      (blockId) => ({ blockId, props: "Hi", type: "updateProps" }),
      /props/iu,
    ],
    [
      "a property the Text Block doesn't have",
      (blockId) => ({ blockId, props: { colour: "red" }, type: "updateProps" }),
      /colour/iu,
    ],
    [
      "text that isn't limited rich text",
      (blockId) => ({
        blockId,
        props: { content: "<p>Hello</p>" },
        type: "updateProps",
      }),
      /content/iu,
    ],
    [
      "a node outside limited rich text",
      (blockId) => ({
        blockId,
        props: {
          content: {
            content: [{ attrs: { level: 1 }, type: "heading" }],
            type: "doc",
          },
        },
        type: "updateProps",
      }),
      /content/iu,
    ],
  ];

  it.each(rejected)(
    "rejects %s with a reason and leaves the document unchanged",
    (_name, command, reason) => {
      const document = createEmail();
      const editor = createEditor({ document });

      const result = editor.apply(
        command(firstBlock(document).id) as Parameters<typeof editor.apply>[0]
      );

      expect(result).toStrictEqual({
        ok: false,
        reason: expect.stringMatching(reason),
      });
      expect(editor.getDocument()).toStrictEqual(document);
    }
  );
});
