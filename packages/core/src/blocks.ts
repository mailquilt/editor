import * as v from "valibot";

import {
  BORDER_FIELDS,
  blockBoxEntries,
  borderStyles,
  MAX_CORNERS,
  paddingFields,
  paddingStyles,
} from "./box-settings.js";
import type { Block, EmailStyle } from "./document.js";
import {
  imageSrcSchema,
  linkHrefSchema,
  headingTextSchema,
  richTextSchema,
} from "./rich-text.js";
import { colorField, pixelField } from "./settings-fields.js";
import type { SettingsField } from "./settings-fields.js";
import { parseProps } from "./validation.js";
import {
  colorSchema,
  fontSizeSchema,
  MAX_FONT_SIZE,
  pixelSchema,
  solidColorSchema,
  wholePixelsSchema,
} from "./value-schemas.js";

/** The alignment dropdown, whose values are all the schema accepts. */
const ALIGN_OPTIONS = [
  { labelId: "align.left", value: "left" },
  { labelId: "align.center", value: "center" },
  { labelId: "align.right", value: "right" },
] as const;

const alignSchema = v.picklist(ALIGN_OPTIONS.map(({ value }) => value));

const alignField = (fallback: string): SettingsField => ({
  default: fallback,
  invalidMessageId: "invalid.alignment",
  key: "align",
  labelId: "field.alignment",
  options: ALIGN_OPTIONS,
  type: "select",
});

const fontSizeField = (fallback: number) =>
  pixelField("fontSize", "field.fontSize", { fallback, max: MAX_FONT_SIZE });

const LINK_FIELD: SettingsField = {
  descriptionId: "field.link.description",
  invalidMessageId: "invalid.link",
  key: "href",
  labelId: "field.link",
  type: "text",
};

/** One type of Block's part of the definition that lives in `core`. */
interface BlockDefinition<
  Props extends Record<string, unknown> = Record<string, unknown>,
> {
  label: string;
  defaults: Props;
  schema: v.GenericSchema<unknown, Props>;
  /** The settings panel's fields, whose defaults can depend on the properties. */
  fields: (props: Props) => readonly SettingsField[];
  /**
   * The Block's CSS, for both the canvas and the email output, from its own
   * props, then the Email style, then the built-in look.
   */
  styles: (props: Props, style: EmailStyle) => Record<string, string>;
}

/** Text's line height, as a multiple of its font size. */
const LINE_HEIGHT = 1.5;

/**
 * A text's line height in pixels, rounded up. Classic Outlook draws a thin line
 * under text whose line height is 1.5, and squeezes its lines (#95).
 */
const lineHeightFor = (fontSize: number) =>
  `${Math.ceil(fontSize * LINE_HEIGHT)}px`;

/** What a Text Block looks like until a person changes it. */
const TEXT_LOOK = { align: "left", color: "#000000", fontSize: 16 } as const;

const textBlockSchema = v.strictObject({
  ...blockBoxEntries,
  align: v.optional(alignSchema),
  color: v.optional(colorSchema),
  content: richTextSchema,
  fontSize: v.optional(fontSizeSchema),
});

type TextBlockProps = v.InferOutput<typeof textBlockSchema>;

const TEXT_FIELDS: readonly SettingsField[] = [
  alignField(TEXT_LOOK.align),
  colorField({ fallback: TEXT_LOOK.color }),
  fontSizeField(TEXT_LOOK.fontSize),
];

export const textBlock = {
  defaults: {
    content: { content: [{ type: "paragraph" }], type: "doc" },
  } satisfies TextBlockProps,
  fields: () => TEXT_FIELDS,
  label: "Text",
  schema: textBlockSchema,
  styles: (props, { textColor, textFontSize }) => {
    const {
      align = TEXT_LOOK.align,
      color = textColor ?? TEXT_LOOK.color,
      fontSize = textFontSize ?? TEXT_LOOK.fontSize,
    } = props;
    return {
      color,
      "font-size": `${fontSize}px`,
      "line-height": lineHeightFor(fontSize),
      "text-align": align,
    };
  },
} satisfies BlockDefinition<TextBlockProps>;

