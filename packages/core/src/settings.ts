import * as v from "valibot";

import type { Row } from "./document.js";

interface FieldBase {
  /** The property it sets. */
  key: string;
  label: string;
  /** Help that stays next to the control. */
  description?: string;
  /** What to do about a value the schema refuses. */
  invalidMessage: string;
  /** What the control shows while the property isn't set. */
  default?: number | string;
}

/**
 * One control in the settings panel. Fields are data, so that one panel can show
 * every Block, Row and email setting.
 */
export type SettingsField = FieldBase &
  (
    | { type: "color" }
    | { type: "number"; max?: number; min: number; unit: string }
    | { type: "select"; options: readonly { label: string; value: string }[] }
    | { type: "text" }
  );

const INVALID_COLOR = "Use a color such as #ff0000, or rgb(255, 0, 0).";

/** Formats MJML accepts, so that an email that loads can also be exported. */
export const colorSchema = v.pipe(
  v.string(),
  v.regex(
    /^(?:#[\da-f]{3}(?:[\da-f]{3})?|rgb\(\d{1,3},\s?\d{1,3},\s?\d{1,3}\)|rgba\(\d{1,3},\s?\d{1,3},\s?\d{1,3},\s?\d(?:\.\d{1,3})?\))$/iu,
    "Must be a color written as #rgb, #rrggbb, rgb() or rgba()"
  )
);

export const emailSettingsSchema = v.strictObject({
  backgroundColor: colorSchema,
  fontFamily: v.string(),
  language: v.optional(
    v.pipe(
      v.string(),
      // The shape of a language tag, because a screen reader reads the email by it.
      v.regex(
        /^[a-z]{2,3}(?:-[a-z\d]{2,8})*$/iu,
        "Must be a language code such as en or pt-BR"
      )
    )
  ),
  preheader: v.optional(v.string()),
  width: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
});

export const EMAIL_SETTINGS_FIELDS: readonly SettingsField[] = [
  {
    invalidMessage: "Use a whole number of pixels, 1 or more.",
    key: "width",
    label: "Width",
    min: 1,
    type: "number",
    unit: "px",
  },
  {
    invalidMessage: INVALID_COLOR,
    key: "backgroundColor",
    label: "Background color",
    type: "color",
  },
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

export const rowPropsSchema = v.strictObject({
  backgroundColor: v.optional(colorSchema),
});

export const ROW_SETTINGS_FIELDS: readonly SettingsField[] = [
  {
    invalidMessage: INVALID_COLOR,
    key: "backgroundColor",
    label: "Background color",
    type: "color",
  },
];

/** A Row's CSS, for both the canvas and the email output. */
export const rowStyles = ({
  props,
}: Pick<Row, "props">): Record<string, string> => {
  const { backgroundColor } = props as v.InferOutput<typeof rowPropsSchema>;
  return backgroundColor === undefined
    ? {}
    : { "background-color": backgroundColor };
};
