import { describe, expect, it } from "vitest";

import {
  BLOCK_TYPES,
  createEditor,
  createEmail,
  loadDocument,
} from "../src/index.js";
import type { BlocksDocument, Command, Operation } from "../src/index.js";
import { rowLayoutOf } from "../src/internal.js";

const block = (id: string) => ({
  id,
  props: { content: { content: [{ type: "paragraph" }], type: "doc" } },
  type: "text",
});

const twoColumnEmail = (): BlocksDocument => ({
  ...createEmail(),
  rows: [
    {
      columns: [
        { blocks: [block("a"), block("b")], id: "left", props: {}, width: 50 },
        { blocks: [block("c")], id: "right", props: {}, width: 50 },
      ],
      id: "row",
      props: {},
    },
  ],
});

const setup = (document = twoColumnEmail()) => {
  const editor = createEditor({ document });
  const operations: Operation[][] = [];
  editor.subscribe((changed) => operations.push(changed));
  return { document, editor, operations };
};

/** A loose type, because these tests send what the real type forbids. */
const send = (editor: ReturnType<typeof createEditor>, command: unknown) =>
  editor.apply(command as Command);

const columnsOf = (document: BlocksDocument) =>
  document.rows.map((row) =>
    row.columns.map((column) => column.blocks.map(({ id }) => id))
  );

const expectAccepted = (result: ReturnType<typeof send>) => {
  expect(result).toMatchObject({ ok: true });
};

/** Every accepted Command must leave an email that loads and can be saved. */
const expectValid = (document: BlocksDocument) => {
  expect(loadDocument(document)).toMatchObject({ ok: true });
};

/** The document after an undo and then a redo of the last Command. */
const undoThenRedo = (editor: ReturnType<typeof createEditor>) => {
  const changed = editor.getDocument();
  editor.undo();
  const undone = editor.getDocument();
  editor.redo();
  return { changed, redone: editor.getDocument(), undone };
};

const widthsOf = (document: BlocksDocument) =>
  document.rows[0]?.columns.map(({ width }) => width);

describe("the insertBlock Command", () => {
  it("adds an empty Text Block at an index in a Column", () => {
    const { editor } = setup();

    const result = send(editor, {
      blockType: "text",
      columnId: "left",
      index: 1,
      type: "insertBlock",
    });

    expectAccepted(result);
    const added = editor.getDocument().rows[0]?.columns[0]?.blocks[1];
    expect(added).toMatchObject({
      props: { content: { content: [{ type: "paragraph" }], type: "doc" } },
      type: "text",
    });
    expect(columnsOf(editor.getDocument())).toStrictEqual([
      [["a", added?.id, "b"], ["c"]],
    ]);
    expectValid(editor.getDocument());
  });

  // A default the schema refuses would make emails that can't be opened again.
  it.each(BLOCK_TYPES.map(({ type }) => type))(
    "adds a %s Block with defaults that load",
    (blockType) => {
      const { editor } = setup();

      expectAccepted(
        send(editor, {
          blockType,
          columnId: "left",
          index: 0,
          type: "insertBlock",
        })
      );

      expect(loadDocument(editor.getDocument())).toMatchObject({ ok: true });
    }
  );

  it("records one insert Operation", () => {
    const { editor, operations } = setup();

    send(editor, {
      blockType: "text",
      columnId: "right",
      index: 1,
      type: "insertBlock",
    });

    expect(operations).toStrictEqual([
      [
        {
          at: { columnId: "right", index: 1 },
          block: editor.getDocument().rows[0]?.columns[1]?.blocks[1],
          type: "insert",
        },
      ],
    ]);
  });
});

const threeRowEmail = (): BlocksDocument => ({
  ...createEmail(),
  rows: ["first", "second", "third"].map((id) => ({
    columns: [
      {
        blocks: [block(`${id}-block`)],
        id: `${id}-column`,
        props: {},
        width: 100,
      },
    ],
    id,
    props: { backgroundColor: `#${id.length}${id.length}0000` },
  })),
});

