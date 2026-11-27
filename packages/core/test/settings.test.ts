import { describe, expect, it } from "vitest";

import {
  BLOCK_TYPES,
  createEditor,
  createEmail,
  loadDocument,
} from "../src/index.js";
import type { BlocksDocument, Operation } from "../src/index.js";
import {
  blockBoxStyles,
  blockSettingsFields,
  blockStyles,
  columnStyles,
  EMAIL_SETTINGS_FIELDS,
  hexColor,
  rowSettingsFields,
  rowStyles,
} from "../src/internal.js";
import type { SettingsField } from "../src/internal.js";

const setup = () => {
  const document = createEmail();
  const [row] = document.rows;
  const blockId = row?.columns[0]?.blocks[0]?.id as string;
  const editor = createEditor({ document });
  const operations: Operation[][] = [];
  editor.subscribe((step) => operations.push(step));
  return { blockId, editor, operations, rowId: row?.id as string };
};

const blockProps = (document: BlocksDocument) =>
  document.rows[0]?.columns[0]?.blocks[0]?.props;

describe("Text Block settings", () => {
  it("stores alignment, color and font size, keeping the text", () => {
    const { blockId, editor } = setup();
    const { content } = blockProps(editor.getDocument()) as {
      content: unknown;
    };

    expect(
      editor.apply({
        blockId,
        props: { align: "center", color: "#ff0000", fontSize: 24 },
        type: "updateBlockProps",
      })
    ).toStrictEqual({ ok: true });

    expect(blockProps(editor.getDocument())).toStrictEqual({
      align: "center",
      color: "#ff0000",
      content,
      fontSize: 24,
    });
  });

  it.each([
    ["an unknown alignment", { align: "middle" }, /align/u],
    ["a color that isn't hex or rgb()", { color: "red" }, /color/u],
    ["a font size past the limit", { fontSize: 201 }, /fontSize/u],
  ])("refuses %s", (_name, props, reason) => {
    const { blockId, editor } = setup();

    expect(
      editor.apply({ blockId, props, type: "updateBlockProps" })
    ).toStrictEqual({
      code: "invalidProps",
      ok: false,
      reason: expect.stringMatching(reason),
    });
  });

  it("goes back to the default when a null removes a setting", () => {
    const { blockId, editor } = setup();
    editor.apply({
      blockId,
      props: { color: "#ff0000" },
      type: "updateBlockProps",
    });

    editor.apply({ blockId, props: { color: null }, type: "updateBlockProps" });

    expect(blockProps(editor.getDocument())).not.toHaveProperty("color");
  });

  it("can't remove the text with a null", () => {
    const { blockId, editor } = setup();

    const result = editor.apply({
      blockId,
      props: { content: null },
      type: "updateBlockProps",
    });

    expect(result).toStrictEqual({
      code: "invalidProps",
      ok: false,
      reason: expect.stringMatching(/content/u),
    });
  });

  it("makes no undo step for a change to the same value", () => {
    const { blockId, editor, operations } = setup();
    editor.apply({
      blockId,
      props: { color: "#ff0000" },
      type: "updateBlockProps",
    });

    const result = editor.apply({
      blockId,
      props: { color: "#ff0000" },
      type: "updateBlockProps",
    });

    expect(result).toMatchObject({ code: "unchanged", ok: false });
    expect(operations).toHaveLength(1);
  });
});

const fieldKeys = (row: BlocksDocument["rows"][0]) =>
  rowSettingsFields(row).map(({ key }) => key);

