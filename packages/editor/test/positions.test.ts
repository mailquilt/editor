import { createEmail } from "@mailquilt/core";
import type { Block, BlocksDocument, Column } from "@mailquilt/core";
import { describe, expect, it } from "vitest";

import {
  blockPositionLabel,
  dropCommand,
  moveCommand,
  moveRowCommand,
  neighbourBlockId,
} from "../src/positions.js";

const block = (id: string): Block => ({
  id,
  props: { content: { content: [{ type: "paragraph" }], type: "doc" } },
  type: "text",
});

const column = (id: string, ...blockIds: string[]): Column => ({
  blocks: blockIds.map(block),
  id,
  props: {},
  width: 100,
});

/**
 * Row 1 has Blocks a and b on the left, an empty Column, and c on the right.
 * Row 2 has d and e on the left, and f and g on the right.
 */
const email: BlocksDocument = {
  ...createEmail(),
  rows: [
    {
      columns: [
        column("left", "a", "b"),
        column("middle"),
        column("right", "c"),
      ],
      id: "first",
      props: {},
    },
    {
      columns: [
        column("lower-left", "d", "e"),
        column("lower-right", "f", "g"),
      ],
      id: "second",
      props: {},
    },
  ],
};

describe("the Block an arrow key selects", () => {
  it("up and down go in reading order, from one Row into the next", () => {
    expect(neighbourBlockId(email, "c", "down")).toBe("d");
  });

  it("up from the first Block is none", () => {
    expect(neighbourBlockId(email, "a", "up")).toBeUndefined();
  });

  it("right goes past an empty Column, as close as it can to the same position", () => {
    expect(neighbourBlockId(email, "b", "right")).toBe("c");
  });

  it("right keeps the position in the next Column", () => {
    expect(neighbourBlockId(email, "e", "right")).toBe("g");
  });

  it("left goes back past an empty Column, to the same position", () => {
    expect(neighbourBlockId(email, "c", "left")).toBe("a");
  });

  it("left from the first Column is none", () => {
    expect(neighbourBlockId(email, "b", "left")).toBeUndefined();
  });

  it("from a Block that isn't in the email is none", () => {
    expect(neighbourBlockId(email, "gone", "left")).toBeUndefined();
  });
});

describe("the Command that moves a Block one step", () => {
  it("down within its Column, to the next position", () => {
    expect(moveCommand(email, "a", "down")).toStrictEqual({
      blockId: "a",
      columnId: "left",
      index: 1,
      type: "moveBlock",
    });
  });

  it("right, into an empty Column", () => {
    expect(moveCommand(email, "b", "right")).toStrictEqual({
      blockId: "b",
      columnId: "middle",
      index: 0,
      type: "moveBlock",
    });
  });

  it("left from the first Column is none", () => {
    expect(moveCommand(email, "a", "left")).toBeUndefined();
  });

  it("down past the end of its Column, to the start of the nearest Column in the next Row", () => {
    expect(moveCommand(email, "c", "down")).toStrictEqual({
      blockId: "c",
      columnId: "lower-right",
      index: 0,
      type: "moveBlock",
    });
  });

  it("up past the start of its Column, to the end of the same Column in the Row before", () => {
    expect(moveCommand(email, "d", "up")).toStrictEqual({
      blockId: "d",
      columnId: "left",
      index: 2,
      type: "moveBlock",
    });
  });

  it("up past the top of the email, to a Row of its own at the start", () => {
    expect(moveCommand(email, "a", "up")).toStrictEqual({
      blockId: "a",
      rowIndex: 0,
      type: "moveBlockToNewRow",
    });
  });

  it("down past the bottom of the email, to a Row of its own at the end", () => {
    expect(moveCommand(email, "g", "down")).toStrictEqual({
      blockId: "g",
      rowIndex: 2,
      type: "moveBlockToNewRow",
    });
  });

  it("for a Block that isn't in the email is none", () => {
    expect(moveCommand(email, "gone", "down")).toBeUndefined();
  });
});

describe("the Command that moves a Row one step", () => {
  it("down, to the next index", () => {
    expect(moveRowCommand(email, "first", "down")).toStrictEqual({
      index: 1,
      rowId: "first",
      type: "moveRow",
    });
  });

  it("up from the first Row, or down from the last, is none", () => {
    expect(moveRowCommand(email, "first", "up")).toBeUndefined();
    expect(moveRowCommand(email, "second", "down")).toBeUndefined();
  });

  it("for a Row that isn't in the email is none", () => {
    expect(moveRowCommand(email, "gone", "up")).toBeUndefined();
  });
});

describe("the Command for a drop", () => {
  it.each([
    [
      "a Row on the canvas, between Rows",
      { rowId: "first" },
      { rowIndex: 2 },
      { index: 2, rowId: "first", type: "moveRow" },
    ],
    [
      "a new Row, between Rows",
      { rowLayout: "50-50" },
      { rowIndex: 0 },
      { index: 0, layout: "50-50", type: "insertRow" },
    ],
    [
      "a Block on the canvas, in a Column",
      { blockId: "a" },
      { columnId: "right", index: 1 },
      { blockId: "a", columnId: "right", index: 1, type: "moveBlock" },
    ],
    [
      "a Block on the canvas, outside any Row",
      { blockId: "a" },
      { rowIndex: 2 },
      { blockId: "a", rowIndex: 2, type: "moveBlockToNewRow" },
    ],
    [
      "a new Block, in a Column",
      { blockType: "button" },
      { columnId: "middle", index: 0 },
      {
        blockType: "button",
        columnId: "middle",
        index: 0,
        type: "insertBlock",
      },
    ],
    [
      "a new Block, outside any Row",
      { blockType: "button" },
      { rowIndex: 0 },
      { blockType: "button", rowIndex: 0, type: "insertBlockInNewRow" },
    ],
  ] as const)("of %s", (_what, source, position, command) => {
    expect(dropCommand(source, position)).toStrictEqual(command);
  });
});

describe("where a Block is, in words", () => {
  it("names its Row, its Column, and its position there, counting from 1", () => {
    expect(blockPositionLabel(email, "b")).toBe(
      "Row 1, Column 1, position 2 of 2"
    );
  });

  it("is none for a Block that isn't in the email", () => {
    expect(blockPositionLabel(email, "gone")).toBeUndefined();
  });
});
