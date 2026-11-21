// oxlint-disable typescript/no-explicit-any -- These tests damage documents on purpose, which the real types forbid.
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { createEditor, isSameDocument, loadDocument } from "../src/index.js";
import { createDocumentLoader } from "../src/load-document.js";

const readFixture = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`fixtures/${name}.json`, import.meta.url), "utf-8")
  );

/** The saved email, as version 1 of the format would have it. */
const version1 = () => ({ ...readFixture("version-2"), version: 1 });

/**
 * A pretend version 0, which called `settings.backgroundColor`
 * `settings.background`.
 */
const pretendVersion0 = () => {
  const {
    settings: { backgroundColor, ...settings },
    ...email
  } = readFixture("version-2");
  return {
    ...email,
    settings: { ...settings, background: backgroundColor },
    version: 0,
  };
};

describe(loadDocument, () => {
  it("loads a saved email exactly as it was saved", () => {
    expect(loadDocument(readFixture("version-3"))).toStrictEqual({
      document: readFixture("version-3"),
      ok: true,
    });
  });

  it("reads Column widths that are rounded to add up to 100", () => {
    const email = readFixture("version-3");
    email.rows[1].columns = [
      { blocks: [], id: "a", props: {}, width: 33.33 },
      { blocks: [], id: "b", props: {}, width: 33.33 },
      { blocks: [], id: "c", props: {}, width: 33.34 },
    ];

    expect(loadDocument(email)).toMatchObject({ ok: true });
  });

  // MJML's strict check, which the export runs, takes a channel up to 999, and
  // CSS reads one past 255 as 255.
  it.each([
    "#fff",
    "#F4F4F5",
    "rgb(1,2,3)",
    "rgb(1, 2, 3)",
    "rgba(1,2,3,0.5)",
    "rgb(999, 999, 999)",
  ])("reads the background color %s", (backgroundColor) => {
    const email = readFixture("version-3");
    email.settings.backgroundColor = backgroundColor;

    expect(loadDocument(email)).toMatchObject({ ok: true });
  });

  it("keeps an email with no Rows, which deleting every Row leaves behind", () => {
    const email = readFixture("version-3");
    email.rows = [];

    expect(loadDocument(email)).toMatchObject({ ok: true });
  });

  // structuredClone() would throw on one.
  it("loads one wrapped in a Proxy, as Vue's reactive() makes", () => {
    const email = readFixture("version-3");

    expect(loadDocument(new Proxy(email, {}))).toStrictEqual({
      document: readFixture("version-3"),
      ok: true,
    });
  });

  it("returns a document that shares nothing with the one passed in", () => {
    const email = readFixture("version-3");
    const loaded = loadDocument(email);

    email.settings.width = 500;
    email.rows[0].props.backgroundColor = "#000000";
    email.rows[0].columns[0].blocks[0].props.content.content[0].content[0].text =
      "Changed";
    email.rows[1].columns[0].blocks.push("changed");

    expect(loaded).toStrictEqual({
      document: readFixture("version-3"),
      ok: true,
    });
  });
});

