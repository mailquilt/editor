// oxlint-disable typescript/no-explicit-any -- These tests damage documents on purpose, which the real types forbid.
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { createEditor, isSameDocument, loadDocument } from "../src/index.js";
import { createDocumentLoader } from "../src/load-document.js";

const readFixture = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`fixtures/${name}.json`, import.meta.url), "utf-8")
  );

describe(loadDocument, () => {
  it("loads a saved version 1 email exactly as it was saved", () => {
    expect(loadDocument(readFixture("version-1"))).toStrictEqual({
      document: readFixture("version-1"),
      ok: true,
    });
  });

  it("reads Column widths that are rounded to add up to 100", () => {
    const email = readFixture("version-1");
    email.rows[1].columns = [
      { blocks: [], id: "a", props: {}, width: 33.33 },
      { blocks: [], id: "b", props: {}, width: 33.33 },
      { blocks: [], id: "c", props: {}, width: 33.34 },
    ];

    expect(loadDocument(email)).toMatchObject({ ok: true });
  });

  it.each(["#fff", "#F4F4F5", "rgb(1,2,3)", "rgb(1, 2, 3)", "rgba(1,2,3,0.5)"])(
    "reads the background color %s",
    (backgroundColor) => {
      const email = readFixture("version-1");
      email.settings.backgroundColor = backgroundColor;

      expect(loadDocument(email)).toMatchObject({ ok: true });
    }
  );

  it("keeps an email with no Rows, which deleting every Row leaves behind", () => {
    const email = readFixture("version-1");
    email.rows = [];

    expect(loadDocument(email)).toMatchObject({ ok: true });
  });

  it("returns a document that shares nothing with the one passed in", () => {
    const email = readFixture("version-1");
    const loaded = loadDocument(email);

    email.settings.width = 500;
    email.rows[0].props.backgroundColor = "#000000";
    email.rows[0].columns[0].blocks[0].props.content.content[0].content[0].text =
      "Changed";
    email.rows[1].columns[0].blocks.push("changed");

    expect(loaded).toStrictEqual({
      document: readFixture("version-1"),
      ok: true,
    });
  });
});

