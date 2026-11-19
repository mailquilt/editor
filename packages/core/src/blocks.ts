import * as v from "valibot";

import type { Block } from "./document.js";
import {
  imageSrcSchema,
  INVALID_IMAGE_URL,
  INVALID_LINK,
  linkHrefSchema,
  richTextSchema,
} from "./rich-text.js";
import {
  colorField,
  INVALID_SOLID_COLOR,
  pixelField,
} from "./settings-fields.js";
import type { SettingsField } from "./settings-fields.js";
import { parseProps } from "./validation.js";
import {
  colorSchema,
  pixelSchema,
  solidColorSchema,
  wholePixelsSchema,
} from "./value-schemas.js";

const MAX_FONT_SIZE = 200;

/** The alignment dropdown, whose values are all the schema accepts. */
const ALIGN_OPTIONS = [
  { label: "Left", value: "left" },
  { label: "Center", value: "center" },
  { label: "Right", value: "right" },
] as const;

const alignSchema = v.picklist(ALIGN_OPTIONS.map(({ value }) => value));

const fontSizeSchema = pixelSchema(MAX_FONT_SIZE);

const alignField = (fallback: string): SettingsField => ({
  default: fallback,
  invalidMessage: "Choose an alignment from the list.",
  key: "align",
  label: "Alignment",
  options: ALIGN_OPTIONS,
  type: "select",
});

const fontSizeField = (fallback: number) =>
  pixelField("fontSize", "Font size", { fallback, max: MAX_FONT_SIZE });

const LINK_FIELD: SettingsField = {
  description: "A URL, or a Merge Tag such as {{cta_url}}.",
  invalidMessage: INVALID_LINK,
  key: "href",
  label: "Link",
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
  /** The Block's CSS, for both the canvas and the email output. */
  styles: (props: Props) => Record<string, string>;
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
  styles: ({
    align = TEXT_LOOK.align,
    color = TEXT_LOOK.color,
    fontSize = TEXT_LOOK.fontSize,
  }) => ({
    color,
    "font-size": `${fontSize}px`,
    "line-height": lineHeightFor(fontSize),
    "text-align": align,
  }),
} satisfies BlockDefinition<TextBlockProps>;

/** What a Heading looks like until a person changes it. */
const HEADING_LOOK = { align: "left", color: "#000000" } as const;

const HEADING_FONT_SIZES = { 1: 32, 2: 24, 3: 20 } as const;

/** The level dropdown, whose values are all the schema accepts. */
const LEVEL_OPTIONS = [
  { label: "Heading 1", value: 1 },
  { label: "Heading 2", value: 2 },
  { label: "Heading 3", value: 3 },
] as const;

const headingBlockSchema = v.strictObject({
  align: v.optional(alignSchema),
  color: v.optional(colorSchema),
  content: richTextSchema,
  fontSize: v.optional(fontSizeSchema),
  level: v.picklist(LEVEL_OPTIONS.map(({ value }) => value)),
});

type HeadingBlockProps = v.InferOutput<typeof headingBlockSchema>;

