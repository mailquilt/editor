import * as v from "valibot";

import {
  paddingEntries,
  paddingFields,
  paddingStyles,
} from "./box-settings.js";
import { deviceEntries } from "./device-settings.js";
import type { Row } from "./document.js";
import { BACKGROUND_COLOR_FIELD } from "./settings-fields.js";
import type { SettingsField } from "./settings-fields.js";
import { colorSchema } from "./value-schemas.js";

export const rowPropsSchema = v.strictObject({
  backgroundColor: v.optional(colorSchema),
  ...paddingEntries,
  ...deviceEntries(),
  stackOnPhone: v.optional(v.boolean()),
});

/**
 * A Row's props, as its schema checks them.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export type RowProps = v.InferOutput<typeof rowPropsSchema>;

const ROW_FIELDS: readonly SettingsField[] = [
  BACKGROUND_COLOR_FIELD,
  ...paddingFields(0),
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
  return {
    ...(backgroundColor === undefined
      ? {}
      : { "background-color": backgroundColor }),
    ...paddingStyles(padding),
  };
};
