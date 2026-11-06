import { describe, expect, it } from "vitest";

import type { Block, BlocksDocument } from "../src/index.js";
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
    ["a remove from", { ...remove, columnId: "missing" }],
    ["a move from", { ...move, from: { columnId: "missing", index: 0 } }],
    ["a move to", { ...move, to: { columnId: "missing", index: 0 } }],
  ] as [string, Operation][])(
    "throws for %s a missing Column",
    (_name, operation) => {
      expect(() => applied(operation)).toThrow(/missing/u);
    }
  );

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
] as [string, Operation][])("the %s Operation", (_name, operation) => {
  it("is undone by its reverse", () => {
    const document = applied(operation);

    applyOperation(document, reverseOperation(operation));

    expect(document).toStrictEqual(email());
  });

  it("survives a JSON round trip", () => {
    // oxlint-disable-next-line unicorn/prefer-structured-clone -- JSON is what hosts send Operations as, so this tests JSON itself.
    expect(JSON.parse(JSON.stringify(operation))).toStrictEqual(operation);
  });
});