const headingFields = (fontSize: number): readonly SettingsField[] => [
  {
    invalidMessage: "Choose a level from the list.",
    key: "level",
    label: "Level",
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
  styles: ({
    align = HEADING_LOOK.align,
    color = HEADING_LOOK.color,
    level,
    fontSize = HEADING_FONT_SIZES[level],
  }) => ({
    color,
    "font-size": `${fontSize}px`,
    "font-weight": "700",
    "line-height": lineHeightFor(fontSize),
    "text-align": align,
  }),
} satisfies BlockDefinition<HeadingBlockProps>;

/** What a Button looks like until a person changes it. */
const BUTTON_LOOK = {
  align: "left",
  backgroundColor: "#2563eb",
  color: "#ffffff",
} as const;

const buttonBlockSchema = v.strictObject({
  align: v.optional(alignSchema),
  backgroundColor: v.optional(solidColorSchema),
  color: v.optional(colorSchema),
  href: v.optional(linkHrefSchema),
  // Plain text, because the whole Button is the link.
  label: v.pipe(
    v.string(),
    v.check((label) => label.trim() !== "", "A Button needs a label")
  ),
});

type ButtonBlockProps = v.InferOutput<typeof buttonBlockSchema>;

const BUTTON_FIELDS: readonly SettingsField[] = [
  {
    invalidMessage: "Enter the text the Button shows.",
    key: "label",
    label: "Label",
    type: "text",
  },
  LINK_FIELD,
  colorField({
    fallback: BUTTON_LOOK.backgroundColor,
    invalidMessage: INVALID_SOLID_COLOR,
    key: "backgroundColor",
    label: "Background color",
  }),
  colorField({ fallback: BUTTON_LOOK.color, label: "Text color" }),
  alignField(BUTTON_LOOK.align),
];

const buttonBlock = {
  defaults: { label: "Button" } satisfies ButtonBlockProps,
  fields: () => BUTTON_FIELDS,
  label: "Button",
  schema: buttonBlockSchema,
  styles: ({
    align = BUTTON_LOOK.align,
    backgroundColor = BUTTON_LOOK.backgroundColor,
    color = BUTTON_LOOK.color,
  }) => ({
    "background-color": backgroundColor,
    color,
    "text-align": align,
  }),
} satisfies BlockDefinition<ButtonBlockProps>;

const hasAltText = (alt: unknown) =>
  typeof alt === "string" && alt.trim() !== "";

const imageBlockSchema = v.pipe(
  v.strictObject({
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
    description: "A URL, or a Merge Tag such as {{logo_url}}.",
    invalidMessage: INVALID_IMAGE_URL,
    key: "src",
    label: "Image URL",
    type: "text",
  },
  {
    description: "What a screen reader says, and what shows if images are off.",
    invalidMessage:
      "A linked Image needs alt text. To leave this empty, remove the link first.",
    key: "alt",
    label: "Alt text",
    type: "text",
  },
  {
    ...pixelField("width", "Width"),
    description: "Leave empty to fill the Column.",
  },
  link,
];

const IMAGE_FIELDS = imageFields(LINK_FIELD);

const IMAGE_FIELDS_WITHOUT_ALT = imageFields({
  ...LINK_FIELD,
  description: "Add alt text first, as a screen reader says it for the link.",
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
  color: v.optional(colorSchema),
  thickness: v.optional(pixelSchema(MAX_DIVIDER_THICKNESS)),
});

type DividerBlockProps = v.InferOutput<typeof dividerBlockSchema>;

const DIVIDER_FIELDS: readonly SettingsField[] = [
  colorField({ fallback: DIVIDER_LOOK.color }),
  pixelField("thickness", "Thickness", {
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
  height: v.optional(pixelSchema(MAX_SPACER_HEIGHT)),
});

type SpacerBlockProps = v.InferOutput<typeof spacerBlockSchema>;

const SPACER_FIELDS: readonly SettingsField[] = [
  pixelField("height", "Height", {
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

/** Each type of Block, in the order the palette shows them. */
const BLOCKS = [
  ["text", textBlock],
  ["heading", headingBlock],
  ["image", imageBlock],
  ["button", buttonBlock],
  ["divider", dividerBlock],
  ["spacer", spacerBlock],
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

/** The types of Block a person can add, in the order the palette shows them. */
export const BLOCK_TYPES: readonly {
  readonly label: string;
  readonly type: string;
}[] = [...blockDefinitions].map(([type, { label }]) => ({ label, type }));

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
  blockPadding: "16px",
  fontSize: `${TEXT_LOOK.fontSize}px`,
  lineHeight: String(LINE_HEIGHT),
} as const;

/**
 * A Block's CSS, for both the canvas and the email output. Its props must be
 * valid, as in a loaded document, because they're not checked again here.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const blockStyles = ({ props, type }: Pick<Block, "props" | "type">) =>
  blockDefinitions.get(type)?.styles(props) ?? {};

/**
 * The settings panel's fields for a Block.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const blockSettingsFields = ({
  props,
  type,
}: Pick<Block, "props" | "type">) =>
  blockDefinitions.get(type)?.fields(props) ?? [];
