import * as v from "valibot";

import {
  BORDER_FIELDS,
  borderEntries,
  borderStyles,
  paddingEntries,
  paddingFields,
  paddingStyles,
} from "./box-settings.js";
import type { Column } from "./document.js";
import { BACKGROUND_COLOR_FIELD } from "./settings-fields.js";
import type { SettingsField } from "./settings-fields.js";
import { colorSchema } from "./value-schemas.js";

/** Where a Column's Blocks sit when it's shorter than its Row. */
const VERTICAL_ALIGN_OPTIONS = [
  { labelId: "verticalAlign.top", value: "top" },
  { labelId: "verticalAlign.middle", value: "middle" },
  { labelId: "verticalAlign.bottom", value: "bottom" },
] as const;

export const columnPropsSchema = v.strictObject({
  backgroundColor: v.optional(colorSchema),
  ...paddingEntries,
  ...borderEntries,
  verticalAlign: v.optional(
    v.picklist(VERTICAL_ALIGN_OPTIONS.map(({ value }) => value))
  ),
});

/**
 * A Column's props, as its schema checks them.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export type ColumnProps = v.InferOutput<typeof columnPropsSchema>;

/**
 * The settings fields for a Column.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const COLUMN_SETTINGS_FIELDS: readonly SettingsField[] = [
  BACKGROUND_COLOR_FIELD,
  ...paddingFields(0),
  {
    default: "top",
    invalidMessageId: "invalid.verticalAlign",
    key: "verticalAlign",
    labelId: "field.verticalAlign",
    options: VERTICAL_ALIGN_OPTIONS,
    type: "select",
  },
  ...BORDER_FIELDS,
];

/**
 * A Column's CSS, for both the canvas and the email output, apart from its
 * alignment, which each draws its own way. Its props must be valid, as in a
 * loaded document, because they're not checked again here.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const columnStyles = ({
  props,
}: Pick<Column, "props">): Record<string, string> => {
  const { backgroundColor, ...rest } = props as ColumnProps;
  return {
    ...(backgroundColor === undefined
      ? {}
      : { "background-color": backgroundColor }),
    ...paddingStyles(rest),
    ...borderStyles(rest),
  };
};
