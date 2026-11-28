import { createEditor, createEmail } from "@mailquilt/core";
import type { BlocksDocument } from "@mailquilt/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { startFrom, usableStarters } from "../src/starter-emails.js";

/** An email with no Rows, as a Host app opens one to start from. */
const emptyEmail = (): BlocksDocument => ({
  ...createEmail(),
  rows: [],
  settings: {
    backgroundColor: "#ffffff",
    fontFamily: "Arial, Helvetica, sans-serif",
    preheader: "Left from before",
    width: 600,
  },
});

/** A Starter email of two Rows, the second of two Columns. */
const LETTER: BlocksDocument = {
  kind: "blocks",
  rows: [
    {
      columns: [
        {
          blocks: [{ id: "b1", props: { height: 32 }, type: "spacer" }],
          id: "c1",
          props: {},
          width: 100,
        },
      ],
      id: "r1",
      props: { backgroundColor: "#f4efe6" },
    },
    {
      columns: [
        {
          blocks: [{ id: "b2", props: { height: 8 }, type: "spacer" }],
          id: "c2",
          props: {},
          width: 50,
        },
        { blocks: [], id: "c3", props: {}, width: 50 },
      ],
      id: "r2",
      props: {},
    },
  ],
  settings: {
    backgroundColor: "#fbf7f1",
    fontFamily: "Georgia, serif",
    width: 640,
  },
  version: createEmail().version,
};

/** The email without its IDs, which a pick gives anew. */
const withoutIds = ({ rows, ...email }: BlocksDocument) => ({
  ...email,
  rows: rows.map(({ columns, props }) => ({
    columns: columns.map(({ blocks, props: columnProps, width }) => ({
      blocks: blocks.map(({ props: blockProps, type }) => ({
        props: blockProps,
        type,
      })),
      props: columnProps,
      width,
    })),
    props,
  })),
});

describe(startFrom, () => {
  it("makes the empty email the Starter email, in one undo step", () => {
    const editor = createEditor({ document: emptyEmail() });

    expect(startFrom(editor, LETTER)).toStrictEqual({ ok: true });
    expect(withoutIds(editor.getDocument())).toStrictEqual(withoutIds(LETTER));

    editor.undo();

    expect(editor.getDocument()).toStrictEqual(
      expect.objectContaining({ rows: [], settings: emptyEmail().settings })
    );
    expect(editor.canUndo()).toBeFalsy();
  });
});

describe(usableStarters, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps each Starter email as loadDocument checks it, in the Host app's order", () => {
    const older = { ...LETTER, version: 3 };

    const usable = usableStarters([
      { description: "Heading and text", email: LETTER, name: "Letter" },
      { email: older, name: "Older" },
    ]);

    expect(usable.map(({ name }) => name)).toStrictEqual(["Letter", "Older"]);
    expect(usable[0]).toStrictEqual({
      description: "Heading and text",
      email: LETTER,
      name: "Letter",
    });
    // Migrated, as a `value` of that version is.
    expect(usable[1]?.email.version).toBe(LETTER.version);
  });

  it.each([
    [
      "an email loadDocument refuses",
      { email: { kind: "blocks" }, name: "Bad" },
    ],
    ["no name", { email: LETTER, name: "" }],
    // From plain JavaScript, such as a lookup that found nothing.
    ["nothing at all", null],
    [
      "a description that isn't text",
      { description: { text: "Hero" }, email: LETTER, name: "Odd" },
    ],
    [
      "a pick core would refuse",
      {
        email: {
          ...LETTER,
          settings: { ...LETTER.settings, language: "English" },
        },
        name: "Loose language",
      },
    ],
  ])(
    "leaves out a Starter email with %s, and says so on the console",
    (_name, starter) => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(usableStarters([starter as never])).toHaveLength(0);
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining("left out a Starter email")
      );
    }
  );
});
