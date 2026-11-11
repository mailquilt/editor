import { describe, expect, it } from "vitest";

import type { Block, BlocksDocument, Column, Row } from "../src/index.js";
import { applyOperation, reverseOperation } from "../src/operations.js";
import type { Operation } from "../src/operations.js";

const block = (id: string): Block => ({ id, props: {}, type: "text" });

const email = (): BlocksDocument => ({
  kind: "blocks",
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
  settings: {
    backgroundColor: "#ffffff",
    fontFamily: "Arial",
    width: 600,
  },
  version: 1,
});

const rowIds = (document: BlocksDocument) => document.rows.map(({ id }) => id);

const columnIds = (document: BlocksDocument) =>
  document.rows[0]?.columns.map(({ id }) => id);

const blockIds = (document: BlocksDocument) =>
  document.rows[0]?.columns.map((column) => column.blocks.map(({ id }) => id));

const applied = (operation: Operation) => {
  const document = email();
  applyOperation(document, operation);
  return document;
};

const insert: Operation = {
  block: block("new"),
  columnId: "left",
  index: 1,
  type: "insert",
};

const remove: Operation = {
  block: block("b"),
  columnId: "left",
  index: 1,
  type: "remove",
};

const move: Operation = {
  blockId: "a",
  from: { columnId: "left", index: 0 },
  to: { columnId: "right", index: 1 },
  type: "move",
};

const setProps: Operation = {
  blockId: "c",
  previousProps: {},
  props: { content: "new" },
  type: "setProps",
};

const newRow = { columns: [], id: "new-row", props: {} };

const insertRow: Operation = { index: 0, row: newRow, type: "insert" };

const removeRow: Operation = {
  index: 0,
  row: email().rows[0] as Row,
  type: "remove",
};

const twoRows = () => {
  const document = email();
  document.rows.push({ columns: [], id: "second-row", props: {} });
  return document;
};

const moveRow: Operation = {
  from: { index: 0 },
  rowId: "row",
  to: { index: 1 },
  type: "move",
};

const newColumn = { blocks: [], id: "middle", props: {}, width: 20 };

const insertColumn: Operation = {
  column: newColumn,
  index: 1,
  rowId: "row",
  type: "insert",
};

const removeColumn: Operation = {
  column: email().rows[0]?.columns[1] as Column,
  index: 1,
  rowId: "row",
  type: "remove",
};

const setColumnWidth: Operation = {
  columnId: "left",
  previousWidth: 50,
  type: "setColumnWidth",
  width: 75,
};

describe("applying an Operation", () => {
  it("inserts a Block at an index in a Column", () => {
    expect(blockIds(applied(insert))).toStrictEqual([["a", "new", "b"], ["c"]]);
  });

  it("removes a Block from a Column", () => {
    expect(blockIds(applied(remove))).toStrictEqual([["a"], ["c"]]);
  });

  it("moves a Block to another Column", () => {
    expect(blockIds(applied(move))).toStrictEqual([["b"], ["c", "a"]]);
  });

  it("moves a Block within a Column", () => {
    const within: Operation = {
      blockId: "a",
      from: { columnId: "left", index: 0 },
      to: { columnId: "left", index: 1 },
      type: "move",
    };

    expect(blockIds(applied(within))).toStrictEqual([["b", "a"], ["c"]]);
  });

  it("sets a Block's properties", () => {
    const changed = applied(setProps).rows[0]?.columns[1]?.blocks[0];

    expect(changed?.props).toStrictEqual({ content: "new" });
  });

  it("inserts a Row at an index", () => {
    expect(rowIds(applied(insertRow))).toStrictEqual(["new-row", "row"]);
  });

  it("removes a Row with everything in it", () => {
    expect(applied(removeRow).rows).toStrictEqual([]);
  });

  it("moves a Row, with everything in it", () => {
    const document = twoRows();
    const [row] = document.rows;

    applyOperation(document, moveRow);

    expect(rowIds(document)).toStrictEqual(["second-row", "row"]);
    expect(document.rows[1]).toBe(row);
  });

  it("throws for a move of a Row that isn't at its index", () => {
    expect(() =>
      applyOperation(twoRows(), { ...moveRow, rowId: "second-row" })
    ).toThrow(/second-row.*index 0/u);
  });

  it("inserts a Column at an index in a Row", () => {
    expect(columnIds(applied(insertColumn))).toStrictEqual([
      "left",
      "middle",
      "right",
    ]);
  });

  it("removes a Column from a Row", () => {
    expect(columnIds(applied(removeColumn))).toStrictEqual(["left"]);
  });

  it("sets a Column's width", () => {
    expect(applied(setColumnWidth).rows[0]?.columns[0]?.width).toBe(75);
  });

  it("keeps an inserted Row separate from the Operation", () => {
    const row: Row = {
      columns: [{ blocks: [], id: "inside", props: {}, width: 100 }],
      id: "new-row",
      props: {},
    };
    const document = email();
    applyOperation(document, { index: 0, row, type: "insert" });

    applyOperation(document, {
      block: block("new"),
      columnId: "inside",
      index: 0,
      type: "insert",
    });

    expect(row.columns[0]?.blocks).toStrictEqual([]);
  });

  it("keeps an inserted Block separate from the Operation", () => {
    const document = applied(insert);

    applyOperation(document, {
      blockId: "new",
      previousProps: {},
      props: { content: "changed" },
      type: "setProps",
    });

    expect(insert.type === "insert" && insert.block.props).toStrictEqual({});
  });

  it.each([
    ["an insert into", { ...insert, columnId: "missing" }],
    ["a move from", { ...move, from: { columnId: "missing", index: 0 } }],
    ["a move to", { ...move, to: { columnId: "missing", index: 0 } }],
    ["a width on", { ...setColumnWidth, columnId: "missing" }],
  ] as [string, Operation][])(
    "throws for %s a missing Column",
    (_name, operation) => {
      expect(() => applied(operation)).toThrow(/missing/u);
    }
  );

  it("throws for an insert into a missing Row", () => {
    expect(() =>
      applied({ ...insertColumn, rowId: "missing" } as Operation)
    ).toThrow(/missing/u);
  });

  it("throws for a move of a Block that isn't there", () => {
    expect(() =>
      applied({ ...move, from: { columnId: "left", index: 5 } } as Operation)
    ).toThrow(/index 5/u);
  });

  it("throws for a set properties on a missing Block", () => {
    expect(() =>
      applied({ ...setProps, blockId: "missing" } as Operation)
    ).toThrow(/missing/u);
  });
});

describe.each([
  ["insert", insert],
  ["remove", remove],
  ["move", move],
  ["set properties", setProps],
  ["insert Row", insertRow],
  ["remove Row", removeRow],
  ["insert Column", insertColumn],
  ["remove Column", removeColumn],
  ["set Column width", setColumnWidth],
  ["move Row", moveRow],
] as [string, Operation][])("the %s Operation", (_name, operation) => {
  it("is undone by its reverse", () => {
    const document = twoRows();
    applyOperation(document, operation);

    applyOperation(document, reverseOperation(operation));

    expect(document).toStrictEqual(twoRows());
  });
});
