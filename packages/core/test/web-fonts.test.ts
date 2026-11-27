import { describe, expect, it } from "vitest";

import { createEditor, createEmail, loadDocument } from "../src/index.js";
import type { BlocksDocument } from "../src/index.js";
import { fontFamilyNames } from "../src/internal.js";

const FRAUNCES = {
  name: "Fraunces",
  url: "https://fonts.googleapis.com/css2?family=Fraunces:wght@400;700&display=swap",
};
const INTER = {
  name: "Inter",
  url: "https://fonts.googleapis.com/css2?family=Inter&display=swap",
};

const setup = () => createEditor({ document: createEmail() });

describe("a web font", () => {
  it("is stored with the email, as its name and URL, beside the font that names it", () => {
    const editor = setup();
    const before = editor.getDocument();

    expect(
      editor.apply({
        settings: {
          fontFamily: "'Fraunces', Georgia, serif",
          fonts: [FRAUNCES],
        },
        type: "updateEmailSettings",
      })
    ).toStrictEqual({ ok: true });
    expect(editor.getDocument().settings).toMatchObject({
      fontFamily: "'Fraunces', Georgia, serif",
      fonts: [FRAUNCES],
    });

    // One undo step takes the font and its URL away together.
    editor.undo();
    expect(editor.getDocument()).toStrictEqual(before);
  });

  it("is kept while Email style's heading font names it", () => {
    const editor = setup();
    editor.apply({
      settings: {
        fonts: [FRAUNCES],
        style: { headingFontFamily: "'Fraunces', Georgia, serif" },
      },
      type: "updateEmailSettings",
    });

    expect(editor.getDocument().settings.fonts).toStrictEqual([FRAUNCES]);
  });

  // So the email holds, and the export loads, only the fonts it uses.
  it("is dropped once no font in the email names it", () => {
    const editor = setup();
    editor.apply({
      settings: {
        fontFamily: "'Inter', Arial, sans-serif",
        fonts: [FRAUNCES, INTER],
        style: { headingFontFamily: "'Fraunces', Georgia, serif" },
      },
      type: "updateEmailSettings",
    });

    editor.apply({
      style: { headingFontFamily: null },
      type: "updateEmailStyle",
    });
    expect(editor.getDocument().settings.fonts).toStrictEqual([INTER]);

    editor.apply({
      settings: { fontFamily: "Arial, Helvetica, sans-serif" },
      type: "updateEmailSettings",
    });
    expect(editor.getDocument().settings).not.toHaveProperty("fonts");
  });

  it("is refused twice under one name", () => {
    const editor = setup();

    expect(
      editor.apply({
        settings: {
          fontFamily: "Inter, Arial",
          fonts: [INTER, { ...INTER, url: "https://example.com/inter.css" }],
        },
        type: "updateEmailSettings",
      })
    ).toStrictEqual({
      code: "invalidProps",
      ok: false,
      reason: expect.stringMatching(/fonts/u),
    });
  });

  it.each([
    // It would add a family, or end the name, in the CSS it's written into.
    ["a comma", "Inter, Arial"],
    ["a quote", "'Inter'"],
    ["a semicolon", "Inter;"],
    ["a brace", "Inter}"],
    ["a space at its start", " Inter"],
    ["no letters", " - "],
    ["nothing", ""],
  ])("is refused with %s in its name", (_name, name) => {
    const editor = setup();

    expect(
      editor.apply({
        settings: { fonts: [{ ...INTER, name }] },
        type: "updateEmailSettings",
      })
    ).toStrictEqual({
      code: "invalidProps",
      ok: false,
      reason: expect.stringMatching(/fonts/u),
    });
  });
});

/** Picks Inter as the body font, from `url`. */
const pickInterFrom = (url: string) =>
  setup().apply({
    settings: {
      fontFamily: "'Inter', Arial, sans-serif",
      fonts: [{ ...INTER, url }],
    },
    type: "updateEmailSettings",
  });

