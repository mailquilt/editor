import * as v from "valibot";

import type { EmailSettings } from "./document.js";
import { BACKGROUND_COLOR_FIELD, pixelField } from "./settings-fields.js";
import type { SettingsField } from "./settings-fields.js";
import { colorSchema, pixelSchema } from "./value-schemas.js";

/** Wider than any inbox shows, so a mistyped width is refused. */
const MAX_EMAIL_WIDTH = 1200;

export const emailSettingsSchema = v.strictObject({
  backgroundColor: colorSchema,
  // Font names only, as both outputs put it in CSS, where a ; or : would add
  // rules of its own. A quote has to close, or the rest of the style would be
  // read as part of the name. With no name at all, the export has no font.
  fontFamily: v.pipe(
    v.string(),
    v.regex(
      /^(?=.*\w)(?:[\w ,-]|'[\w ,"-]*'|"[\w ,'-]*")*$/u,
      "Must be a list of font names"
    )
  ),
  language: v.optional(v.string()),
  preheader: v.optional(v.string()),
  width: pixelSchema(MAX_EMAIL_WIDTH),
}) satisfies v.GenericSchema<unknown, EmailSettings>;

/**
 * A language a person sets has to be a code, because a screen reader reads the
 * email by it. A saved one isn't held to this: refusing it would keep the email
 * from opening, so nobody could fix it, and the renderer escapes whatever it is.
 * A subtag can be one letter, as in en-x-pirate, where it starts a private one.
 */
export const newLanguageSettingsSchema = v.strictObject({
  ...emailSettingsSchema.entries,
  language: v.optional(
    v.pipe(
      v.string(),
      v.regex(
        /^[A-Za-z]{2,3}(?:-[A-Za-z\d]{1,8})*$/u,
        "Must be a language code such as en or pt-BR"
      )
    )
  ),
});

/**
 * The settings panel's fields for the email.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const EMAIL_SETTINGS_FIELDS: readonly SettingsField[] = [
  pixelField("width", "Width", { max: MAX_EMAIL_WIDTH }),
  BACKGROUND_COLOR_FIELD,
  {
    invalidMessage: "Choose a font from the list.",
    key: "fontFamily",
    label: "Font",
    options: [
      { label: "Arial", value: "Arial, Helvetica, sans-serif" },
      { label: "Courier New", value: "'Courier New', Courier, monospace" },
      { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
      { label: "Tahoma", value: "Tahoma, Verdana, sans-serif" },
      { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
      { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
    ],
    type: "select",
  },
  {
    description: "The short text inboxes show after the subject.",
    invalidMessage: "Use plain text.",
    key: "preheader",
    label: "Preheader",
    type: "text",
  },
  {
    description: "A language code, such as en or pt-BR.",
    invalidMessage: "Use a language code such as en or pt-BR.",
    key: "language",
    label: "Language",
    type: "text",
  },
];
