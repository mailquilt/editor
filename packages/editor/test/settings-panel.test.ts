import type { SettingsField } from "@mailquilt/core/internal";
import { describe, expect, it } from "vitest";

import { fieldValue } from "../src/settings-panel.js";

const field = (type: "number" | "text"): SettingsField =>
  type === "number"
    ? { invalidMessage: "", key: "size", label: "", min: 1, type, unit: "px" }
    : { invalidMessage: "", key: "name", label: "", type };

const select: SettingsField = {
  invalidMessage: "",
  key: "width",
  label: "",
  options: [
    { label: "Narrow", value: 400 },
    { label: "Wide", value: 600 },
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
});
