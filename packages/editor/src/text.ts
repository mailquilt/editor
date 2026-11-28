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

/** The Host app's last `language` that isn't a language tag, said once. */
let refusedLanguage: string | undefined;

/**
 * Whether the Host app's `language` is a language tag, as Intl, which joins
 * lists and writes dates in it, throws on one that isn't, such as `en_US`. One
 * that isn't is said on the console once, by every editor on the page.
 */
const isLanguageTag = (language: string) => {
  try {
    Intl.getCanonicalLocales(language);
    return true;
  } catch {
    if (refusedLanguage !== language) {
      refusedLanguage = language;
      console.error(
        `<mail-quilt> left out strings.language, as it isn't a language tag such as en or pt-BR: ${JSON.stringify(language)}`
      );
    }
    return false;
  }
};

/**
 * Reads `strings()` each time, so a change to it shows on the next update.
 * The English is kept for a text that isn't a string, and for a `language`
 * that isn't a language tag.
 */
export const createText =
  (strings: () => MailQuiltStrings | undefined): Text =>
  (id, values) => {
    const replaced = strings()?.[id];
    const isUsable =
      typeof replaced === "string" &&
      (id !== "language" || isLanguageTag(replaced));
    return fill(isUsable ? replaced : STRINGS[id], values);
  };
