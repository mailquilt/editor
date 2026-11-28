import { createEditor, createEmail } from "@mailquilt/core";
import type { Row } from "@mailquilt/core";
import { describe, expect, it } from "vitest";

import { copyRowCommand } from "../src/editing-actions.js";

/** A Row with props of its own, Columns that aren't a layout's, and a Block in each. */
const ROW: Row = {
  columns: [
    {
      blocks: [{ id: "b1", props: { height: 16 }, type: "spacer" }],
      id: "c1",
      props: { backgroundColor: "#eeeeee" },
      width: 20,
    },
    {
      blocks: [{ id: "b2", props: { height: 24 }, type: "spacer" }],
      id: "c2",
      props: {},
      width: 30,
    },
    { blocks: [], id: "c3", props: {}, width: 50 },
  ],
  id: "r1",
  props: { backgroundColor: "#f4efe6" },
};

const copiedTwice = () => {
  const editor = createEditor({
    document: { ...createEmail(), rows: [ROW] },
  });
  for (const index of [1, 2]) {
    const command = copyRowCommand(ROW, index);
    expect(command).toBeDefined();
    if (command) {
      expect(editor.apply(command).ok).toBeTruthy();
    }
  }
  return editor.getDocument().rows;
};

describe(copyRowCommand, () => {
  it("copies a Row's props and its Columns', with even Columns where the widths aren't a layout's", () => {
    const [, copy] = copiedTwice();

    expect(copy?.props).toStrictEqual(ROW.props);
    expect(copy?.columns.map(({ props }) => props)).toStrictEqual(
      ROW.columns.map(({ props }) => props)
    );
    expect(copy?.columns.map(({ width }) => width)).toStrictEqual([
      33.33, 33.33, 33.34,
    ]);
    expect(
      copy?.columns.map(({ blocks }) => blocks.map(({ props }) => props))
    ).toStrictEqual([[{ height: 16 }], [{ height: 24 }], []]);
  });

  it("gives every copy new IDs", () => {
    const rows = copiedTwice();
    const ids = rows.flatMap((row) => [
      row.id,
      ...row.columns.flatMap(({ blocks, id }) => [
        id,
        ...blocks.map((block) => block.id),
      ]),
    ]);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no Command for a Row with more Columns than a layout has", () => {
    const wide: Row = {
      ...ROW,
      columns: ["a", "b", "c", "d", "e"].map((id) => ({
        blocks: [],
        id,
        props: {},
        width: 20,
      })),
    };

    expect(copyRowCommand(wide, 0)).toBeUndefined();
  });
});
