import { BLOCK_TYPES } from "@mailquilt/core";
import type { BlockType } from "@mailquilt/core";
import {
  blockBoxFields,
  blockSettingsFields,
  COLUMN_SETTINGS_FIELDS,
  EMAIL_SETTINGS_FIELDS,
  rowSettingsFields,
} from "@mailquilt/core/internal";
import type { SettingsField } from "@mailquilt/core/internal";
import { afterEach, describe, expect, it, vi } from "vitest";

import { STRINGS } from "../src/strings.js";
import type { MailQuiltStrings } from "../src/strings.js";
import { createText, fill } from "../src/text.js";

describe(fill, () => {
  it("fills each placeholder it's given, wherever it is", () => {
    expect(
      fill("{name} moved to position {position} of {count}.", {
        count: 3,
        name: "Facebook",
        position: 2,
      })
    ).toBe("Facebook moved to position 2 of 3.");
  });

  it("leaves a placeholder it isn't given as written", () => {
    expect(fill("Row {row}, Column {column}", { row: 1 })).toBe(
      "Row 1, Column {column}"
    );
  });

  // So the Merge Tag examples in help text stay as they are.
  it("leaves a Merge Tag alone, even with a value of the same name", () => {
    expect(
      fill("A Merge Tag such as {{cta_url}}, at {cta_url}", { cta_url: "x" })
    ).toBe("A Merge Tag such as {{cta_url}}, at x");
  });

  // A file's name or a URL can hold braces of its own.
  it("doesn't fill placeholders inside a value it filled in", () => {
    expect(fill("Couldn't load {url}", { url: "https://x/{row}" })).toBe(
      "Couldn't load https://x/{row}"
    );
  });
});

describe(createText, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the Host app's text, with its placeholders filled", () => {
    const text = createText(() => ({ "canvas.row": "Ligne {row}" }));

    expect(text("canvas.row", { row: 2 })).toBe("Ligne 2");
  });

  it("keeps the English for a text the Host app doesn't name", () => {
    const text = createText(() => ({ "canvas.row": "Ligne {row}" }));

    expect(text("topBar.undo")).toBe(STRINGS["topBar.undo"]);
  });

  // `strings` is plain data from the host, and isn't type-checked there.
  it("keeps the English for a text that isn't a string", () => {
    const strings = { "topBar.undo": 1 } as unknown as MailQuiltStrings;

    expect(createText(() => strings)("topBar.undo")).toBe("Undo");
  });

  // Intl, which joins lists and writes dates in it, throws on one.
  it("keeps the English language for one that isn't a language tag, and says so once", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const text = createText(() => ({ language: "en_US" }));

    expect(text("language")).toBe(STRINGS.language);
    expect(text("language")).toBe(STRINGS.language);
    expect(error).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining("en_US")
    );
  });

  it("reads the Host app's texts afresh each time", () => {
    const host: { strings?: MailQuiltStrings } = {};
    const text = createText(() => host.strings);
    host.strings = { "topBar.undo": "Annuler" };

    expect(text("topBar.undo")).toBe("Annuler");
  });
});

/** The IDs of every text a field names, which core can't check. */
const textIdsOf = (field: SettingsField): string[] => [
  field.labelId,
  field.invalidMessageId,
  ...(field.descriptionId === undefined ? [] : [field.descriptionId]),
  ...(field.type === "number" ? [`unit.${field.unit}`] : []),
  ...(field.type === "select"
    ? field.options.flatMap(({ descriptionId, labelId }) =>
        descriptionId === undefined ? [labelId] : [labelId, descriptionId]
      )
    : []),
  ...(field.type === "list" ? field.itemFields.flatMap(textIdsOf) : []),
  ...(field.type === "list" && field.itemKey !== undefined
    ? [
        field.chooseLabelId,
        field.allAddedId,
        ...field.options.map(({ labelId }) => labelId),
      ]
    : []),
  ...(field.type === "list" && field.itemKey === undefined
    ? [field.addLabelId, field.itemNameId]
    : []),
];

// Each type's fields can depend on its props: a Heading's on its level, an
// Image's on whether it has alt text or is decorative, and a Video's on
// whether its line shows.
const PROPS_OF: Partial<Record<BlockType, Record<string, unknown>[]>> = {
  heading: [{ level: 1 }, { level: 2 }, { level: 3 }],
  image: [{}, { alt: "A cup" }, { decorative: true }],
  video: [{}, { play: "none" }],
};

describe("the texts core's settings fields name", () => {
  const fields = [
    ...EMAIL_SETTINGS_FIELDS,
    ...rowSettingsFields({ columns: [] }),
    ...rowSettingsFields({ columns: [{}, {}] as never }),
    ...COLUMN_SETTINGS_FIELDS,
    ...BLOCK_TYPES.flatMap(({ type }) => blockBoxFields(type)),
    ...BLOCK_TYPES.flatMap(({ type }) =>
      (PROPS_OF[type] ?? [{}]).flatMap((props) =>
        blockSettingsFields({ props, type } as never)
      )
    ),
  ];

  it("are each one of the editor's", () => {
    const missing = fields
      .flatMap(textIdsOf)
      .filter((id) => !Object.hasOwn(STRINGS, id));

    expect(missing).toStrictEqual([]);
  });
});
