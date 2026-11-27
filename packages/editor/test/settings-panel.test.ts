import type { SettingsField } from "@mailquilt/core/internal";
import { describe, expect, it } from "vitest";

import { changeList, fieldValue } from "../src/settings-panel.js";
import { createText } from "../src/text.js";

const field = (type: "number" | "text"): SettingsField =>
  type === "number"
    ? {
        invalidMessageId: "",
        key: "size",
        labelId: "",
        min: 1,
        type,
        unit: "px",
      }
    : { invalidMessageId: "", key: "name", labelId: "", type };

const select: SettingsField = {
  invalidMessageId: "",
  key: "width",
  labelId: "",
  options: [
    { labelId: "", value: 400 },
    { labelId: "", value: 600 },
  ],
  type: "select",
};

const typed = (text: string, badInput = false) => ({ badInput, text });

describe("what's typed in a settings field means", () => {
  it("nothing, when it's empty or only spaces, so the setting goes back to its default", () => {
    expect(fieldValue(field("text"), typed("  "))).toBeNull();
  });

  it("the text, without the spaces around it", () => {
    expect(fieldValue(field("text"), typed(" Hi "))).toBe("Hi");
  });

  it("a number, in a number field", () => {
    expect(fieldValue(field("number"), typed("12"))).toBe(12);
  });

  it("not a number, when the browser can't read it, rather than empty", () => {
    expect(fieldValue(field("number"), typed("", true))).toBeNaN();
  });

  it("the option's own value, of its own type, in a select", () => {
    expect(fieldValue(select, typed("600"))).toBe(600);
  });

  it("the text, in a select, for a saved value that isn't on its list", () => {
    expect(fieldValue(select, typed("500"))).toBe("500");
  });

  it("yes or no, in a switch", () => {
    const toggle: SettingsField = {
      invalidMessageId: "",
      key: "hideOnPhone",
      labelId: "",
      type: "toggle",
    };

    expect(fieldValue(toggle, typed("true"))).toBeTruthy();
    expect(fieldValue(toggle, typed("false"))).toBeFalsy();
  });
});

const links: Extract<SettingsField, { type: "list" }> = {
  allAddedId: "",
  chooseLabelId: "",
  invalidMessageId: "",
  itemFields: [{ invalidMessageId: "", key: "url", labelId: "", type: "text" }],
  itemKey: "network",
  key: "links",
  labelId: "",
  options: [
    { labelId: "network.facebook", value: "facebook" },
    { labelId: "network.instagram", value: "instagram" },
    { labelId: "network.x", value: "x" },
  ],
  type: "list",
};

/** The editor's English, as a Host app that replaces none of it gets. */
const text = createText(() => {});

const facebook = { network: "facebook", url: "https://facebook.com/shop" };
const x = { network: "x" };

describe("a change to a list field's items", () => {
  it("adds an item without its text at the end, and focus goes to its text", () => {
    expect(
      changeList(links, [facebook], { item: "instagram", type: "add" }, text)
    ).toStrictEqual({
      focus: { control: "text", item: "instagram" },
      items: [facebook, { network: "instagram" }],
      renamed: [],
      said: "Instagram added, position 2 of 2.",
    });
  });

  it("moves an item one step, and focus stays on the button that moved it", () => {
    expect(
      changeList(
        links,
        [facebook, x],
        { item: "x", step: -1, type: "move" },
        text
      )
    ).toStrictEqual({
      focus: { control: "moveUp", item: "x" },
      items: [x, facebook],
      renamed: [],
      said: "X moved to position 1 of 2.",
    });
  });

  it("removes an item, and focus goes to the Remove button of the item after it", () => {
    expect(
      changeList(
        links,
        [facebook, x],
        { item: "facebook", type: "remove" },
        text
      )
    ).toStrictEqual({
      focus: { control: "remove", item: "x" },
      items: [x],
      renamed: [],
      said: "Facebook removed.",
    });
  });

  it("removes the last item, and focus goes to the item before it", () => {
    expect(
      changeList(links, [facebook, x], { item: "x", type: "remove" }, text)
        .focus
    ).toStrictEqual({ control: "remove", item: "facebook" });
  });

  it("removes the only item, and focus goes to the way to add one", () => {
    expect(
      changeList(links, [x], { item: "x", type: "remove" }, text).focus
    ).toStrictEqual({ control: "add" });
  });
});

const menuLinks: Extract<SettingsField, { type: "list" }> = {
  addLabelId: "field.menuLinks.add",
  invalidMessageId: "",
  itemFields: [
    { invalidMessageId: "", key: "label", labelId: "", type: "text" },
    { invalidMessageId: "", key: "url", labelId: "", type: "text" },
  ],
  itemNameId: "field.menuLinks.item",
  key: "links",
  labelId: "",
  type: "list",
};

const shop = { label: "Shop", url: "https://a.co/shop" };
const journal = { label: "Journal" };
const unnamed = { url: "https://a.co/about" };

describe("a change to the items of a list without options", () => {
  it("adds an empty item, named by its position, and focus goes to its first field", () => {
    expect(
      changeList(menuLinks, [shop, journal], { type: "add" }, text)
    ).toStrictEqual({
      focus: { control: "text", item: "2" },
      items: [shop, journal, {}],
      renamed: [],
      said: "Link 3 added, position 3 of 3.",
    });
  });

  it("moves an item, named by its first field, and what's typed in the two swaps keys", () => {
    expect(
      changeList(
        menuLinks,
        [shop, journal, unnamed],
        { item: "1", step: -1, type: "move" },
        text
      )
    ).toStrictEqual({
      focus: { control: "moveUp", item: "0" },
      items: [journal, shop, unnamed],
      renamed: [
        ["1", "0"],
        ["0", "1"],
      ],
      said: "Journal moved to position 1 of 3.",
    });
  });

  it("removes an item, and what's typed in each item after it moves up a key", () => {
    expect(
      changeList(
        menuLinks,
        [shop, unnamed, journal],
        { item: "1", type: "remove" },
        text
      )
    ).toStrictEqual({
      focus: { control: "remove", item: "1" },
      items: [shop, journal],
      renamed: [["2", "1"]],
      said: "Link 2 removed.",
    });
  });
});
