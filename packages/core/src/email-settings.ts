import * as v from "valibot";

import type { EmailSettings, EmailStyle } from "./document.js";
import { MERGE_TAG } from "./rich-text.js";
import { BACKGROUND_COLOR_FIELD, pixelField } from "./settings-fields.js";
import type { SettingsField } from "./settings-fields.js";
import {
  colorSchema,
  fontFamilySchema,
  fontSizeSchema,
  pixelSchema,
  plainObject,
  solidColorSchema,
} from "./value-schemas.js";

/** Wider than any inbox shows, so a mistyped width is refused. */
const MAX_EMAIL_WIDTH = 1200;

/** Rounder than this, a button of any height is already a pill. */
const MAX_BUTTON_BORDER_RADIUS = 100;

const emailStyleSchema = v.strictObject({
  buttonBackgroundColor: v.optional(solidColorSchema),
  buttonBorderRadius: v.optional(
    v.pipe(
      v.number(),
      v.safeInteger(),
      v.minValue(0),
      v.maxValue(MAX_BUTTON_BORDER_RADIUS)
    )
  ),
  emailBackgroundColor: v.optional(colorSchema),
  heading1FontSize: v.optional(fontSizeSchema),
  heading2FontSize: v.optional(fontSizeSchema),
  heading3FontSize: v.optional(fontSizeSchema),
  headingFontFamily: v.optional(fontFamilySchema),
  linkColor: v.optional(colorSchema),
  textColor: v.optional(colorSchema),
  textFontSize: v.optional(fontSizeSchema),
}) satisfies v.GenericSchema<unknown, EmailStyle>;

export const emailSettingsSchema = v.strictObject({
  backgroundColor: colorSchema,
  fontFamily: fontFamilySchema,
  language: v.optional(v.string()),
  preheader: v.optional(v.string()),
  style: v.optional(v.pipe(v.unknown(), plainObject, emailStyleSchema)),
  width: pixelSchema(MAX_EMAIL_WIDTH),
}) satisfies v.GenericSchema<unknown, EmailSettings>;

/**
 * A language a person sets has to be a code, because a screen reader reads the
 * email by it, or one Merge Tag, which the sending tool fills with each
 * recipient's code. A saved one isn't held to this: refusing it would keep the
 * email from opening, so nobody could fix it, and the renderer escapes whatever
 * it is. A subtag can be one letter, as in en-x-pirate, where it starts a
 * private one.
 */
export const newLanguageSettingsSchema = v.strictObject({
  ...emailSettingsSchema.entries,
  language: v.optional(
    v.pipe(
      v.string(),
      v.regex(
        new RegExp(
          `^(?:[A-Za-z]{2,3}(?:-[A-Za-z\\d]{1,8})*|${MERGE_TAG.source})$`,
          "u"
        ),
        "Must be a language code such as en or pt-BR, or one Merge Tag"
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
    description: "A language code, such as en or pt-BR, or one Merge Tag.",
    invalidMessage:
      "Use a language code such as en or pt-BR, or one Merge Tag such as {{language}}.",
    key: "language",
    label: "Language",
    type: "text",
  },
];
