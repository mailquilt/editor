import * as v from "valibot";

import type { EmailSettings, EmailStyle } from "./document.js";
import { MERGE_TAG } from "./rich-text.js";
import { BACKGROUND_COLOR_FIELD, pixelField } from "./settings-fields.js";
import type { SettingsField } from "./settings-fields.js";
import {
  colorSchema,
  fontFamilyNames,
  fontFamilySchema,
  fontSizeSchema,
  pixelSchema,
  plainObject,
  solidColorSchema,
  webFontNameSchema,
  webFontUrlSchema,
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

/** Font names are case-insensitive in CSS. */
const sameFontName = (one: string, other: string) =>
  one.toLowerCase() === other.toLowerCase();

const webFontSchema = v.strictObject({
  name: webFontNameSchema,
  url: webFontUrlSchema,
});

/**
 * Whether a font's name and URL are ones the email can store, as the editor
 * checks the Host app's fonts before offering them.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const isWebFont = (font: { name: unknown; url: unknown }) =>
  v.is(webFontSchema, { name: font.name, url: font.url });

/**
 * Whether a font family is one the email's settings take.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const isFontFamily = (value: unknown) => v.is(fontFamilySchema, value);

const webFontsSchema = v.pipe(
  v.array(v.pipe(v.unknown(), plainObject, webFontSchema)),
  v.check(
    (fonts) =>
      fonts.every(
        ({ name }, index) =>
          fonts.findIndex((font) => sameFontName(font.name, name)) === index
      ),
    "An email can have each web font only once"
  )
);

export const emailSettingsSchema = v.strictObject({
  backgroundColor: colorSchema,
  fontFamily: fontFamilySchema,
  fonts: v.optional(webFontsSchema),
  language: v.optional(v.string()),
  preheader: v.optional(v.string()),
  style: v.optional(v.pipe(v.unknown(), plainObject, emailStyleSchema)),
  width: pixelSchema(MAX_EMAIL_WIDTH),
}) satisfies v.GenericSchema<unknown, EmailSettings>;

/**
 * The settings with only the web fonts their body or heading font names, and
 * no `fonts` once none is left, so the email holds, and the export loads, only
 * the fonts it uses.
 */
export const withUsedFonts = (settings: EmailSettings): EmailSettings => {
  const { fonts, ...rest } = settings;
  const named = [
    settings.fontFamily,
    settings.style?.headingFontFamily ?? "",
  ].flatMap(fontFamilyNames);
  const used = fonts?.filter(({ name }) =>
    named.some((family) => sameFontName(family, name))
  );
  return used?.length ? { ...rest, fonts: used } : rest;
};

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
  pixelField("width", "field.width", { max: MAX_EMAIL_WIDTH }),
  BACKGROUND_COLOR_FIELD,
  {
    invalidMessageId: "invalid.font",
    key: "fontFamily",
    labelId: "field.font",
    options: [
      { labelId: "font.arial", value: "Arial, Helvetica, sans-serif" },
      {
        labelId: "font.courierNew",
        value: "'Courier New', Courier, monospace",
      },
      { labelId: "font.georgia", value: "Georgia, 'Times New Roman', serif" },
      { labelId: "font.tahoma", value: "Tahoma, Verdana, sans-serif" },
      {
        labelId: "font.timesNewRoman",
        value: "'Times New Roman', Times, serif",
      },
      { labelId: "font.verdana", value: "Verdana, Geneva, sans-serif" },
    ],
    type: "select",
  },
  {
    descriptionId: "field.preheader.description",
    invalidMessageId: "invalid.preheader",
    key: "preheader",
    labelId: "field.preheader",
    type: "text",
  },
  {
    descriptionId: "field.language.description",
    invalidMessageId: "invalid.language",
    key: "language",
    labelId: "field.language",
    type: "text",
  },
];
