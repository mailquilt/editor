import * as v from "valibot";

import type { Row } from "./document.js";
import { BACKGROUND_COLOR_FIELD } from "./settings-fields.js";
import type { SettingsField } from "./settings-fields.js";
import { colorSchema } from "./value-schemas.js";

export const rowPropsSchema = v.strictObject({
  backgroundColor: v.optional(colorSchema),
});

/**
 * The settings panel's fields for a Row.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const ROW_SETTINGS_FIELDS: readonly SettingsField[] = [
  BACKGROUND_COLOR_FIELD,
];

/**
 * A Row's CSS, for both the canvas and the email output. Its props must be
 * valid, as in a loaded document, because they're not checked again here.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const rowStyles = ({
  props,
}: Pick<Row, "props">): Record<string, string> => {
  const { backgroundColor } = props as v.InferOutput<typeof rowPropsSchema>;
  return backgroundColor === undefined
    ? {}
    : { "background-color": backgroundColor };
};
