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
  /** Can't be used yet, with `description` saying why. */
  disabled?: boolean;
}

/**
 * One control in the settings panel. Fields are data, so that one panel can show
 * every Block, Row and email setting.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export type SettingsField = FieldBase &
  (
    | { type: "color" }
    | { type: "number"; max?: number; min: number; unit: string }
    | {
        type: "select";
        options: readonly { label: string; value: number | string }[];
      }
    | { type: "text" }
  );

export const pixelField = (
  key: string,
  label: string,
  { fallback, max }: { fallback?: number; max?: number } = {}
): SettingsField => ({
  default: fallback,
  invalidMessage:
    max === undefined
      ? "Use a whole number of pixels, 1 or more."
      : `Use a whole number from 1 to ${max}.`,
  key,
  label,
  max,
  min: 1,
  type: "number",
  unit: "px",
});

/** As `colorSchema` takes them, with an alpha as 0.5 rather than .5. */
const INVALID_COLOR =
  "Use a color such as #ff0000, rgb(255, 0, 0) or rgba(255, 0, 0, 0.5).";

export const INVALID_SOLID_COLOR =
  "Use a solid color such as #ff0000, or rgb(255, 0, 0).";

export const colorField = ({
  fallback,
  invalidMessage = INVALID_COLOR,
  key = "color",
  label = "Color",
}: {
  fallback?: string;
  invalidMessage?: string;
  key?: string;
  label?: string;
} = {}): SettingsField => ({
  default: fallback,
  invalidMessage,
  key,
  label,
  type: "color",
});

export const BACKGROUND_COLOR_FIELD = colorField({
  key: "backgroundColor",
  label: "Background color",
});