/** What a Heading looks like until a person changes it. */
const HEADING_LOOK = { align: "left", color: "#000000" } as const;

const HEADING_FONT_SIZES = { 1: 32, 2: 24, 3: 20 } as const;

/** The level dropdown, whose values are all the schema accepts. */
const LEVEL_OPTIONS = [
  { labelId: "level.1", value: 1 },
  { labelId: "level.2", value: 2 },
  { labelId: "level.3", value: 3 },
] as const;

const headingBlockSchema = v.strictObject({
  ...blockBoxEntries,
  align: v.optional(alignSchema),
  color: v.optional(colorSchema),
  content: headingTextSchema,
  fontSize: v.optional(fontSizeSchema),
  level: v.picklist(LEVEL_OPTIONS.map(({ value }) => value)),
});

type HeadingBlockProps = v.InferOutput<typeof headingBlockSchema>;

const headingFields = (fontSize: number): readonly SettingsField[] => [
  {
    invalidMessageId: "invalid.level",
    key: "level",
    labelId: "field.level",
    options: LEVEL_OPTIONS,
    type: "select",
  },
  alignField(HEADING_LOOK.align),
  colorField({ fallback: HEADING_LOOK.color }),
  fontSizeField(fontSize),
];

/** One list for each level, as the font size a field shows depends on it. */
const HEADING_FIELDS = {
  1: headingFields(HEADING_FONT_SIZES[1]),
  2: headingFields(HEADING_FONT_SIZES[2]),
  3: headingFields(HEADING_FONT_SIZES[3]),
};

const headingBlock = {
  defaults: {
    content: { content: [{ type: "paragraph" }], type: "doc" },
    level: 1,
  } satisfies HeadingBlockProps,
  fields: ({ level }) => HEADING_FIELDS[level],
  label: "Heading",
  schema: headingBlockSchema,
  styles: (props, style) => {
    const {
      align = HEADING_LOOK.align,
      color = style.textColor ?? HEADING_LOOK.color,
      level,
    } = props;
    const fontSize =
      props.fontSize ??
      style[`heading${level}FontSize`] ??
      HEADING_FONT_SIZES[level];
    return {
      color,
      "font-size": `${fontSize}px`,
      "font-weight": "700",
      "line-height": lineHeightFor(fontSize),
      "text-align": align,
    };
  },
} satisfies BlockDefinition<HeadingBlockProps>;

/** What a Button looks like until a person changes it. */
const BUTTON_LOOK = {
  align: "left",
  backgroundColor: "#2563eb",
  color: "#ffffff",
} as const;

const buttonBlockSchema = v.strictObject({
  ...blockBoxEntries,
  align: v.optional(alignSchema),
  backgroundColor: v.optional(solidColorSchema),
  color: v.optional(colorSchema),
  href: v.optional(linkHrefSchema),
  // Plain text, because the whole Button is the link.
  // Not blank: \s is the white space trim() removes.
  label: v.pipe(v.string(), v.regex(/\S/u, "A Button needs a label")),
});

type ButtonBlockProps = v.InferOutput<typeof buttonBlockSchema>;

const BUTTON_FIELDS: readonly SettingsField[] = [
  {
    invalidMessageId: "invalid.buttonLabel",
    key: "label",
    labelId: "field.buttonLabel",
    type: "text",
  },
  LINK_FIELD,
  colorField({
    fallback: BUTTON_LOOK.backgroundColor,
    invalidMessageId: "invalid.solidColor",
    key: "backgroundColor",
    labelId: "field.backgroundColor",
  }),
  colorField({ fallback: BUTTON_LOOK.color, labelId: "field.textColor" }),
  alignField(BUTTON_LOOK.align),
];

