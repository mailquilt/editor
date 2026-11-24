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
  itemField: { invalidMessageId: "", key: "url", labelId: "", type: "text" },
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