describe("the removeBlock Command", () => {
  it("removes the Block", () => {
    const { editor } = setup();

    expectAccepted(send(editor, { blockId: "a", type: "removeBlock" }));

    expect(columnsOf(editor.getDocument())).toStrictEqual([[["b"], ["c"]]]);
  });

  it("leaves an empty Column in place, with its width", () => {
    const { editor } = setup();

    send(editor, { blockId: "c", type: "removeBlock" });

    expect(editor.getDocument().rows[0]?.columns[1]).toMatchObject({
      blocks: [],
      id: "right",
      width: 50,
    });
    expectValid(editor.getDocument());
  });

  it("brings back the Block's latest text on undo", () => {
    const { editor } = setup();
    const content = {
      content: [
        { content: [{ text: "Typed", type: "text" }], type: "paragraph" },
      ],
      type: "doc",
    };
    send(editor, {
      blockId: "a",
      props: { content },
      type: "updateBlockProps",
    });

    send(editor, { blockId: "a", type: "removeBlock" });
    editor.undo();

    expect(
      editor.getDocument().rows[0]?.columns[0]?.blocks[0]?.props
    ).toStrictEqual({ content });
  });
});

const move = (blockId: string, columnId: string, index: number): Command => ({
  blockId,
  columnId,
  index,
  type: "moveBlock",
});

describe("the moveBlock Command", () => {
  it("moves a Block later in its Column, counting the index once it has left", () => {
    const { editor, operations } = setup();

    expectAccepted(editor.apply(move("a", "left", 1)));

    expect(columnsOf(editor.getDocument())).toStrictEqual([
      [["b", "a"], ["c"]],
    ]);
    expect(operations).toStrictEqual([
      [
        {
          blockId: "a",
          from: { columnId: "left", index: 0 },
          to: { columnId: "left", index: 1 },
          type: "move",
        },
      ],
    ]);
    expectValid(editor.getDocument());
  });

  it("moves a Block to the end of another Column", () => {
    const { editor } = setup();

    expectAccepted(editor.apply(move("a", "right", 1)));

    expect(columnsOf(editor.getDocument())).toStrictEqual([
      [["b"], ["c", "a"]],
    ]);
  });

  it.each([
    ["an unknown Block", move("nope", "right", 0), /No Block/u],
    ["an unknown Column", move("a", "nope", 0), /No Column/u],
    ["an index past the end", move("a", "right", 2), /past the end/u],
    [
      "an index past the end of its own Column",
      move("a", "left", 2),
      /past the end/u,
    ],
  ])("rejects %s with a reason", (_name, command, reason) => {
    const { editor } = setup();

    expect(editor.apply(command)).toStrictEqual({
      code: expect.any(String),
      ok: false,
      reason: expect.stringMatching(reason),
    });
  });
});

describe("the Commands that add a Row for a Block", () => {
  it("moves a Block to a new single-Column Row", () => {
    const { editor, operations } = setup();

    expectAccepted(
      editor.apply({ blockId: "b", rowIndex: 1, type: "moveBlockToNewRow" })
    );

    const document = editor.getDocument();
    expect(columnsOf(document)).toStrictEqual([[["a"], ["c"]], [["b"]]]);
    expect(
      widthsOf({ ...document, rows: document.rows.slice(1) })
    ).toStrictEqual([100]);
    expect(operations).toHaveLength(1);
    expect(operations[0]?.map(({ type }) => type)).toStrictEqual([
      "insert",
      "move",
    ]);
    expectValid(document);
  });

  it("adds a Block in a new single-Column Row, reporting the Block's ID", () => {
    const { editor } = setup();

    const result = editor.apply({
      blockType: "text",
      rowIndex: 0,
      type: "insertBlockInNewRow",
    });

    const document = editor.getDocument();
    expect(result).toStrictEqual({
      createdId: document.rows[0]?.columns[0]?.blocks[0]?.id,
      ok: true,
    });
    expect(document.rows).toHaveLength(2);
    expectValid(document);
  });

  it("adds the first Row and Block to an email with none", () => {
    const { editor } = setup({ ...createEmail(), rows: [] });

    expectAccepted(
      editor.apply({
        blockType: "text",
        rowIndex: 0,
        type: "insertBlockInNewRow",
      })
    );

    expect(editor.getDocument().rows).toHaveLength(1);
  });

  it("is one undo step that undo and redo reverse exactly", () => {
    const { editor } = setup();

    expectAccepted(
      editor.apply({ blockId: "b", rowIndex: 0, type: "moveBlockToNewRow" })
    );

    const { changed, redone, undone } = undoThenRedo(editor);
    expect(columnsOf(undone)).toStrictEqual([[["a", "b"], ["c"]]]);
    expect(redone).toStrictEqual(changed);
  });

  it.each([
    [
      "an unknown Block",
      { blockId: "nope", rowIndex: 0, type: "moveBlockToNewRow" },
      /No Block/u,
    ],
    [
      "an unknown Block type",
      { blockType: "nope", rowIndex: 0, type: "insertBlockInNewRow" },
      /Unknown Block type/u,
    ],
    [
      "a Row index past the end",
      { blockId: "a", rowIndex: 2, type: "moveBlockToNewRow" },
      /past the end/u,
    ],
  ])("rejects %s, adding no Row", (_name, command, reason) => {
    const { editor, operations } = setup();
    const before = editor.getDocument();

    const result = send(editor, command);

    expect(result).toHaveProperty("reason", expect.stringMatching(reason));
    expect(editor.getDocument()).toStrictEqual(before);
    expect(operations).toStrictEqual([]);
    expect(editor.undo()).toBeFalsy();
  });
});