const buttonBlock = {
  defaults: { label: "Button" } satisfies ButtonBlockProps,
  fields: () => BUTTON_FIELDS,
  label: "Button",
  schema: buttonBlockSchema,
  styles: (props, style) => {
    const {
      align = BUTTON_LOOK.align,
      backgroundColor = style.buttonBackgroundColor ??
        BUTTON_LOOK.backgroundColor,
      color = BUTTON_LOOK.color,
    } = props;
    const { textFontSize } = style;
    // Corners in its Box shape the Button itself, over Email style's.
    const buttonBorderRadius = props.borderRadius ?? style.buttonBorderRadius;
    return {
      "background-color": backgroundColor,
      color,
      "text-align": align,
      // Only when set, as without them a Button has MJML's corners and the
      // size every Block shares.
      ...(buttonBorderRadius === undefined
        ? {}
        : { "border-radius": `${buttonBorderRadius}px` }),
      ...(textFontSize === undefined
        ? {}
        : { "font-size": `${textFontSize}px` }),
    };
  },
} satisfies BlockDefinition<ButtonBlockProps>;

const hasAltText = (alt: unknown) =>
  typeof alt === "string" && alt.trim() !== "";

const imageBlockSchema = v.pipe(
  v.strictObject({
    ...blockBoxEntries,
    alt: v.optional(v.string()),
    href: v.optional(linkHrefSchema),
    // Optional, because a new Image has no URL until a person gives it one.
    src: v.optional(imageSrcSchema),
    // No maximum, as MJML and the canvas both stop at the Column's width.
    width: v.optional(wholePixelsSchema),
  }),
  // Alt text is all that can name a link around an image.
  v.check(
    ({ alt, href }) => href === undefined || hasAltText(alt),
    "A linked Image needs alt text"
  )
);

type ImageBlockProps = v.InferOutput<typeof imageBlockSchema>;

const imageFields = (link: SettingsField): readonly SettingsField[] => [
  {
    descriptionId: "field.imageUrl.description",
    invalidMessageId: "invalid.imageUrl",
    key: "src",
    labelId: "field.imageUrl",
    type: "text",
  },
  {
    descriptionId: "field.altText.description",
    invalidMessageId: "invalid.altText",
    key: "alt",
    labelId: "field.altText",
    type: "text",
  },
  {
    ...pixelField("width", "field.width"),
    descriptionId: "field.imageWidth.description",
  },
  link,
];

const IMAGE_FIELDS = imageFields(LINK_FIELD);

const IMAGE_FIELDS_WITHOUT_ALT = imageFields({
  ...LINK_FIELD,
  descriptionId: "field.link.needsAltText",
  disabled: true,
});

const imageBlock = {
  defaults: {} satisfies ImageBlockProps,
  fields: ({ alt }) =>
    hasAltText(alt) ? IMAGE_FIELDS : IMAGE_FIELDS_WITHOUT_ALT,
  label: "Image",
  schema: imageBlockSchema,
  styles: ({ width }): Record<string, string> =>
    width === undefined ? {} : { width: `${width}px` },
} satisfies BlockDefinition<ImageBlockProps>;

/** What a Divider looks like until a person changes it. */
const DIVIDER_LOOK = { color: "#d4d4d8", thickness: 1 } as const;

const MAX_DIVIDER_THICKNESS = 100;

const dividerBlockSchema = v.strictObject({
  ...blockBoxEntries,
  color: v.optional(colorSchema),
  thickness: v.optional(pixelSchema(MAX_DIVIDER_THICKNESS)),
});

type DividerBlockProps = v.InferOutput<typeof dividerBlockSchema>;

const DIVIDER_FIELDS: readonly SettingsField[] = [
  colorField({ fallback: DIVIDER_LOOK.color }),
  pixelField("thickness", "field.thickness", {
    fallback: DIVIDER_LOOK.thickness,
    max: MAX_DIVIDER_THICKNESS,
  }),
];

