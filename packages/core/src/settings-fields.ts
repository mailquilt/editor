/**
 * A field's words are the IDs of the editor's strings, which hold its English
 * and which a Host app can replace, so the words a person reads are kept in one
 * place. Core's own messages, such as a refusal's reason, stay English, for
 * developers.
 */
interface FieldBase {
  /** The property it sets. */
  key: string;
  labelId: string;
  /** Help that stays next to the control. */
  descriptionId?: string;
  /**
   * What to do about a value the schema refuses. A number field's fills in
   * `{min}` and `{max}`.
   */
  invalidMessageId: string;
  /** What the control shows while the property isn't set. */
  default?: boolean | number | string;
  /** Can't be used yet, with its description saying why. */
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
    | ({
        /**
         * Items in the person's order, each an object with the text of each
         * of its `itemFields`. A person adds, removes or moves an item, and
         * types in its fields. A change sets the whole list.
         */
        type: "list";
        itemFields: readonly TextField[];
      } & (
        | {
            /**
             * Each item is for one of `options`, in its `itemKey` property,
             * which no two items share. A person adds an item for an option
             * not yet used.
             */
            itemKey: string;
            /** The menu of options not yet used. */
            chooseLabelId: string;
            /** Shown in place of that menu once every option is used. */
            allAddedId: string;
            options: readonly { labelId: string; value: string }[];
          }
        | {
            /**
             * Items are told apart by their position, and a person adds an
             * empty one with the button `addLabelId` names.
             */
            itemKey?: undefined;
            addLabelId: string;
            /**
             * An item's name until its first field has text, with its
             * `{position}`, such as "Link 2".
             */
            itemNameId: string;
          }
      ))
    | { type: "number"; max?: number; min: number; unit: "px" }
    | {
        type: "select";
        options: readonly { labelId: string; value: number | string }[];
      }
    | { type: "text" }
    /** Yes or no, shown as a switch. */
    | { type: "toggle" }
  );

export const pixelField = (
  key: string,
  labelId: string,
  {
    fallback,
    max,
    min = 1,
  }: { fallback?: number; max?: number; min?: number } = {}
): SettingsField => ({
  default: fallback,
  invalidMessageId:
    max === undefined ? "invalid.pixelsAtLeast" : "invalid.pixelsBetween",
  key,
  labelId,
  max,
  min,
  type: "number",
  unit: "px",
});

export const colorField = ({
  fallback,
  invalidMessageId = "invalid.color",
  key = "color",
  labelId = "field.color",
}: {
  fallback?: string;
  invalidMessageId?: string;
  key?: string;
  labelId?: string;
} = {}): SettingsField => ({
  default: fallback,
  invalidMessageId,
  key,
  labelId,
  type: "color",
});

export const BACKGROUND_COLOR_FIELD = colorField({
  key: "backgroundColor",
  labelId: "field.backgroundColor",
});
