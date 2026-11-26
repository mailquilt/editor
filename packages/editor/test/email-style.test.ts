import type { BlocksDocument, EmailStyle } from "@mailquilt/core";
import { describe, expect, it } from "vitest";

import { hexOfHsv, hsvOf, ownValuesOf, reachOf } from "../src/email-style.js";

describe("a color in the picker", () => {
  it("is read as hue, saturation and brightness from any color core takes", () => {
    expect(hsvOf("#ff0000")).toStrictEqual({ h: 0, s: 1, v: 1 });
    expect(hsvOf("#0f0")).toStrictEqual({ h: 120, s: 1, v: 1 });
    expect(hsvOf("rgb(0, 0, 255)")).toStrictEqual({ h: 240, s: 1, v: 1 });
    expect(hsvOf("#808080")).toStrictEqual({ h: 0, s: 0, v: 128 / 255 });
  });

  it("has no color to show when it's not one core takes", () => {
    expect(hsvOf("red")).toBeUndefined();
  });

  it("is written back as #rrggbb", () => {
    expect(hexOfHsv({ h: 0, s: 1, v: 1 })).toBe("#ff0000");
    expect(hexOfHsv({ h: 210, s: 0.5, v: 0.8 })).toBe("#6699cc");
    expect(hexOfHsv({ h: 360, s: 1, v: 1 })).toBe("#ff0000");
    expect(hexOfHsv({ h: 0, s: 0, v: 0 })).toBe("#000000");
  });
});

const paragraph = (
  text: string,
  marks?: { attrs: { href: string }; type: "link" }[]
) => ({
  content: [
    {
      content: [{ marks, text, type: "text" as const }],
      type: "paragraph" as const,
    },
  ],
  type: "doc" as const,
});

/**
 * Row a, without a color of its own: a Heading 1, a Heading 1 at 36px of its
 * own color, a Heading 2, Text, Text with a link, Text of its own color and size,
 * and two Buttons, one with its own fill. Row b has its own color and an Image.
 */
const email = (style: EmailStyle = {}): BlocksDocument => ({
  kind: "blocks",
  rows: [
    {
      columns: [
        {
          blocks: [
            {
              id: "h1",
              props: { content: paragraph("A"), level: 1 },
              type: "heading",
            },
            {
              id: "h1Own",
              props: {
                color: "#b5652b",
                content: paragraph("B"),
                fontSize: 36,
                level: 1,
              },
              type: "heading",
            },
            {
              id: "h2",
              props: { content: paragraph("C"), level: 2 },
              type: "heading",
            },
            { id: "text", props: { content: paragraph("D") }, type: "text" },
            {
              id: "link",
              props: {
                content: paragraph("E", [
                  { attrs: { href: "https://a.example" }, type: "link" },
                ]),
              },
              type: "text",
            },
            {
              id: "textOwn",
              props: {
                color: "#112233",
                content: paragraph("F", [
                  { attrs: { href: "https://a.example" }, type: "link" },
                ]),
                fontSize: 18,
              },
              type: "text",
            },
            { id: "button", props: { label: "G" }, type: "button" },
            {
              id: "buttonOwn",
              props: { backgroundColor: "#445566", label: "H" },
              type: "button",
            },
          ],
          id: "column-a",
          props: {},
          width: 100,
        },
      ],
      id: "row-a",
      props: {},
    },
    {
      columns: [
        {
          blocks: [{ id: "image", props: {}, type: "image" }],
          id: "column-b",
          props: {},
          width: 100,
        },
      ],
      id: "row-b",
      props: { backgroundColor: "#00ff00" },
    },
  ],
  settings: {
    backgroundColor: "#ffffff",
    fontFamily: "Arial",
    style,
    width: 600,
  },
  version: 4,
});

describe("what an Email style setting reaches", () => {
  it.each([
    ["backgroundColor", [], []],
    ["emailBackgroundColor", ["row-a"], [["row-b", "#00ff00"]]],
    [
      "textColor",
      ["h1", "h2", "text", "link"],
      [
        ["h1Own", "#b5652b"],
        ["textOwn", "#112233"],
      ],
    ],
    ["linkColor", ["link"], [["textOwn", "#112233"]]],
    ["buttonBackgroundColor", ["button"], [["buttonOwn", "#445566"]]],
    ["heading1FontSize", ["h1"], [["h1Own", 36]]],
    ["heading2FontSize", ["h2"], []],
    [
      "textFontSize",
      ["text", "link", "button", "buttonOwn"],
      [["textOwn", 18]],
    ],
    ["headingFontFamily", ["h1", "h1Own", "h2"], []],
    ["buttonBorderRadius", ["button", "buttonOwn"], []],
  ] as const)(
    "%s changes %j and leaves %j their own",
    (key, changes, keeps) => {
      expect(reachOf(key, email())).toStrictEqual({
        changes,
        keeps: keeps.map(([id, value]) => ({ id, value })),
      });
    }
  );

  it("Text color leaves out text that's all links while Email style sets the links' color", () => {
    expect(
      reachOf("textColor", email({ linkColor: "#0000ff" })).changes
    ).toStrictEqual(["h1", "h2", "text"]);
  });

  it("the body font reaches Headings only while they have no font of their own", () => {
    const body = ["text", "link", "textOwn", "button", "buttonOwn"];
    expect(reachOf("fontFamily", email()).changes).toStrictEqual([
      "h1",
      "h1Own",
      "h2",
      "text",
      "link",
      "textOwn",
      "button",
      "buttonOwn",
    ]);
    expect(
      reachOf("fontFamily", email({ headingFontFamily: "Georgia" })).changes
    ).toStrictEqual(body);
  });
});

/** A Block of the email above, by its ID. */
const blockOf = (id: string) => {
  const found = email().rows[0]?.columns[0]?.blocks.find(
    (block) => block.id === id
  );
  if (!found) {
    throw new Error(id);
  }
  return found;
};

describe("a Block's own values", () => {
  it("are each value it sets over Email style, against what Email style gives every other", () => {
    expect(ownValuesOf(blockOf("h1Own"), {})).toStrictEqual([
      { key: "heading1FontSize", own: 36, prop: "fontSize", shared: 32 },
      { key: "textColor", own: "#b5652b", prop: "color", shared: "#000000" },
    ]);
    expect(
      ownValuesOf(blockOf("textOwn"), {
        textColor: "#2b1d14",
        textFontSize: 17,
      })
    ).toStrictEqual([
      { key: "textFontSize", own: 18, prop: "fontSize", shared: 17 },
      { key: "textColor", own: "#112233", prop: "color", shared: "#2b1d14" },
    ]);
    expect(ownValuesOf(blockOf("buttonOwn"), {})).toStrictEqual([
      {
        key: "buttonBackgroundColor",
        own: "#445566",
        prop: "backgroundColor",
        shared: "#2563eb",
      },
    ]);
  });

  it("leave out a value the same as Email style's, however it's written", () => {
    expect(
      ownValuesOf(blockOf("h1Own"), {
        heading1FontSize: 36,
        textColor: "#B5652B",
      })
    ).toStrictEqual([]);
  });

  it("are none for a Block that sets nothing", () => {
    expect(ownValuesOf(blockOf("h1"), {})).toStrictEqual([]);
  });
});
