import { createEmail } from "@mailquilt/core";
import type { Row } from "@mailquilt/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usableSavedRows } from "../src/saved-rows.js";

const { version } = createEmail();

/** A footer of two Columns, as a Host app keeps one from an email it saved. */
const FOOTER: Row = {
  columns: [
    {
      blocks: [{ id: "b1", props: { height: 16 }, type: "spacer" }],
      id: "c1",
      props: {},
      width: 50,
    },
    { blocks: [], id: "c2", props: {}, width: 50 },
  ],
  id: "r1",
  props: { backgroundColor: "#f4efe6" },
};

describe(usableSavedRows, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps each Saved Row as a paste checks it, in the Host app's order", () => {
    const usable = usableSavedRows([
      { name: "Footer", row: FOOTER, version },
      // Version 3 has no Email style, and is migrated as a paste from it is.
      { name: "Older footer", row: FOOTER, version: 3 },
    ]);

    expect(usable).toStrictEqual([
      { name: "Footer", row: FOOTER },
      { name: "Older footer", row: FOOTER },
    ]);
  });

  it.each([
    ["a Row a paste refuses", { name: "Bad", row: { columns: [] }, version }],
    ["no version", { name: "Unversioned", row: FOOTER }],
    ["no name", { name: " ", row: FOOTER, version }],
    // From plain JavaScript, such as a lookup that found nothing.
    ["nothing at all", null],
    [
      "a Row JSON can't hold",
      { name: "BigInt", row: { ...FOOTER, id: 1n }, version },
    ],
  ])(
    "leaves out a Saved Row with %s, and says why on the console",
    (_name, saved) => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(usableSavedRows([saved as never])).toHaveLength(0);
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining("left out a Saved Row")
      );
    }
  );
});