describe("a Command for what's already so", () => {
  it("says so, unlike a Command that can't be done", () => {
    const { editor } = setup();

    expect(editor.apply(move("a", "left", 0))).toMatchObject({
      code: "unchanged",
      ok: false,
      unchanged: true,
    });
    expect(editor.apply(move("a", "nope", 0))).not.toHaveProperty("unchanged");
  });

  it("says a Block alone in its Row already has a Row of its own", () => {
    const { editor, operations } = setup({
      ...createEmail(),
      rows: [
        {
          columns: [{ blocks: [block("a")], id: "c", props: {}, width: 100 }],
          id: "row",
          props: {},
        },
      ],
    });

    for (const rowIndex of [0, 1]) {
      expect(
        editor.apply({ blockId: "a", rowIndex, type: "moveBlockToNewRow" })
      ).toMatchObject({ ok: false, unchanged: true });
    }
    expect(operations).toStrictEqual([]);
  });

  // Empty Rows are kept, as a person can fill them again.
  it("moves a Block alone in its Row further away, leaving that Row empty", () => {
    const { editor } = setup(threeRowEmail());

    expectAccepted(
      editor.apply({
        blockId: "first-block",
        rowIndex: 3,
        type: "moveBlockToNewRow",
      })
    );

    expect(columnsOf(editor.getDocument())).toStrictEqual([
      [[]],
      [["second-block"]],
      [["third-block"]],
      [["first-block"]],
    ]);
    expectValid(editor.getDocument());
  });

  it("moves a Block alone in its Column when its Row has other Columns", () => {
    const { editor } = setup({
      ...createEmail(),
      rows: [
        {
          columns: [
            { blocks: [block("a")], id: "left", props: {}, width: 50 },
            { blocks: [block("c")], id: "right", props: {}, width: 50 },
          ],
          id: "row",
          props: {},
        },
      ],
    });

    expectAccepted(
      editor.apply({ blockId: "a", rowIndex: 0, type: "moveBlockToNewRow" })
    );

    expect(columnsOf(editor.getDocument())).toStrictEqual([
      [["a"]],
      [[], ["c"]],
    ]);
  });

  it("says a Row already has the layout it's asked for", () => {
    const { editor, operations } = setup();

    expect(
      editor.apply({ layout: "50/50", rowId: "row", type: "setRowLayout" })
    ).toMatchObject({ ok: false, unchanged: true });
    expect(operations).toStrictEqual([]);
  });
});

describe("rejecting a Block Command", () => {
  const rejected: [string, unknown, RegExp][] = [
    [
      "a Block type that doesn't exist",
      {
        blockType: "hologram",
        columnId: "left",
        index: 0,
        type: "insertBlock",
      },
      /hologram/u,
    ],
    [
      "a Column that doesn't exist",
      { blockType: "text", columnId: "missing", index: 0, type: "insertBlock" },
      /no column.*missing/iu,
    ],
    [
      "an index past the end of the Column",
      { blockType: "text", columnId: "left", index: 3, type: "insertBlock" },
      /index 3/iu,
    ],
    [
      "a negative index",
      { blockType: "text", columnId: "left", index: -1, type: "insertBlock" },
      /index/u,
    ],
    [
      "removing a Block that doesn't exist",
      { blockId: "missing", type: "removeBlock" },
      /no block.*missing/iu,
    ],
  ];

  it.each(rejected)("rejects %s with a reason", (_name, command, reason) => {
    const { editor } = setup();

    expect(send(editor, command)).toStrictEqual({
      code: expect.any(String),
      ok: false,
      reason: expect.stringMatching(reason),
    });
  });
});