const dividerBlock = {
  defaults: {} satisfies DividerBlockProps,
  fields: () => DIVIDER_FIELDS,
  label: "Divider",
  schema: dividerBlockSchema,
  styles: ({
    color = DIVIDER_LOOK.color,
    thickness = DIVIDER_LOOK.thickness,
  }) => ({
    "border-color": color,
    "border-width": `${thickness}px`,
  }),
} satisfies BlockDefinition<DividerBlockProps>;

const DEFAULT_SPACER_HEIGHT = 24;

const MAX_SPACER_HEIGHT = 1000;

const spacerBlockSchema = v.strictObject({
  ...blockBoxEntries,
  height: v.optional(pixelSchema(MAX_SPACER_HEIGHT)),
});

type SpacerBlockProps = v.InferOutput<typeof spacerBlockSchema>;

const SPACER_FIELDS: readonly SettingsField[] = [
  pixelField("height", "field.height", {
    fallback: DEFAULT_SPACER_HEIGHT,
    max: MAX_SPACER_HEIGHT,
  }),
];

const spacerBlock = {
  defaults: {} satisfies SpacerBlockProps,
  fields: () => SPACER_FIELDS,
  label: "Spacer",
  schema: spacerBlockSchema,
  styles: ({ height = DEFAULT_SPACER_HEIGHT }) => ({ height: `${height}px` }),
} satisfies BlockDefinition<SpacerBlockProps>;

/**
 * The networks a Social Block has an icon for, in the order a person picks
 * from, each with its name. Each icon's file is named for its network, and its
 * name is its alt text.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const SOCIAL_NETWORKS = {
  bluesky: "Bluesky",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  pinterest: "Pinterest",
  threads: "Threads",
  tiktok: "TikTok",
  website: "Website",
  x: "X",
  youtube: "YouTube",
} as const;

/** What a Social Block looks like until a person changes it. */
const SOCIAL_LOOK = {
  align: "left",
  iconSize: 32,
  iconStyle: "color",
} as const;

const ICON_STYLE_OPTIONS = [
  { labelId: "iconStyle.color", value: "color" },
  { labelId: "iconStyle.white", value: "white" },
] as const;

/** At least 29px, Instagram's minimum. */
const ICON_SIZE_OPTIONS = [
  { labelId: "iconSize.32", value: 32 },
  { labelId: "iconSize.40", value: 40 },
  { labelId: "iconSize.48", value: 48 },
] as const;

const socialBlockSchema = v.strictObject({
  ...blockBoxEntries,
  align: v.optional(alignSchema),
  iconSize: v.optional(v.picklist(ICON_SIZE_OPTIONS.map(({ value }) => value))),
  iconStyle: v.optional(
    v.picklist(ICON_STYLE_OPTIONS.map(({ value }) => value))
  ),
  // In the person's order. A link without a URL is kept, and left out of the email.
  links: v.pipe(
    v.array(
      v.strictObject({
        network: v.picklist(
          Object.keys(SOCIAL_NETWORKS) as (keyof typeof SOCIAL_NETWORKS)[]
        ),
        url: v.optional(linkHrefSchema),
      })
    ),
    v.check(
      (links) =>
        new Set(links.map(({ network }) => network)).size === links.length,
      "A Social Block can link each network only once"
    )
  ),
});

type SocialBlockProps = v.InferOutput<typeof socialBlockSchema>;