// The URL goes into the export as a stylesheet's link and an @import's url(),
// which MJML writes without escaping it.
describe("a web font's URL", () => {
  it.each([
    [
      "a Google Fonts stylesheet, with its ; @ : and &",
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap",
    ],
    ["a port and a path", "https://cdn.example.com:8443/fonts/brand.css"],
    ["the scheme in capitals", "HTTPS://cdn.example.com/brand.css"],
    ["an escaped character", "https://cdn.example.com/Brand%20Sans.css"],
    ["a host alone", "https://fonts.example.com"],
  ])("is accepted as %s", (_name, url) => {
    expect(pickInterFrom(url)).toStrictEqual({ ok: true });
  });

  it.each([
    ["http:, which a secure page won't load", "http://cdn.example.com/a.css"],
    ["without a scheme", "//cdn.example.com/a.css"],
    ["a relative path", "/fonts/a.css"],
    // oxlint-disable-next-line no-script-url -- What's being refused.
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:text/css,body{color:red}"],
    ["no host", "https:///a.css"],
    ["nothing after the scheme", "https://"],
    [
      "a user name, which hides the real host",
      "https://cdn@evil.example/a.css",
    ],
    ["a space at its start", " https://cdn.example.com/a.css"],
    ["a space inside", "https://cdn.example.com/a b.css"],
    ["a line break", "https://cdn.example.com/a\n.css"],
    // Each ends the link's attribute, the url() or the <style> around it.
    ['a "', 'https://cdn.example.com/a".css'],
    ["a '", "https://cdn.example.com/a'.css"],
    ["a (", "https://cdn.example.com/a(.css"],
    ["a )", "https://cdn.example.com/a).css"],
    ["a <", "https://cdn.example.com/a<.css"],
    ["a >", "https://cdn.example.com/a>.css"],
    ["a \\", String.raw`https://cdn.example.com/a\.css`],
    ["a Merge Tag", "https://{{font_host}}/a.css"],
    ["letters other than ASCII in its host", "https://exämple.com/a.css"],
  ])("is refused as %s", (_name, url) => {
    expect(pickInterFrom(url)).toStrictEqual({
      code: "invalidProps",
      ok: false,
      reason: expect.stringMatching(/fonts/u),
    });
  });
});

/** A new email, saved with `fonts`. */
const savedWith = (fonts: unknown): unknown => {
  const email: BlocksDocument = createEmail();
  return { ...email, settings: { ...email.settings, fonts } };
};

describe("a saved web font", () => {
  it("loads as it was saved", () => {
    const loaded = loadDocument(savedWith([FRAUNCES]));

    expect(loaded.ok && loaded.document.settings.fonts).toStrictEqual([
      FRAUNCES,
    ]);
  });

  // Only a change drops a font nothing names.
  it("that nothing names is kept when the settings are sent back unchanged", () => {
    const loaded = loadDocument(savedWith([FRAUNCES]));
    const editor = createEditor({
      document: loaded.ok ? loaded.document : createEmail(),
    });

    expect(
      editor.apply({
        settings: { fontFamily: editor.getDocument().settings.fontFamily },
        type: "updateEmailSettings",
      })
    ).toMatchObject({ code: "unchanged", ok: false });
    expect(editor.getDocument().settings.fonts).toStrictEqual([FRAUNCES]);
  });

  it("with a URL that isn't https: is refused", () => {
    expect(
      loadDocument(
        savedWith([{ ...FRAUNCES, url: "http://example.com/a.css" }])
      )
    ).toMatchObject({ ok: false, reason: expect.stringMatching(/fonts/u) });
  });
});

describe(fontFamilyNames, () => {
  it.each([
    ["Arial, Helvetica, sans-serif", ["Arial", "Helvetica", "sans-serif"]],
    [
      "'DM Serif Display', Georgia, serif",
      ["DM Serif Display", "Georgia", "serif"],
    ],
    [`"Brand, Sans",Arial`, ["Brand, Sans", "Arial"]],
    [`Arial, 'Brand, Sans', serif`, ["Arial", "Brand, Sans", "serif"]],
    ["  Open Sans  ", ["Open Sans"]],
    // CSS reads an unquoted name's spaces as one, but not a quoted name's.
    ["Open   Sans, 'Brand  Sans'", ["Open Sans", "Brand  Sans"]],
  ])("reads %s as its families", (stack, names) => {
    expect(fontFamilyNames(stack)).toStrictEqual(names);
  });
});