describe("refusing a document", () => {
  // Each one changes a saved email in one way that makes it untrustworthy.
  const refused: [string, (email: any) => unknown, RegExp][] = [
    ["nothing", () => null, /object/iu],
    ["a list instead of an email", () => [], /object/iu],
    [
      "a document of another kind",
      (email) => ({ ...email, kind: "html" }),
      /kind/u,
    ],
    [
      "a document with no version",
      ({ version: _version, ...email }) => email,
      /version/u,
    ],
    [
      "a version that isn't a whole number",
      (email) => ({ ...email, version: 1.5 }),
      /version/u,
    ],
    [
      "a newer version",
      (email) => ({ ...email, version: 4 }),
      /version 4 is newer.*version 3/iu,
    ],
    [
      "missing settings",
      ({ settings: _settings, ...email }) => email,
      /settings/u,
    ],
    [
      "a field this version doesn't know",
      (email) => ({ ...email, brand: { color: "red" } }),
      /brand/u,
    ],
    [
      "Row props that are a list",
      (email) => {
        email.rows[0].props = [];
        return email;
      },
      /rows\.0\.props.*list/u,
    ],
    [
      "Column props that are a list",
      (email) => {
        email.rows[0].columns[0].props = [];
        return email;
      },
      /columns\.0\.props.*list/u,
    ],
    // The object schemas would read it as {}, as it has no keys of its own.
    [
      "Column props that are a Date, which JSON can't hold",
      (email) => {
        email.rows[0].columns[0].props = new Date(0);
        return email;
      },
      /columns\.0\.props: Expected an object/u,
    ],
    // Copied as it's migrated, which mustn't make it a plain object.
    [
      "Row props in an older version that are a Date",
      (email) => {
        email.rows[0].props = new Date(0);
        return { ...email, version: 1 };
      },
      /rows\.0\.props: Expected an object/u,
    ],
    [
      "Block props that are a list",
      (email) => {
        email.rows[0].columns[0].blocks[0].props = [];
        return email;
      },
      /blocks\.0\.props.*list/u,
    ],
    [
      "an email width that isn't a positive number",
      (email) => {
        email.settings.width = "600px";
        return email;
      },
      /settings\.width/u,
    ],
    [
      "a background color that's not a color",
      (email) => {
        email.settings.backgroundColor = "not a color";
        return email;
      },
      /settings\.backgroundColor.*color/u,
    ],
    [
      "a background color that's a CSS variable",
      (email) => {
        email.settings.backgroundColor = "var(--x)";
        return email;
      },
      /settings\.backgroundColor.*color/u,
    ],
    [
      "a background color that's hsl()",
      (email) => {
        email.settings.backgroundColor = "hsl(1,2%,3%)";
        return email;
      },
      /settings\.backgroundColor.*color/u,
    ],
    [
      "a background color that's 8-digit hex",
      (email) => {
        email.settings.backgroundColor = "#ffffff80";
        return email;
      },
      /settings\.backgroundColor.*color/u,
    ],
    [
      "a background color with CSS after it",
      (email) => {
        email.settings.backgroundColor = "#fff;background:url(x)";
        return email;
      },
      /settings\.backgroundColor.*color/u,
    ],
    // Only a version 1 email has its colors rewritten as it loads.
    [
      "a background color with a tab after a comma",
      (email) => {
        email.settings.backgroundColor = "rgb(1,\t2,3)";
        return email;
      },
      /settings\.backgroundColor.*color/u,
    ],
    [
      "a background color that's a Merge Tag",
      (email) => {
        email.settings.backgroundColor = "{{brand}}";
        return email;
      },
      /settings\.backgroundColor.*color/u,
    ],
    [
      "an email width that's huge",
      (email) => {
        email.settings.width = 1e21;
        return email;
      },
      /settings\.width/u,
    ],
    [
      "a Column width too small to render",
      (email) => {
        email.rows[1].columns[0].width = 1e-7;
        email.rows[1].columns[1].width = 100 - 1e-7;
        return email;
      },
      /rows\.1\.columns\.0\.width/u,
    ],
    [
      "a Block prop named constructor",
      (email) => {
        Object.defineProperty(
          email.rows[0].columns[0].blocks[0].props,
          "constructor",
          {
            enumerable: true,
            value: "x",
          }
        );
        return email;
      },
      /blocks\.0\.props\.constructor: /u,
    ],
    [
      "a Block prop named __proto__",
      (email) => {
        Object.defineProperty(
          email.rows[0].columns[0].blocks[0].props,
          "__proto__",
          {
            enumerable: true,
            value: "x",
          }
        );
        return email;
      },
      /blocks\.0\.props\.__proto__: /u,
    ],
    [
      "Block props that aren't an object",
      (email) => {
        email.rows[0].columns[0].blocks[0].props = "Hello";
        return email;
      },
      /blocks\.0\.props: /u,
    ],
    [
      "a Block with no props",
      (email) => {
        delete email.rows[0].columns[0].blocks[0].props;
        return email;
      },
      /props/u,
    ],
    [
      "an empty ID",
      (email) => {
        email.rows[0].columns[0].blocks[0].id = "";
        return email;
      },
      /rows\.0\.columns\.0\.blocks\.0\.id/u,
    ],
    [
      "a Column prop this version doesn't know",
      (email) => {
        email.rows[0].columns[0].props = { padding: 4 };
        return email;
      },
      /rows\.0\.columns\.0\.props/u,
    ],
    [
      "a Row with no Columns",
      (email) => {
        email.rows[0].columns = [];
        return email;
      },
      /rows\.0\.columns/u,
    ],
    [
      "a Row with more than four Columns",
      (email) => {
        email.rows[1].columns = ["a", "b", "c", "d", "e"].map((id) => ({
          blocks: [],
          id,
          props: {},
          width: 20,
        }));
        return email;
      },
      /rows\.1\.columns/u,
    ],
    [
      "Column widths that don't add up to 100",
      (email) => {
        email.rows[1].columns[0].width = 60;
        return email;
      },
      /"row-2".*110.*100/u,
    ],
    [
      "a Column width that isn't a number",
      (email) => {
        email.rows[1].columns[0].width = '50" onload="alert(1)';
        return email;
      },
      /rows\.1\.columns\.0\.width/u,
    ],
    [
      "an unknown Block type",
      (email) => {
        email.rows[0].columns[0].blocks[0].type = "hologram";
        return email;
      },
      /blocks\.0\.type: /u,
    ],
    [
      "Block props outside its schema",
      (email) => {
        email.rows[0].columns[0].blocks[0].props.colour = "red";
        return email;
      },
      /blocks\.0\.props\.colour: /u,
    ],
    [
      "text that isn't limited rich text",
      (email) => {
        email.rows[0].columns[0].blocks[0].props.content = "<p>Hello</p>";
        return email;
      },
      /blocks\.0\.props\.content: /u,
    ],
    [
      "two Blocks with the same ID",
      (email) => {
        email.rows[1].columns[0].blocks = [
          structuredClone(email.rows[0].columns[0].blocks[0]),
        ];
        return email;
      },
      /duplicate id "block-1"/iu,
    ],
    [
      "two Rows with the same ID",
      (email) => {
        email.rows[1].id = email.rows[0].id;
        return email;
      },
      /duplicate id "row-1"/iu,
    ],
    [
      "a Row and a Column with the same ID",
      (email) => {
        email.rows[1].columns[0].id = "row-1";
        return email;
      },
      /duplicate id "row-1"/iu,
    ],
  ];

  it.each(refused)("refuses %s with a reason", (_name, damage, reason) => {
    expect(loadDocument(damage(readFixture("version-3")))).toStrictEqual({
      ok: false,
      reason: expect.stringMatching(reason),
    });
  });

  // Two, as no refusal writes to what it was given: one the schema refuses, and
  // one refused after the schema has read the whole email.
  const untouched = refused.filter(([name]) =>
    ["a document of another kind", "two Blocks with the same ID"].includes(name)
  );
  // A renamed case would otherwise drop out without a failure.
  if (untouched.length !== 2) {
    throw new Error("Update these names to match the refused list");
  }

  it.each(untouched)("doesn't change %s", (_name, damage) => {
    const document = damage(readFixture("version-3"));
    const before = structuredClone(document);

    loadDocument(document);

    expect(document).toStrictEqual(before);
  });
});