const SOCIAL_FIELDS: readonly SettingsField[] = [
  {
    allAddedId: "field.socialLinks.allAdded",
    chooseLabelId: "field.socialLinks.choose",
    descriptionId: "field.socialLinks.description",
    invalidMessageId: "invalid.socialLinks",
    itemField: {
      invalidMessageId: "invalid.link",
      key: "url",
      labelId: "field.socialUrl",
      type: "text",
    },
    itemKey: "network",
    key: "links",
    labelId: "field.socialLinks",
    options: Object.keys(SOCIAL_NETWORKS).map((value) => ({
      labelId: `network.${value}`,
      value,
    })),
    type: "list",
  },
  {
    default: SOCIAL_LOOK.iconStyle,
    descriptionId: "field.iconStyle.description",
    invalidMessageId: "invalid.iconStyle",
    key: "iconStyle",
    labelId: "field.iconStyle",
    options: ICON_STYLE_OPTIONS,
    type: "select",
  },
  {
    default: SOCIAL_LOOK.iconSize,
    invalidMessageId: "invalid.iconSize",
    key: "iconSize",
    labelId: "field.iconSize",
    options: ICON_SIZE_OPTIONS,
    type: "select",
  },
  alignField(SOCIAL_LOOK.align),
];

const socialBlock = {
  defaults: { links: [] } satisfies SocialBlockProps,
  fields: () => SOCIAL_FIELDS,
  label: "Social",
  schema: socialBlockSchema,
  styles: ({ align = SOCIAL_LOOK.align }) => ({ "text-align": align }),
} satisfies BlockDefinition<SocialBlockProps>;

/** The space around a Block's content, in px, on each side it doesn't set. */
const BLOCK_PADDING = 16;

const BLOCK_SIDES = ["Top", "Right", "Bottom", "Left"] as const;

/** What a Block's padding is on a side it doesn't set: none for a Spacer. */
const paddingFallback = (type: string) =>
  type === "spacer" ? 0 : BLOCK_PADDING;

type Side = (typeof BLOCK_SIDES)[number];

/** A Block's padding on each side, in px, its own or the built-in. */
const blockPadding = (
  props: Partial<Record<`padding${Side}`, number>>,
  type: string
) =>
  Object.fromEntries(
    BLOCK_SIDES.map((side) => [
      side,
      props[`padding${side}`] ?? paddingFallback(type),
    ])
  ) as Record<Side, number>;

/**
 * A Social Block's icons, with each one's size and the gap between them, which
 * is half that size. Half the gap is on every side of each icon, so lines that
 * wrap have the gap between them and each line ends at the same place, whatever
 * the alignment. The Block's padding is that much less on every side, so the
 * icons are as far from its edges as a Block's content is, down to none.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const socialIcons = (props: SocialBlockProps) => {
  const { iconSize = SOCIAL_LOOK.iconSize, iconStyle = SOCIAL_LOOK.iconStyle } =
    props;
  const gap = iconSize / 2;
  const padding = blockPadding(props, "social");
  const sides = BLOCK_SIDES.map(
    (side) => `${Math.max(padding[side] - gap / 2, 0)}px`
  );
  return {
    // One value while every side is the same, as most are.
    blockPadding: new Set(sides).size === 1 ? sides[0] : sides.join(" "),
    iconPadding: gap / 2,
    size: iconSize,
    style: iconStyle,
  };
};

/** Each type of Block, in the order the palette shows them. */
const BLOCKS = [
  ["text", textBlock],
  ["heading", headingBlock],
  ["image", imageBlock],
  ["button", buttonBlock],
  ["divider", dividerBlock],
  ["spacer", spacerBlock],
  ["social", socialBlock],
] as const;

/**
 * Each type's definition, found by its type. Each one takes only its own type's
 * props, which is safe as they're checked against its schema before they're
 * used, as a loaded email's and a Command's are.
 */
export const blockDefinitions = new Map(
  BLOCKS as unknown as readonly (readonly [string, BlockDefinition])[]
);

/**
 * Each type of Block's props, as its schema checks them.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export type BlockProps = {
  [Entry in (typeof BLOCKS)[number] as Entry[0]]: v.InferOutput<
    Entry[1]["schema"]
  >;
};

/** Each type of Block, from the one list of them. */
export type BlockType = keyof BlockProps;