describe("the insertRow Command", () => {
  it("adds a Row at an index, with one empty Column per preset width", () => {
    const { editor } = setup();

    const result = send(editor, {
      index: 0,
      layout: "33/67",
      type: "insertRow",
    });

    const [added, existing] = editor.getDocument().rows;
    expect(result).toStrictEqual({ createdId: added?.id, ok: true });
    expect(existing?.id).toBe("row");
    expect(added?.columns.map(({ width }) => width)).toStrictEqual([33, 67]);
    expect(added?.columns.map(({ blocks }) => blocks)).toStrictEqual([[], []]);
    expectValid(editor.getDocument());
  });
});

describe("the removeRow Command", () => {
  it("removes the Row with its Columns and Blocks", () => {
    const { editor } = setup();

    expectAccepted(send(editor, { rowId: "row", type: "removeRow" }));

    expect(editor.getDocument().rows).toStrictEqual([]);
    expectValid(editor.getDocument());
  });

  it("brings back the Row's latest content on undo", () => {
    const { editor } = setup();
    send(editor, {
      blockId: "c",
      props: { align: "center" },
      type: "updateBlockProps",
    });
    const changed = editor.getDocument();

    send(editor, { rowId: "row", type: "removeRow" });
    editor.undo();

    expect(editor.getDocument()).toStrictEqual(changed);
  });
});

describe("the setRowLayout Command", () => {
  // Thirds can't each be a whole share, so they're the layout that can go wrong.
  it("gives three Columns widths that add up to the whole Row", () => {
    const { editor } = setup();

    send(editor, { layout: "33/33/33", rowId: "row", type: "setRowLayout" });

    expect(widthsOf(editor.getDocument())).toHaveLength(3);
    expectValid(editor.getDocument());
  });

  it("keeps Blocks where they are when only the widths change", () => {
    const { editor } = setup();

    send(editor, { layout: "33/67", rowId: "row", type: "setRowLayout" });

    expect(columnsOf(editor.getDocument())).toStrictEqual([
      [["a", "b"], ["c"]],
    ]);
  });

  it("adds empty Columns after the existing ones", () => {
    const { editor } = setup();

    send(editor, { layout: "25/25/25/25", rowId: "row", type: "setRowLayout" });

    expect(columnsOf(editor.getDocument())).toStrictEqual([
      [["a", "b"], ["c"], [], []],
    ]);
    expect(editor.getDocument().rows[0]?.columns[0]?.id).toBe("left");
    expect(editor.getDocument().rows[0]?.columns[1]?.id).toBe("right");
  });

  it("moves Blocks from removed Columns into the last remaining one", () => {
    const { editor } = setup();

    send(editor, { layout: "100", rowId: "row", type: "setRowLayout" });

    expect(columnsOf(editor.getDocument())).toStrictEqual([[["a", "b", "c"]]]);
    expect(editor.getDocument().rows[0]?.columns[0]?.id).toBe("left");
  });

  it("keeps the order of Blocks from several removed Columns", () => {
    const { editor } = setup();
    send(editor, { layout: "25/25/25/25", rowId: "row", type: "setRowLayout" });
    const [third, fourth] = (editor.getDocument().rows[0]?.columns ?? []).slice(
      2
    );
    const insertInto = (columnId?: string) =>
      send(editor, {
        blockType: "text",
        columnId,
        index: 0,
        type: "insertBlock",
      });
    const thirdResult = insertInto(third?.id);
    const fourthResult = insertInto(fourth?.id);

    send(editor, { layout: "50/50", rowId: "row", type: "setRowLayout" });

    expect(columnsOf(editor.getDocument())).toStrictEqual([
      [
        ["a", "b"],
        [
          "c",
          thirdResult.ok && thirdResult.createdId,
          fourthResult.ok && fourthResult.createdId,
        ],
      ],
    ]);
    expectValid(editor.getDocument());
  });

  it("uses move Operations, so Blocks aren't deleted and created again", () => {
    const { editor, operations } = setup();

    send(editor, { layout: "100", rowId: "row", type: "setRowLayout" });

    expect(operations[0]).toStrictEqual([
      {
        blockId: "c",
        from: { columnId: "right", index: 0 },
        to: { columnId: "left", index: 2 },
        type: "move",
      },
      {
        at: { index: 1, rowId: "row" },
        column: { blocks: [], id: "right", props: {}, width: 50 },
        type: "remove",
      },
      {
        columnId: "left",
        previousWidth: 50,
        type: "setColumnWidth",
        width: 100,
      },
    ]);
  });

  it.each(["100", "33/33/33", "67/33"])(
    "is one undo step when changing to %s, restoring every Block's place",
    (layout) => {
      const { document, editor } = setup();

      send(editor, { layout, rowId: "row", type: "setRowLayout" });

      const { changed, redone, undone } = undoThenRedo(editor);

      expect(undone).toStrictEqual(document);
      expect(redone).toStrictEqual(changed);
    }
  );

  it("restores several removed Columns in order on undo", () => {
    const { editor } = setup();
    send(editor, { layout: "25/25/25/25", rowId: "row", type: "setRowLayout" });
    const third = editor.getDocument().rows[0]?.columns[2];
    send(editor, {
      blockType: "text",
      columnId: third?.id,
      index: 0,
      type: "insertBlock",
    });
    const before = editor.getDocument();

    send(editor, { layout: "100", rowId: "row", type: "setRowLayout" });

    const { changed, redone, undone } = undoThenRedo(editor);

    expect(undone).toStrictEqual(before);
    expect(redone).toStrictEqual(changed);
  });
});

