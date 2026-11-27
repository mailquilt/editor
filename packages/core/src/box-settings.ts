import * as v from "valibot";

import { colorField, pixelField } from "./settings-fields.js";
import type { SettingsField } from "./settings-fields.js";
import { colorSchema, pixelSchema } from "./value-schemas.js";

// The settings a Block, a Row or a Column has around its content: padding, a
// background, a border and, for a Block, corners. Flat props, as a Row's
// padding has always been.

/** As much room as padding can take on one side. */
export const MAX_PADDING = 200;

export const MAX_BORDER_WIDTH = 20;

/** Past half a Block's height, more rounds it no further. */
export const MAX_CORNERS = 100;

const PADDING_SIDES = ["Top", "Right", "Bottom", "Left"] as const;

const paddingSchema = v.optional(
  v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(MAX_PADDING))
);

export const paddingEntries = {
  paddingBottom: paddingSchema,
  paddingLeft: paddingSchema,
  paddingRight: paddingSchema,
  paddingTop: paddingSchema,
};

/** The border's styles, in the order a person picks from. */
export const BORDER_STYLES = ["solid", "dashed", "dotted"] as const;

export const borderEntries = {
  borderColor: v.optional(colorSchema),
  borderStyle: v.optional(v.picklist(BORDER_STYLES)),
  borderWidth: v.optional(pixelSchema(MAX_BORDER_WIDTH)),
};

/**
 * Every Block's Box. Its background has a name of its own, as a Button's
 * `backgroundColor` is its fill.
 */
export const blockBoxEntries = {
  ...paddingEntries,
  ...borderEntries,
  borderRadius: v.optional(
    v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(MAX_CORNERS))
  ),
  boxBackgroundColor: v.optional(colorSchema),
};

/** What a border is drawn in until a person picks its style or color. */
export const BORDER_LOOK = { color: "#000000", style: "solid" } as const;

interface BoxProps {
  paddingTop?: number | undefined;
  paddingRight?: number | undefined;
  paddingBottom?: number | undefined;
  paddingLeft?: number | undefined;
  borderWidth?: number | undefined;
  borderStyle?: (typeof BORDER_STYLES)[number] | undefined;
  borderColor?: string | undefined;
}

/** Each side's padding that's set, as CSS. */
export const paddingStyles = (props: BoxProps) => {
  const styles: Record<string, string> = {};
  for (const side of PADDING_SIDES) {
    const pixels = props[`padding${side}`];
    if (pixels !== undefined) {
      styles[`padding-${side.toLowerCase()}`] = `${pixels}px`;
    }
  }
  return styles;
};

/** The border as one CSS value, once it has a width. */
export const borderValue = ({
  borderColor = BORDER_LOOK.color,
  borderStyle = BORDER_LOOK.style,
  borderWidth,
}: BoxProps) =>
  borderWidth === undefined
    ? undefined
    : `${borderWidth}px ${borderStyle} ${borderColor}`;

/** The border, as CSS, once it has a width. */
export const borderStyles = (props: BoxProps): Record<string, string> => {
  const border = borderValue(props);
  return border === undefined ? {} : { border };
};

/** Each side's padding, which shows `fallback` while it isn't set. */
export const paddingFields = (fallback: number): readonly SettingsField[] =>
  PADDING_SIDES.map((side) =>
    pixelField(`padding${side}`, `field.padding${side}`, {
      fallback,
      max: MAX_PADDING,
      min: 0,
    })
  );

/** A border's width, style and color. */
export const BORDER_FIELDS: readonly SettingsField[] = [
  pixelField("borderWidth", "field.borderWidth", { max: MAX_BORDER_WIDTH }),
  {
    default: BORDER_LOOK.style,
    invalidMessageId: "invalid.borderStyle",
    key: "borderStyle",
    labelId: "field.borderStyle",
    options: BORDER_STYLES.map((value) => ({
      labelId: `borderStyle.${value}`,
      value,
    })),
    type: "select",
  },
  colorField({
    fallback: BORDER_LOOK.color,
    key: "borderColor",
    labelId: "field.borderColor",
  }),
];