describe("Row settings", () => {
  it("sets the background color as one undo step", () => {
    const { editor, rowId } = setup();
    const before = editor.getDocument();

    expect(
      editor.apply({
        props: { backgroundColor: "#00ff00" },
        rowId,
        type: "updateRowProps",
      })
    ).toStrictEqual({ ok: true });
    expect(editor.getDocument().rows[0]?.props).toStrictEqual({
      backgroundColor: "#00ff00",
    });

    editor.undo();
    expect(editor.getDocument()).toStrictEqual(before);

    editor.redo();
    expect(editor.getDocument().rows[0]?.props).toStrictEqual({
      backgroundColor: "#00ff00",
    });
  });

  it("refuses a color that isn't hex or rgb()", () => {
    const { editor, rowId } = setup();

    expect(
      editor.apply({
        props: { backgroundColor: "green" },
        rowId,
        type: "updateRowProps",
      })
    ).toStrictEqual({
      code: "invalidProps",
      ok: false,
      reason: expect.stringMatching(/backgroundColor/u),
    });
  });

  it("stores padding on each side, hiding on phones and stacking on phones", () => {
    const { editor, rowId } = setup();
    const props = {
      hideOnPhone: true,
      paddingBottom: 200,
      paddingLeft: 0,
      paddingRight: 24,
      paddingTop: 8,
      stackOnPhone: false,
    };

    expect(
      editor.apply({ props, rowId, type: "updateRowProps" })
    ).toStrictEqual({ ok: true });
    expect(editor.getDocument().rows[0]?.props).toStrictEqual(props);
    expect(loadDocument(editor.getDocument())).toMatchObject({ ok: true });
  });

  it.each([
    ["padding past 200", { paddingTop: 201 }, /paddingTop/u],
    ["padding below 0", { paddingLeft: -1 }, /paddingLeft/u],
    [
      "padding that isn't a whole number",
      { paddingRight: 1.5 },
      /paddingRight/u,
    ],
    ["a choice that isn't yes or no", { hideOnPhone: "true" }, /hideOnPhone/u],
  ])("refuses %s", (_name, props, reason) => {
    const { editor, rowId } = setup();

    expect(
      editor.apply({ props, rowId, type: "updateRowProps" })
    ).toStrictEqual({
      code: "invalidProps",
      ok: false,
      reason: expect.stringMatching(reason),
    });
  });

  it("offers stacking on phones only for a Row with more than one Column", () => {
    const [oneColumn] = createEmail().rows;
    const twoColumns = {
      ...oneColumn,
      columns: [oneColumn?.columns[0], oneColumn?.columns[0]],
    } as BlocksDocument["rows"][0];
    expect(fieldKeys(oneColumn as BlocksDocument["rows"][0])).not.toContain(
      "stackOnPhone"
    );
    expect(fieldKeys(twoColumns)).toContain("stackOnPhone");
  });

  it("refuses a Row that isn't there", () => {
    const { editor } = setup();

    expect(
      editor.apply({ props: {}, rowId: "nope", type: "updateRowProps" })
    ).toStrictEqual({
      code: "noSuchRow",
      ok: false,
      reason: 'No Row with ID "nope"',
    });
  });

  it("reports its change as a setProps Operation for the Row", () => {
    const { editor, operations, rowId } = setup();

    editor.apply({
      props: { backgroundColor: "#00ff00" },
      rowId,
      type: "updateRowProps",
    });

    expect(operations).toStrictEqual([
      [
        {
          previousProps: {},
          props: { backgroundColor: "#00ff00" },
          rowId,
          type: "setProps",
        },
      ],
    ]);
  });
});