describe(rowLayoutOf, () => {
  it("names a Row's preset", () => {
    const [row] = twoColumnEmail().rows;

    expect(row && rowLayoutOf(row)).toBe("50/50");
  });

  it("names no preset for other widths a saved email may have", () => {
    const [row] = twoColumnEmail().rows;
    if (row?.columns[0] && row.columns[1]) {
      row.columns[0].width = 40;
      row.columns[1].width = 60;
    }

    expect(row && rowLayoutOf(row)).toBeUndefined();
  });
});

describe("rejecting a Row Command", () => {
  const rejected: [string, unknown, RegExp][] = [
    [
      "an unknown layout",
      { layout: "60/40", rowId: "row", type: "setRowLayout" },
      /layout/u,
    ],
    [
      "a layout for a Row that doesn't exist",
      { layout: "100", rowId: "missing", type: "setRowLayout" },
      /no row.*missing/iu,
    ],
    [
      "a new Row past the end of the email",
      { index: 2, layout: "100", type: "insertRow" },
      /index 2/iu,
    ],
    [
      "removing a Row that doesn't exist",
      { rowId: "missing", type: "removeRow" },
      /no row.*missing/iu,
    ],
  ];

  it.each(rejected)("rejects %s with a reason", (_name, command, reason) => {
    const { editor } = setup();

    expect(send(editor, command)).toStrictEqual({
      code: expect.any(String),
      ok: false,
      reason: expect.stringMatching(reason),
    });
  });
});

const rowOrder = (document: BlocksDocument) =>
  document.rows.map(({ id }) => id);

const moveRow = (rowId: string, index: number): Command => ({
  index,
  rowId,
  type: "moveRow",
});

describe("the moveRow Command", () => {
  it("moves a Row later, counting the index once it has left", () => {
    const { editor } = setup(threeRowEmail());

    expectAccepted(editor.apply(moveRow("first", 1)));

    expect(rowOrder(editor.getDocument())).toStrictEqual([
      "second",
      "first",
      "third",
    ]);
    expectValid(editor.getDocument());
  });

  it("records one move Operation, not a remove and an insert", () => {
    const { editor, operations } = setup(threeRowEmail());

    editor.apply(moveRow("first", 2));

    expect(operations).toStrictEqual([
      [
        {
          from: { index: 0 },
          rowId: "first",
          to: { index: 2 },
          type: "move",
        },
      ],
    ]);
  });

  it.each([
    ["an unknown Row", moveRow("nope", 0), /No Row.*nope/u],
    [
      "an index past the end, counted once the Row has left",
      moveRow("first", 3),
      /index 3.*past the end.*2 other Rows/iu,
    ],
  ])("rejects %s with a reason", (_name, command, reason) => {
    const { editor } = setup(threeRowEmail());

    expect(editor.apply(command)).toStrictEqual({
      code: expect.any(String),
      ok: false,
      reason: expect.stringMatching(reason),
    });
  });

  it("says a Row is already where it's asked to go", () => {
    const { editor, operations } = setup(threeRowEmail());

    expect(editor.apply(moveRow("second", 1))).toMatchObject({
      ok: false,
      unchanged: true,
    });
    expect(operations).toStrictEqual([]);
  });
});
