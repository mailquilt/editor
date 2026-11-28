import { describe, expect, it } from "vitest";

import { createEditor, createEmail } from "../src/index.js";
import type { EmailStyle, Operation } from "../src/index.js";
import { blockStyles } from "../src/internal.js";

const setup = () => {
  const editor = createEditor({ document: createEmail() });
  const operations: Operation[][] = [];
  editor.subscribe((step) => operations.push(step));
  return { editor, operations };
};

const EVERY_FIELD: Required<EmailStyle> = {
  buttonBackgroundColor: "#2b1d14",
  buttonBorderRadius: 0,
  emailBackgroundColor: "#fbf7f1",
  heading1FontSize: 36,
  heading2FontSize: 26,
  heading3FontSize: 21,
  headingFontFamily: "Georgia, 'Times New Roman', serif",
  linkColor: "#b5652b",
  textColor: "#2b1d14",
  textFontSize: 15,
};

describe("updateEmailStyle", () => {
  it("sets every Email style field", () => {
    const { editor } = setup();

    expect(
      editor.apply({ style: EVERY_FIELD, type: "updateEmailStyle" })
    ).toStrictEqual({ ok: true });

    expect(editor.getDocument().settings.style).toStrictEqual(EVERY_FIELD);
  });

  it("changes only the fields it names, and clears one with a null", () => {
    const { editor } = setup();
    editor.apply({
      style: { linkColor: "#b5652b", textColor: "#2b1d14" },
      type: "updateEmailStyle",
    });

    editor.apply({
      style: { linkColor: null, textFontSize: 15 },
      type: "updateEmailStyle",
    });

    expect(editor.getDocument().settings.style).toStrictEqual({
      textColor: "#2b1d14",
      textFontSize: 15,
    });
  });

  // So an email whose style is all cleared is the email it was before.
  it("leaves no Email style once every field is cleared", () => {
    const { editor } = setup();
    const before = editor.getDocument();
    editor.apply({ style: { textColor: "#2b1d14" }, type: "updateEmailStyle" });

    editor.apply({ style: { textColor: null }, type: "updateEmailStyle" });

    expect(editor.getDocument()).toStrictEqual(before);
  });

  it("reports its change as a setProps Operation for the email, undone in one step", () => {
    const { editor, operations } = setup();
    const before = editor.getDocument();

    editor.apply({ style: { textColor: "#2b1d14" }, type: "updateEmailStyle" });

    expect(operations).toStrictEqual([
      [
        {
          emailSettings: true,
          previousProps: before.settings,
          props: { ...before.settings, style: { textColor: "#2b1d14" } },
          type: "setProps",
        },
      ],
    ]);
    editor.undo();
    expect(editor.getDocument()).toStrictEqual(before);
  });

  it.each([
    ["a color that isn't one", { textColor: "red" }, /style\.textColor/u],
    // MJML paints a button in two layers, so a see-through one comes out darker.
    [
      "a see-through button color",
      { buttonBackgroundColor: "rgba(0, 0, 0, 0.5)" },
      /style\.buttonBackgroundColor/u,
    ],
    [
      "a heading font that adds a CSS rule",
      { headingFontFamily: "Arial;display:none" },
      /style\.headingFontFamily/u,
    ],
    ["a size of zero", { heading1FontSize: 0 }, /style\.heading1FontSize/u],
    ["a size over 200", { textFontSize: 201 }, /style\.textFontSize/u],
    [
      "corners that aren't whole",
      { buttonBorderRadius: 2.5 },
      /style\.buttonBorderRadius/u,
    ],
    [
      "negative corners",
      { buttonBorderRadius: -1 },
      /style\.buttonBorderRadius/u,
    ],
    [
      "corners over 100",
      { buttonBorderRadius: 101 },
      /style\.buttonBorderRadius/u,
    ],
    ["a field it doesn't have", { bodyFontFamily: "Arial" }, /bodyFontFamily/u],
  ])("refuses %s", (_name, style, reason) => {
    const { editor } = setup();

    expect(editor.apply({ style, type: "updateEmailStyle" })).toStrictEqual({
      code: "invalidProps",
      ok: false,
      reason: expect.stringMatching(reason),
    });
  });

  it("refuses a style that isn't an object", () => {
    const { editor } = setup();

    expect(
      editor.apply({
        style: ["#2b1d14"] as unknown as Record<string, unknown>,
        type: "updateEmailStyle",
      })
    ).toMatchObject({ code: "invalidCommand", ok: false });
  });

  it("refuses a style that's a Date, rather than as nothing to change", () => {
    const { editor } = setup();

    expect(
      editor.apply({
        style: new Date(0) as unknown as Record<string, unknown>,
        type: "updateEmailStyle",
      })
    ).toMatchObject({ code: "invalidCommand", ok: false });
  });

  it("refuses a value the email already has, with no undo step", () => {
    const { editor } = setup();
    editor.apply({ style: { textColor: "#2b1d14" }, type: "updateEmailStyle" });

    expect(
      editor.apply({
        style: { textColor: "#2b1d14" },
        type: "updateEmailStyle",
      })
    ).toMatchObject({ code: "unchanged", ok: false });
    editor.undo();
    expect(editor.getDocument().settings.style).toBeUndefined();
  });
});

describe("updateEmailSettings with an Email style", () => {
  // The object schemas would read it as {}, as every field is optional.
  it("refuses one that's a list", () => {
    const { editor } = setup();

    expect(
      editor.apply({ settings: { style: [] }, type: "updateEmailSettings" })
    ).toStrictEqual({
      code: "invalidProps",
      ok: false,
      reason: expect.stringMatching(/style.*list/u),
    });
  });
});

describe("a Block's look with an Email style", () => {
  const text = {
    content: {
      content: [{ type: "paragraph" as const }],
      type: "doc" as const,
    },
  };

  it("comes from the Email style where the Block sets nothing", () => {
    expect([
      blockStyles({ props: text, type: "text" }, EVERY_FIELD),
      blockStyles(
        { props: { ...text, level: 2 }, type: "heading" },
        EVERY_FIELD
      ),
      blockStyles({ props: { label: "Go" }, type: "button" }, EVERY_FIELD),
    ]).toStrictEqual([
      {
        color: "#2b1d14",
        "font-size": "15px",
        "line-height": "23px",
        "text-align": "left",
      },
      {
        color: "#2b1d14",
        "font-size": "26px",
        "font-weight": "700",
        "line-height": "39px",
        "text-align": "left",
      },
      {
        "background-color": "#2b1d14",
        "border-radius": "0px",
        color: "#ffffff",
        "font-size": "15px",
        "text-align": "left",
      },
    ]);
  });

  it("comes from the Block's own value over the Email style", () => {
    expect([
      blockStyles(
        { props: { ...text, color: "#333333", fontSize: 18 }, type: "text" },
        EVERY_FIELD
      ),
      blockStyles(
        { props: { ...text, fontSize: 40, level: 1 }, type: "heading" },
        EVERY_FIELD
      ),
      blockStyles(
        {
          props: { backgroundColor: "#00ff00", label: "Go" },
          type: "button",
        },
        EVERY_FIELD
      ),
    ]).toMatchObject([
      { color: "#333333", "font-size": "18px" },
      { color: "#2b1d14", "font-size": "40px" },
      { "background-color": "#00ff00" },
    ]);
  });
});