// The Box is the same schema on every type, so a Text Block stands for all.
describe("Box settings", () => {
  const box = {
    borderColor: "#b5652b",
    borderRadius: 8,
    borderStyle: "dashed",
    borderWidth: 2,
    boxBackgroundColor: "#efe6da",
    paddingBottom: 0,
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 200,
  };

  it("stores padding, background, border and corners as one undo step", () => {
    const { blockId, editor } = setup();
    const before = editor.getDocument();

    expect(
      editor.apply({ blockId, props: box, type: "updateBlockProps" })
    ).toStrictEqual({ ok: true });
    expect(blockProps(editor.getDocument())).toMatchObject(box);
    expect(loadDocument(editor.getDocument())).toMatchObject({ ok: true });

    editor.undo();
    expect(editor.getDocument()).toStrictEqual(before);
  });

  it.each([
    ["a border wider than 20", { borderWidth: 21 }, /borderWidth/u],
    ["a border of no width", { borderWidth: 0 }, /borderWidth/u],
    [
      "a border style it doesn't draw",
      { borderStyle: "double" },
      /borderStyle/u,
    ],
    ["corners past 100", { borderRadius: 101 }, /borderRadius/u],
    [
      "a background that isn't a color",
      { boxBackgroundColor: "beige" },
      /boxBackgroundColor/u,
    ],
  ])("refuses %s", (_name, props, reason) => {
    const { blockId, editor } = setup();

    expect(
      editor.apply({ blockId, props, type: "updateBlockProps" })
    ).toStrictEqual({
      code: "invalidProps",
      ok: false,
      reason: expect.stringMatching(reason),
    });
  });
});

const columnSetup = () => {
  const { editor } = setup();
  const columnId = editor.getDocument().rows[0]?.columns[0]?.id as string;
  const operations: Operation[][] = [];
  editor.subscribe((step) => operations.push(step));
  return { columnId, editor, operations };
};

const columnProps = (document: BlocksDocument) =>
  document.rows[0]?.columns[0]?.props;

describe("Column settings", () => {
  const settings = {
    backgroundColor: "#ffffff",
    borderColor: "#b5652b",
    borderStyle: "solid",
    borderWidth: 1,
    paddingBottom: 12,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 12,
    verticalAlign: "middle",
  };

  it("stores background, padding, alignment and border as one undo step", () => {
    const { columnId, editor } = columnSetup();
    const before = editor.getDocument();

    expect(
      editor.apply({ columnId, props: settings, type: "updateColumnProps" })
    ).toStrictEqual({ ok: true });
    expect(columnProps(editor.getDocument())).toStrictEqual(settings);
    expect(loadDocument(editor.getDocument())).toMatchObject({ ok: true });

    editor.undo();
    expect(editor.getDocument()).toStrictEqual(before);
  });

  it("reports its change as a setProps Operation for the Column", () => {
    const { columnId, editor, operations } = columnSetup();

    editor.apply({
      columnId,
      props: { verticalAlign: "bottom" },
      type: "updateColumnProps",
    });

    expect(operations).toStrictEqual([
      [
        {
          columnId,
          previousProps: {},
          props: { verticalAlign: "bottom" },
          type: "setProps",
        },
      ],
    ]);
  });

  it("refuses an alignment it doesn't know", () => {
    const { columnId, editor } = columnSetup();

    expect(
      editor.apply({
        columnId,
        props: { verticalAlign: "center" },
        type: "updateColumnProps",
      })
    ).toStrictEqual({
      code: "invalidProps",
      ok: false,
      reason: expect.stringMatching(/verticalAlign/u),
    });
  });

  it("refuses a Column that isn't there", () => {
    const { editor } = columnSetup();

    expect(
      editor.apply({ columnId: "nope", props: {}, type: "updateColumnProps" })
    ).toStrictEqual({
      code: "noSuchColumn",
      ok: false,
      reason: 'No Column with ID "nope"',
    });
  });

  it("are kept by a new Row's Columns, as a copied Row has them", () => {
    const { editor } = columnSetup();

    editor.apply({
      columns: [{ blocks: [], props: { verticalAlign: "bottom" } }],
      index: 0,
      layout: "100",
      type: "insertRow",
    });

    expect(columnProps(editor.getDocument())).toStrictEqual({
      verticalAlign: "bottom",
    });
  });

  it("are checked in a new Row's Columns", () => {
    const { editor } = columnSetup();

    expect(
      editor.apply({
        columns: [{ blocks: [], props: { verticalAlign: "center" } }],
        index: 0,
        layout: "100",
        type: "insertRow",
      })
    ).toStrictEqual({
      code: "invalidProps",
      ok: false,
      reason: expect.stringMatching(/Column 1 in the new Row/u),
    });
  });
});