describe("opening an email saved with 0.1.0", () => {
  it("writes each color and URL that 0.1.0 accepted as the current checks take it", () => {
    const email = readFixture("version-3");
    email.settings.backgroundColor = "rgb(244, 244, 245)";
    email.rows[0].props.backgroundColor = "rgb(255, 255, 255)";
    email.rows[0].columns[0].blocks[0].props.color = "rgba(51, 51, 51, 0.9)";
    email.rows[0].columns[0].blocks[2].props.src =
      "HTTPs://example.com/logo.png";

    expect(loadDocument(readFixture("saved-with-0.1.0"))).toStrictEqual({
      document: email,
      ok: true,
    });
  });
});

/** The first paragraph of the first Text Block, in a fixture's email. */
const firstParagraph = (email: any) =>
  email.rows[0].columns[0].blocks[0].props.content.content[0];

describe("opening an email saved with version 2", () => {
  const bold = { type: "bold" };
  const link = { attrs: { href: "{{cta_url}}" }, type: "link" };

  it("loads it as version 3, with each Merge Tag in its text a node", () => {
    expect(loadDocument(readFixture("version-2"))).toStrictEqual({
      document: readFixture("version-3"),
      ok: true,
    });
  });

  it("makes each tag whole in one run of text a node with that run's marks, its name kept byte for byte", () => {
    const email = readFixture("version-2");
    firstParagraph(email).content = [
      { text: "{{ first name }}, {{#if vip}}gold{{/if}}", type: "text" },
      { marks: [link, bold], text: "Open {{cta_text}}", type: "text" },
    ];
    const loaded = loadDocument(email);

    expect(loaded.ok && firstParagraph(loaded.document).content).toStrictEqual([
      { attrs: { name: " first name " }, type: "mergeTag" },
      { text: ", ", type: "text" },
      { attrs: { name: "#if vip" }, type: "mergeTag" },
      { text: "gold", type: "text" },
      { attrs: { name: "/if" }, type: "mergeTag" },
      { marks: [link, bold], text: "Open ", type: "text" },
      { attrs: { name: "cta_text" }, marks: [link, bold], type: "mergeTag" },
    ]);
  });

  it("refuses a run holding only a tag with a field text can't have, rather than dropping it", () => {
    const email = readFixture("version-2");
    firstParagraph(email).content = [
      { attrs: { unexpected: true }, text: "{{first_name}}", type: "text" },
    ];

    expect(loadDocument(email)).toStrictEqual({
      ok: false,
      reason: expect.stringMatching(/attrs/u),
    });
  });

  // Only an email written outside the editor can have one, and it still
  // exports the same, as the renderer reads tags across runs.
  it("leaves a tag split across runs with different marks as text", () => {
    const email = readFixture("version-2");
    const split = [
      { marks: [bold], text: "{{first", type: "text" },
      { text: "_name}}", type: "text" },
    ];
    firstParagraph(email).content = split;
    const loaded = loadDocument(email);

    expect(loaded.ok && firstParagraph(loaded.document).content).toStrictEqual(
      split
    );
  });
});