/** The types of Block a person can add, in the order the palette shows them. */
export const BLOCK_TYPES: readonly {
  readonly label: string;
  readonly type: BlockType;
}[] = BLOCKS.map(([type, { label }]) => ({ label, type }));

/**
 * What a person calls a type of Block.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const blockLabel = (type: string) =>
  blockDefinitions.get(type)?.label ?? type;

export const validateProps = (
  block: Pick<Block, "id" | "type">,
  props: unknown
) => {
  const definition = blockDefinitions.get(block.type);
  return definition
    ? parseProps(definition.schema, props, `Block "${block.id}"`)
    : {
        ok: false as const,
        reason: `Block "${block.id}" has unknown type "${block.type}"`,
      };
};

/**
 * What every Block shares, on the canvas and in the email output: the space
 * around its content, and the size and height of its text unless it sets its own.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const EMAIL_LOOK = {
  blockPadding: `${BLOCK_PADDING}px`,
  fontSize: `${TEXT_LOOK.fontSize}px`,
  lineHeight: String(LINE_HEIGHT),
} as const;

/**
 * A Block's CSS, for both the canvas and the email output, from its own props,
 * then the email's Email style, then the built-in look. Its props must be
 * valid, as in a loaded document, because they're not checked again here.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const blockStyles = (
  { props, type }: Pick<Block, "props" | "type">,
  style: EmailStyle = {}
) => blockDefinitions.get(type)?.styles(props, style) ?? {};

/**
 * A Block's padding on every side as one CSS value, its own or the built-in,
 * for the canvas, which draws every side.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const blockPaddingCss = ({
  props,
  type,
}: Pick<Block, "props" | "type">) => {
  const padding = blockPadding(props as BlockProps["text"], type);
  const sides = BLOCK_SIDES.map((side) => `${padding[side]}px`);
  return new Set(sides).size === 1 ? (sides[0] as string) : sides.join(" ");
};

/**
 * The fields of a Block's Box: its padding, background, border and
 * corners. A Block's own fields are `blockSettingsFields`'.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const blockBoxFields = (type: string): readonly SettingsField[] => [
  ...paddingFields(paddingFallback(type)),
  colorField({
    key: "boxBackgroundColor",
    labelId: "field.boxBackgroundColor",
  }),
  ...BORDER_FIELDS,
  pixelField("borderRadius", "field.borderRadius", {
    fallback: 0,
    max: MAX_CORNERS,
    min: 0,
  }),
];

/**
 * A Block's Box as CSS, for both the canvas and the email output: the padding
 * of each side it sets, which is otherwise the built-in, and its background,
 * border and corners. A Button's corners are its own shape's, in
 * `blockStyles`, so they aren't the Box's.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const blockBoxStyles = ({
  props,
  type,
}: Pick<Block, "props" | "type">): Record<string, string> => {
  const box = props as BlockProps["text"];
  const { boxBackgroundColor, borderRadius } = box;
  return {
    ...paddingStyles(box),
    ...(boxBackgroundColor === undefined
      ? {}
      : { "background-color": boxBackgroundColor }),
    ...borderStyles(box),
    ...(borderRadius === undefined || type === "button"
      ? {}
      : { "border-radius": `${borderRadius}px` }),
  };
};

/**
 * The color of the links in a Text Block or Heading whose text is `textColor`.
 * A Block that sets its own text color keeps its links in it, as that color was
 * chosen for the Block's own background. Otherwise links are in the Email
 * style's link color, or else the text's.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const linkColor = (
  { color }: { color?: string | undefined },
  { linkColor: emailLinkColor }: EmailStyle,
  textColor: string
) => (color === undefined ? (emailLinkColor ?? textColor) : textColor);

/**
 * The settings panel's fields for a Block.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const blockSettingsFields = ({
  props,
  type,
}: Pick<Block, "props" | "type">) =>
  blockDefinitions.get(type)?.fields(props) ?? [];