describe("Email settings", () => {
  const everything = {
    backgroundColor: "#eeeeee",
    fontFamily: `Georgia, 'Times New Roman', "Helvetica Neue", serif`,
    language: "pt-BR",
    preheader: "Hello {{first_name}}",
    width: 640,
  };

  it("sets width, background color, font, preheader and language", () => {
    const { editor } = setup();

    expect(
      editor.apply({ settings: everything, type: "updateEmailSettings" })
    ).toStrictEqual({ ok: true });

    expect(editor.getDocument().settings).toStrictEqual(everything);
  });

  it("reports its change as a setProps Operation for the email", () => {
    const { editor, operations } = setup();
    const before = editor.getDocument().settings;

    editor.apply({ settings: { width: 640 }, type: "updateEmailSettings" });

    expect(operations).toStrictEqual([
      [
        {
          emailSettings: true,
          previousProps: before,
          props: { ...before, width: 640 },
          type: "setProps",
        },
      ],
    ]);
  });

  it("changes only what it names, as one undo step", () => {
    const { editor } = setup();
    const before = editor.getDocument();

    editor.apply({ settings: { width: 640 }, type: "updateEmailSettings" });
    expect(editor.getDocument().settings).toStrictEqual({
      ...before.settings,
      width: 640,
    });

    editor.undo();
    expect(editor.getDocument()).toStrictEqual(before);
  });

  it.each([
    ["a width that isn't whole", { width: 600.5 }, /width/u],
    ["a width of zero", { width: 0 }, /width/u],
    ["a width wider than any inbox", { width: 1201 }, /width/u],
    ["no width", { width: null }, /width/u],
    [
      "a color that isn't hex or rgb()",
      { backgroundColor: "red" },
      /backgroundColor/u,
    ],
    [
      "a color with a line break in it",
      { backgroundColor: "rgb(1,\n2,3)" },
      /backgroundColor/u,
    ],
    // As MJML's strict check, which the export runs, refuses it. The reason
    // shows how to write it.
    [
      "an alpha written without its 0",
      { backgroundColor: "rgba(0, 0, 0, .5)" },
      /backgroundColor: .*rgba\(255, 0, 0, 0\.5\)/u,
    ],
    [
      "a font that adds a CSS rule",
      { fontFamily: "Arial;display:none" },
      /fontFamily/u,
    ],
    [
      "a font that ends the CSS block",
      { fontFamily: "Arial}p{color:red" },
      /fontFamily/u,
    ],
    [
      "a font that loads a URL",
      { fontFamily: "url(https://x)" },
      /fontFamily/u,
    ],
    ["no font name", { fontFamily: " , " }, /fontFamily/u],
    [
      "a font with a quote that doesn't close",
      { fontFamily: '"Helvetica Neue, Arial' },
      /fontFamily/u,
    ],
    ["a preheader that isn't text", { preheader: 1 }, /preheader/u],
    ["a language that isn't a code", { language: "English" }, /language/u],
    // Unicode case folding would read them as s and k.
    ["a language with ſ for s", { language: "ſv" }, /language/u],
    ["a language with K for k", { language: "\u212Ao" }, /language/u],
    [
      "a language with more than its Merge Tag",
      { language: "en-{{region}}" },
      /language/u,
    ],
    ["a setting it doesn't have", { subject: "Hi" }, /subject/u],
  ])("refuses %s", (_name, settings, reason) => {
    const { editor } = setup();

    expect(
      editor.apply({ settings, type: "updateEmailSettings" })
    ).toStrictEqual({
      code: "invalidProps",
      ok: false,
      reason: expect.stringMatching(reason),
    });
  });

  // en-x-pirate has a one-letter subtag, which starts a private one.
  it.each(["en", "fil", "pt-BR", "zh-Hant-TW", "en-x-pirate"])(
    "accepts %s",
    (language) => {
      const { editor } = setup();

      expect(
        editor.apply({ settings: { language }, type: "updateEmailSettings" })
      ).toStrictEqual({ ok: true });
    }
  );
});

