import * as v from "valibot";

import type { Row } from "./document.js";
import { BACKGROUND_COLOR_FIELD, pixelField } from "./settings-fields.js";
import type { SettingsField } from "./settings-fields.js";
import { colorSchema } from "./value-schemas.js";

/** As much room as a Row's padding can take on one side. */
const MAX_ROW_PADDING = 200;

const paddingSchema = v.optional(
  v.pipe(
    v.number(),
    v.safeInteger(),
    v.minValue(0),
    v.maxValue(MAX_ROW_PADDING)
  )
);

export const rowPropsSchema = v.strictObject({
  backgroundColor: v.optional(colorSchema),
  hideOnPhone: v.optional(v.boolean()),
  paddingBottom: paddingSchema,
  paddingLeft: paddingSchema,
  paddingRight: paddingSchema,
  paddingTop: paddingSchema,
  stackOnPhone: v.optional(v.boolean()),
});

/**
 * A Row's props, as its schema checks them.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export type RowProps = v.InferOutput<typeof rowPropsSchema>;

const paddingField = (key: string, labelId: string) =>
  pixelField(key, labelId, { fallback: 0, max: MAX_ROW_PADDING, min: 0 });

const ROW_FIELDS: readonly SettingsField[] = [
  BACKGROUND_COLOR_FIELD,
  paddingField("paddingTop", "field.paddingTop"),
  paddingField("paddingRight", "field.paddingRight"),
  paddingField("paddingBottom", "field.paddingBottom"),
  paddingField("paddingLeft", "field.paddingLeft"),
  {
    default: false,
    descriptionId: "field.hideOnPhone.description",
    invalidMessageId: "invalid.toggle",
    key: "hideOnPhone",
    labelId: "field.hideOnPhone",
    type: "toggle",
  },
];

/** Columns only stack when there's more than one. */
const ROW_FIELDS_WITH_COLUMNS: readonly SettingsField[] = [
  ...ROW_FIELDS,
  {
    default: true,
    descriptionId: "field.stackOnPhone.description",
    invalidMessageId: "invalid.toggle",
    key: "stackOnPhone",
    labelId: "field.stackOnPhone",
    type: "toggle",
  },
];

/**
 * The settings panel's fields for a Row.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const rowSettingsFields = ({ columns }: Pick<Row, "columns">) =>
  columns.length > 1 ? ROW_FIELDS_WITH_COLUMNS : ROW_FIELDS;

/**
 * A Row's CSS, for both the canvas and the email output. Its props must be
 * valid, as in a loaded document, because they're not checked again here.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const rowStyles = ({
  props,
}: Pick<Row, "props">): Record<string, string> => {
  const { backgroundColor, ...padding } = props as RowProps;
  const styles: Record<string, string> =
    backgroundColor === undefined
      ? {}
      : { "background-color": backgroundColor };
  for (const side of ["Top", "Right", "Bottom", "Left"] as const) {
    const pixels = padding[`padding${side}`];
    if (pixels !== undefined) {
      styles[`padding-${side.toLowerCase()}`] = `${pixels}px`;
    }
  }
  return styles;
};