const renameBackground = (document: any) => {
  const { background, ...settings } = document.settings;
  return {
    ...document,
    settings: { ...settings, backgroundColor: background },
  };
};

/**
 * How migrations run, with a pretend version 0 that called
 * `settings.backgroundColor` `settings.background`, and loaders that stop at
 * the version each test needs. The real migration is tested through
 * `loadDocument` above.
 */
describe("migrating an older document", () => {
  it("loads a saved older email as the current version", () => {
    const load = createDocumentLoader(1, { 0: renameBackground });

    expect(load(pretendVersion0())).toStrictEqual({
      document: version1(),
      ok: true,
    });
  });

  it("migrates one wrapped in a Proxy, as Vue's reactive() makes", () => {
    const load = createDocumentLoader(1, { 0: renameBackground });

    expect(load(new Proxy(pretendVersion0(), {}))).toStrictEqual({
      document: version1(),
      ok: true,
    });
  });

  it("runs each migration in order, from the saved version", () => {
    const load = createDocumentLoader(3, {
      0: renameBackground,
      1: (document: any) => ({
        ...document,
        settings: { ...document.settings, language: "fr" },
      }),
      2: (document: any) => ({
        ...document,
        settings: {
          ...document.settings,
          preheader: `${document.settings.language} first`,
        },
      }),
    });

    expect(load(pretendVersion0())).toMatchObject({
      document: {
        settings: { language: "fr", preheader: "fr first" },
        version: 3,
      },
      ok: true,
    });
  });

  it("skips migrations older than the saved version", () => {
    const load = createDocumentLoader(2, {
      0: () => {
        throw new Error("Should not run");
      },
      1: (document) => document,
    });

    expect(load(version1())).toMatchObject({
      document: { version: 2 },
      ok: true,
    });
  });

  it("doesn't change the document passed in, even if a migration writes to it", () => {
    const load = createDocumentLoader(1, {
      0: (document: any) => {
        document.settings.backgroundColor = document.settings.background;
        delete document.settings.background;
        return document;
      },
    });
    const saved = pretendVersion0();

    expect(load(saved)).toMatchObject({ ok: true });

    expect(saved).toStrictEqual(pretendVersion0());
  });

  it("refuses a version it has no migration from", () => {
    expect(loadDocument(pretendVersion0())).toStrictEqual({
      ok: false,
      reason: expect.stringMatching(/no migration from version 0/iu),
    });
  });

  it("refuses a document a migration can't handle, with the reason", () => {
    const load = createDocumentLoader(1, {
      0: () => {
        throw new Error("settings is missing");
      },
    });

    expect(load(pretendVersion0())).toStrictEqual({
      ok: false,
      reason: expect.stringMatching(/version 0.*settings is missing/iu),
    });
  });

  it("refuses an older document that isn't valid once migrated", () => {
    const load = createDocumentLoader(1, { 0: (document) => document });

    expect(load(pretendVersion0())).toStrictEqual({
      ok: false,
      reason: expect.stringMatching(/background/u),
    });
  });

  it("refuses an older document that can't be copied, rather than throwing", () => {
    const load = createDocumentLoader(1, { 0: renameBackground });
    const saved = {
      ...pretendVersion0(),
      get settings() {
        throw new Error("Can't be read");
      },
    };

    expect(load(saved)).toStrictEqual({
      ok: false,
      reason: expect.stringMatching(/version 0.*can't be read/iu),
    });
  });
});

describe("creating an editor from a saved document", () => {
  it("refuses a bad document with the reason", () => {
    const document = { ...readFixture("version-3"), version: 4 };

    expect(() => createEditor({ document })).toThrow(/version 4 is newer/iu);
  });

  it("edits a good document", () => {
    const document = readFixture("version-3");

    expect(createEditor({ document }).getDocument()).toStrictEqual(document);
  });
});

describe(isSameDocument, () => {
  const reorderKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(reorderKeys);
    }
    return typeof value === "object" && value !== null
      ? Object.fromEntries(
          Object.entries(value)
            .toReversed()
            .map(([key, item]) => [key, reorderKeys(item)])
        )
      : value;
  };

  it("matches a document whose stored keys came back in another order", () => {
    const email = readFixture("version-3");

    expect(isSameDocument(email, reorderKeys(email))).toBeTruthy();
  });

  it("matches a field set to undefined, which JSON drops", () => {
    const email = readFixture("version-3");
    delete email.settings.preheader;
    const clone = structuredClone(email);
    clone.settings.preheader = undefined;

    expect(isSameDocument(email, clone)).toBeTruthy();
  });

  const different: [string, (email: any) => void][] = [
    [
      "text",
      (email) => {
        email.rows[0].columns[0].blocks[0].props.content.content[0].content[0].text =
          "Changed";
      },
    ],
    [
      "a removed field",
      (email) => {
        delete email.settings.language;
      },
    ],
    [
      "a list with an extra empty entry",
      (email) => {
        email.rows.push(undefined);
      },
    ],
    // Read as `object.__proto__`, it would be the prototype on the other side.
    [
      "a key named __proto__",
      (email) => {
        Object.defineProperty(email.rows[0].props, "__proto__", {
          enumerable: true,
          value: {},
        });
      },
    ],
    [
      "a list swapped for an object",
      (email) => {
        email.rows[0].props = [];
        email.rows[0].columns = {};
      },
    ],
  ];

  it.each(different)("tells apart a change to %s", (_name, change) => {
    const email = readFixture("version-3");
    const changed = structuredClone(email);
    change(changed);

    expect(isSameDocument(email, changed)).toBeFalsy();
    expect(isSameDocument(changed, email)).toBeFalsy();
  });

  it("tells a document apart from something that isn't one", () => {
    const email = readFixture("version-3");

    expect(isSameDocument(email, null)).toBeFalsy();
    expect(isSameDocument(undefined, email)).toBeFalsy();
  });
});