const saved = (change: (email: BlocksDocument) => void) => {
  const email = createEmail();
  change(email);
  return loadDocument(email);
};

describe("saved settings", () => {
  it("refuses a Column setting it doesn't know", () => {
    const document = createEmail();
    const column = document.rows[0]?.columns[0] as { props: object };
    column.props = { shadow: true };

    expect(loadDocument(document)).toStrictEqual({
      ok: false,
      reason: expect.stringMatching(/shadow/u),
    });
  });

  it("refuses a Row setting it doesn't know", () => {
    expect(
      saved((email) => {
        (email.rows[0] as BlocksDocument["rows"][0]).props = { padding: 8 };
      })
    ).toStrictEqual({
      ok: false,
      reason: expect.stringMatching(/padding/u),
    });
  });
});

const withLanguage = (language: string) => {
  const document = createEmail();
  document.settings.language = language;
  return document;
};

describe("a saved language that isn't a code", () => {
  it("still loads one, unchanged", () => {
    expect(loadDocument(withLanguage("en_US"))).toMatchObject({
      document: { settings: { language: "en_US" } },
      ok: true,
    });
  });

  it("doesn't stop other settings from changing", () => {
    const editor = createEditor({ document: withLanguage("en_US") });

    expect(
      editor.apply({ settings: { width: 640 }, type: "updateEmailSettings" })
    ).toStrictEqual({ ok: true });
    expect(editor.getDocument().settings).toMatchObject({
      language: "en_US",
      width: 640,
    });
  });

  it("can be sent back unchanged with another setting, as a whole form sends it", () => {
    const editor = createEditor({ document: withLanguage("en_US") });

    expect(
      editor.apply({
        settings: { language: "en_US", width: 640 },
        type: "updateEmailSettings",
      })
    ).toStrictEqual({ ok: true });
  });

  it("is kept by an undefined, as JSON would drop that key", () => {
    const editor = createEditor({ document: withLanguage("en_US") });
    const before = editor.getDocument().settings;

    editor.apply({
      settings: { language: undefined, width: 640 },
      type: "updateEmailSettings",
    });

    expect(editor.getDocument().settings).toStrictEqual({
      ...before,
      width: 640,
    });
  });

  it("can be removed", () => {
    const editor = createEditor({ document: withLanguage("en_US") });

    editor.apply({ settings: { language: null }, type: "updateEmailSettings" });

    expect(editor.getDocument().settings).not.toHaveProperty("language");
  });
});

describe(hexColor, () => {
  it.each([
    ["a short hex color", "#ABC", "#aabbcc"],
    ["a hex color", "#AbCdEf", "#abcdef"],
    ["rgb()", "rgb(255, 0, 16)", "#ff0010"],
    ["rgba(), dropping its alpha", "rgba(0, 128, 255, 0.5)", "#0080ff"],
    ["a channel past 255, capped", "rgb(300, 0, 0)", "#ff0000"],
    ["text with numbers but no color", "12 apples", undefined],
  ])("reads %s", (_name, color, hex) => {
    expect(hexColor(color)).toBe(hex);
  });
});

describe(blockStyles, () => {
  it("treats a setting that's undefined as not set", () => {
    expect(
      blockStyles({
        props: { align: undefined, color: undefined, fontSize: undefined },
        type: "text",
      })
    ).toStrictEqual({
      color: "#000000",
      "font-size": "16px",
      "line-height": "24px",
      "text-align": "left",
    });
  });
});