describe("refusing a document", () => {
  // Each one changes a saved email in one way that makes it untrustworthy.
  const refused: [string, (email: any) => unknown, RegExp][] = [
    ["nothing", () => null, /object/iu],
    ["text instead of an email", () => "<p>Hello</p>", /object/iu],
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
      (email) => ({ ...email, version: 2 }),
      /version 2 is newer.*version 1/iu,
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
      "an email width that isn't a positive number",
      (email) => {
        email.settings.width = "600px";
        return email;
      },
      /settings\.width/u,
    ],
    [
      "a background color that's empty",
      (email) => {
        email.settings.backgroundColor = "";
        return email;
      },
      /settings\.backgroundColor.*color/u,
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
      /"block-1".*constructor/u,
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
      /"block-1".*__proto__/u,
    ],
    [
      "a Block prop named prototype",
      (email) => {
        Object.defineProperty(
          email.rows[0].columns[0].blocks[0].props,
          "prototype",
          {
            enumerable: true,
            value: "x",
          }
        );
        return email;
      },
      /"block-1".*prototype/u,
    ],
    [
      "Block props that aren't an object",
      (email) => {
        email.rows[0].columns[0].blocks[0].props = "Hello";
        return email;
      },
      /"block-1"/u,
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
      /"block-1".*unknown type "hologram"/u,
    ],
    [
      "Block props outside its schema",
      (email) => {
        email.rows[0].columns[0].blocks[0].props.colour = "red";
        return email;
      },
      /"block-1".*colour/u,
    ],
    [
      "text that isn't limited rich text",
      (email) => {
        email.rows[0].columns[0].blocks[0].props.content = "<p>Hello</p>";
        return email;
      },
      /"block-1".*content/u,
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
      "a Row and a Column with the same ID",
      (email) => {
        email.rows[1].columns[0].id = "row-1";
        return email;
      },
      /duplicate id "row-1"/iu,
    ],
  ];

  it.each(refused)("refuses %s with a reason", (_name, damage, reason) => {
    expect(loadDocument(damage(readFixture("version-1")))).toStrictEqual({
      ok: false,
      reason: expect.stringMatching(reason),
    });
  });

  // Two, as no refusal writes to what it was given: one the schema refuses, and
  // one refused only once every Block's props have been checked.
  const untouched = refused.filter(([name]) =>
    ["a document of another kind", "two Blocks with the same ID"].includes(name)
  );
  // A renamed case would otherwise drop out without a failure.
  if (untouched.length !== 2) {
    throw new Error("Update these names to match the refused list");
  }

  it.each(untouched)("doesn't change %s", (_name, damage) => {
    const document = damage(readFixture("version-1"));
    const before = structuredClone(document);

    loadDocument(document);

    expect(document).toStrictEqual(before);
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
 * Version 1 is the first real format, so no real migration exists yet. This
 * pretend version 0 called `settings.backgroundColor` `settings.background`.
 * When version 2 ships, save a real version 1 fixture test through
 * `loadDocument` next to these.
 */
describe("migrating an older document", () => {
  it("loads a saved older email as the current version", () => {
    const load = createDocumentLoader(1, { 0: renameBackground });

    expect(load(readFixture("pretend-version-0"))).toStrictEqual({
      document: readFixture("version-1"),
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

    expect(load(readFixture("pretend-version-0"))).toMatchObject({
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

    expect(load(readFixture("version-1"))).toMatchObject({
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
    const saved = readFixture("pretend-version-0");

    expect(load(saved)).toMatchObject({ ok: true });

    expect(saved).toStrictEqual(readFixture("pretend-version-0"));
  });

  it("refuses a version it has no migration from", () => {
    expect(loadDocument(readFixture("pretend-version-0"))).toStrictEqual({
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

    expect(load(readFixture("pretend-version-0"))).toStrictEqual({
      ok: false,
      reason: expect.stringMatching(/version 0.*settings is missing/iu),
    });
  });

  it("refuses an older document that isn't valid once migrated", () => {
    const load = createDocumentLoader(1, { 0: (document) => document });

    expect(load(readFixture("pretend-version-0"))).toStrictEqual({
      ok: false,
      reason: expect.stringMatching(/background/u),
    });
  });

  it("refuses an older document that can't be copied, rather than throwing", () => {
    const load = createDocumentLoader(1, { 0: renameBackground });
    const saved = { ...readFixture("pretend-version-0"), extra: () => "code" };

    expect(load(saved)).toMatchObject({ ok: false });
  });
});

describe("creating an editor from a saved document", () => {
  it("refuses a bad document with the reason", () => {
    const document = { ...readFixture("version-1"), version: 2 };

    expect(() => createEditor({ document })).toThrow(/version 2 is newer/iu);
  });

  it("edits a good document", () => {
    const document = readFixture("version-1");

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

  it("matches a clone of a document", () => {
    const email = readFixture("version-1");

    expect(isSameDocument(email, structuredClone(email))).toBeTruthy();
  });

  it("matches a document whose stored keys came back in another order", () => {
    const email = readFixture("version-1");

    expect(isSameDocument(email, reorderKeys(email))).toBeTruthy();
  });

  it("matches a field set to undefined, which JSON drops", () => {
    const email = readFixture("version-1");
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
      "a setting",
      (email) => {
        email.settings.width = 500;
      },
    ],
    [
      "a removed field",
      (email) => {
        delete email.settings.language;
      },
    ],
    [
      "the order of Rows",
      (email) => {
        email.rows.reverse();
      },
    ],
    [
      "a list with an extra empty entry",
      (email) => {
        email.rows.push(undefined);
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
    const email = readFixture("version-1");
    const changed = structuredClone(email);
    change(changed);

    expect(isSameDocument(email, changed)).toBeFalsy();
    expect(isSameDocument(changed, email)).toBeFalsy();
  });

  it("tells a document apart from something that isn't one", () => {
    const email = readFixture("version-1");

    expect(isSameDocument(email, null)).toBeFalsy();
    expect(isSameDocument(undefined, email)).toBeFalsy();
  });
});
