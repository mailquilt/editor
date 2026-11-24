import type { BlockType } from "@mailquilt/core";

import { STRINGS } from "./strings.js";
import type { MailQuiltStrings, StringId } from "./strings.js";

/** The values a text's placeholders are filled with, by name. */
export type TextValues = Readonly<Record<string, number | string | undefined>>;

/** A text, in the Host app's words if it gives one, with its placeholders filled. */
export type Text = (id: StringId, values?: TextValues) => string;

/** A `{name}`, but not a `{{name}}`, which is a Merge Tag. */
const PLACEHOLDER = /(?<!\{)\{(?<name>\w+)\}(?!\})/gu;

/**
 * Fills each placeholder `values` has a value for. One it doesn't stays as
 * written, and what's filled in isn't read again.
 */
export const fill = (template: string, values: TextValues = {}) =>
  template.replaceAll(PLACEHOLDER, (placeholder, name: string) => {
    const value = Object.hasOwn(values, name) ? values[name] : undefined;
    return value === undefined ? placeholder : String(value);
  });

/** What a person calls a kind of Block. */
export const blockTypeName = (type: BlockType, text: Text) =>
  text(`block.${type}`);

/** Reads `strings()` each time, so a change to it shows on the next update. */
export const createText =
  (strings: () => MailQuiltStrings | undefined): Text =>
  (id, values) => {
    const replaced = strings()?.[id];
    return fill(typeof replaced === "string" ? replaced : STRINGS[id], values);
  };