describe(blockBoxStyles, () => {
  it("writes only the padding a Block sets, and a border solid and black until picked", () => {
    expect(
      blockBoxStyles({
        props: { borderWidth: 2, content: { type: "doc" }, paddingTop: 0 },
        type: "text",
      } as never)
    ).toStrictEqual({ border: "2px solid #000000", "padding-top": "0px" });
  });

  it("leaves a Button's corners to its own shape, over Email style's", () => {
    const button = {
      props: { borderRadius: 100, label: "Shop" },
      type: "button",
    } as const;

    expect(blockBoxStyles(button)).toStrictEqual({});
    expect(
      blockStyles(button, { buttonBorderRadius: 8 })["border-radius"]
    ).toBe("100px");
  });
});

describe(columnStyles, () => {
  it("adds nothing for a Column with no settings", () => {
    expect(columnStyles({ props: {} })).toStrictEqual({});
  });
});

describe(rowStyles, () => {
  it("adds nothing for a Row with no background color", () => {
    expect(rowStyles({ props: {} })).toStrictEqual({});
  });
});

describe("settings fields", () => {
  it("offer the font of a new email", () => {
    const font = EMAIL_SETTINGS_FIELDS.find(({ key }) => key === "fontFamily");
    const options = font?.type === "select" ? font.options : [];

    expect(options.map(({ value }) => value)).toContain(
      createEmail().settings.fontFamily
    );
  });
});

const holdsText = ({ type }: SettingsField) =>
  type === "text" || type === "list";

/**
 * What each field of `fields` that holds text gave for a Merge Tag, by its key.
 * A list's is its item's text, in a list of one item.
 */
const acceptedTags = (
  fields: () => readonly SettingsField[],
  apply: (key: string, value: unknown) => unknown,
  tag: string
) => {
  const results: Record<string, unknown> = {};
  // One field at a time, in the panel's order, reading the fields again after
  // each, as a field such as an Image's link waits for the one before it.
  for (let index = 0; ; index += 1) {
    const field = fields().filter(holdsText)[index];
    if (!field) {
      return results;
    }
    if (field.type === "list") {
      const [option] = field.options;
      results[`${field.key}.${field.itemField.key}`] = apply(field.key, [
        { [field.itemKey]: option?.value, [field.itemField.key]: tag },
      ]);
    } else {
      results[field.key] = field.disabled ? "disabled" : apply(field.key, tag);
    }
  }
};

const allAccepted = (results: Record<string, unknown>) =>
  Object.fromEntries(Object.keys(results).map((key) => [key, { ok: true }]));

describe("a Merge Tag in a text setting", () => {
  const TAG = "{{name}}";

  it.each(BLOCK_TYPES.map(({ type }) => type))(
    "is accepted as the whole value of each of a %s Block's",
    (blockType) => {
      const { editor } = setup();
      const columnId = editor.getDocument().rows[0]?.columns[0]?.id as string;
      editor.apply({ blockType, columnId, index: 0, type: "insertBlock" });
      const block = () => {
        const [first] = editor.getDocument().rows[0]?.columns[0]?.blocks ?? [];
        return first as NonNullable<typeof first>;
      };

      const results = acceptedTags(
        () => blockSettingsFields(block()),
        (key, value) =>
          editor.apply({
            blockId: block().id,
            props: { [key]: value },
            type: "updateBlockProps",
          }),
        TAG
      );

      expect(results).toStrictEqual(allAccepted(results));
    }
  );

  it("is accepted as the whole value of each of a Row's", () => {
    const { editor, rowId } = setup();
    const row = editor.getDocument().rows[0] as BlocksDocument["rows"][0];

    const results = acceptedTags(
      () => rowSettingsFields(row),
      (key, value) =>
        editor.apply({
          props: { [key]: value },
          rowId,
          type: "updateRowProps",
        }),
      TAG
    );

    expect(results).toStrictEqual(allAccepted(results));
  });

  it("is accepted as the whole value of each of the email's", () => {
    const { editor } = setup();

    const results = acceptedTags(
      () => EMAIL_SETTINGS_FIELDS,
      (key, value) =>
        editor.apply({
          settings: { [key]: value },
          type: "updateEmailSettings",
        }),
      TAG
    );

    expect(results).toStrictEqual(allAccepted(results));
  });
});
