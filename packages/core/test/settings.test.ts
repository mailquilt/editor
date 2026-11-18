import { describe, expect, it } from "vitest";

import { createEditor, createEmail, loadDocument } from "../src/index.js";
import type { BlocksDocument, Operation } from "../src/index.js";
import {
  blockStyles,
  EMAIL_SETTINGS_FIELDS,
  hexColor,
  rowStyles,
} from "../src/internal.js";

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
  it("sets alignment, color and font size, keeping the text", () => {
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
  ])("rejects %s", (_name, props, reason) => {
    const { blockId, editor } = setup();

    expect(
      editor.apply({ blockId, props, type: "updateBlockProps" })
    ).toStrictEqual({ ok: false, reason: expect.stringMatching(reason) });
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

    expect(result).toMatchObject({ ok: false, unchanged: true });
    expect(operations).toHaveLength(1);
  });
});

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

  it("rejects a color that isn't hex or rgb()", () => {
    const { editor, rowId } = setup();

    expect(
      editor.apply({
        props: { backgroundColor: "green" },
        rowId,
        type: "updateRowProps",
      })
    ).toStrictEqual({
      ok: false,
      reason: expect.stringMatching(/backgroundColor/u),
    });
  });

  it("rejects a Row that isn't there", () => {
    const { editor } = setup();

    expect(
      editor.apply({ props: {}, rowId: "nope", type: "updateRowProps" })
    ).toStrictEqual({ ok: false, reason: 'No Row with ID "nope"' });
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
    ["a setting it doesn't have", { subject: "Hi" }, /subject/u],
  ])("rejects %s", (_name, settings, reason) => {
    const { editor } = setup();

    expect(
      editor.apply({ settings, type: "updateEmailSettings" })
    ).toStrictEqual({ ok: false, reason: expect.stringMatching(reason) });
  });

  it.each(["en", "fil", "pt-BR", "zh-Hant-TW"])("accepts %s", (language) => {
    const { editor } = setup();

    expect(
      editor.apply({ settings: { language }, type: "updateEmailSettings" })
    ).toStrictEqual({ ok: true });
  });
});

const saved = (change: (email: BlocksDocument) => void) => {
  const email = createEmail();
  change(email);
  return loadDocument(email);
};

describe("saved settings", () => {
  it.each([
    [
      "a Row setting it doesn't know",
      (email: BlocksDocument) => {
        (email.rows[0] as BlocksDocument["rows"][0]).props = { padding: 8 };
      },
      /padding/u,
    ],
  ])("refuses %s", (_name, change, reason) => {
    expect(saved(change)).toStrictEqual({
      ok: false,
      reason: expect.stringMatching(reason),
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
    ["text with no color", "none", undefined],
    ["text with numbers but no color", "12 apples", undefined],
    ["a # that isn't a color", "#ffffff80", undefined],
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
      "text-align": "left",
    });
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
