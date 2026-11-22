interface FieldBase {
  /** The property it sets. */
  key: string;
  label: string;
  /** Help that stays next to the control. */
  description?: string;
  /** What to do about a value the schema refuses. */
  invalidMessage: string;
  /** What the control shows while the property isn't set. */
  default?: boolean | number | string;
  /** Can't be used yet, with `description` saying why. */
  disabled?: boolean;
}

/** A field that holds text, such as a URL. */
type TextField = FieldBase & { type: "text" };

/**
 * One control in the settings panel. Fields are data, so that one panel can show
 * every Block, Row and email setting.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export type SettingsField = FieldBase &
  (
    | { type: "color" }
    | {
        /**
         * Items in the person's order, each an object keyed by its `itemKey`
         * property, whose value no two items share. A person adds an item for
         * one of `options` not yet used, removes one or moves one, and types
         * each item's `itemField`. A change sets the whole list.
         */
        type: "list";
        itemKey: string;
        /** What one item is called, in a sentence, such as "network". */
        itemName: string;
        itemField: TextField;
        options: readonly { label: string; value: string }[];
      }
    | { type: "number"; max?: number; min: number; unit: string }
    | {
        type: "select";
        options: readonly { label: string; value: number | string }[];
      }
    | { type: "text" }
    /** Yes or no, shown as a switch. */
    | { type: "toggle" }
  );

export const pixelField = (
  key: string,
  label: string,
  {
    fallback,
    max,
    min = 1,
  }: { fallback?: number; max?: number; min?: number } = {}
): SettingsField => ({
  default: fallback,
  invalidMessage:
    max === undefined
      ? `Use a whole number of pixels, ${min} or more.`
      : `Use a whole number from ${min} to ${max}.`,
  key,
  label,
  max,
  min,
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
