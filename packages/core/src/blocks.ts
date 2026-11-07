import * as v from "valibot";

import type { Block } from "./document.js";
import { INVALID_LINK, linkHrefSchema, richTextSchema } from "./rich-text.js";
import { colorSchema, INVALID_COLOR } from "./settings.js";
import type { SettingsField } from "./settings.js";

const MIN_FONT_SIZE = 1;
const MAX_FONT_SIZE = 200;

const alignSchema = v.picklist(["left", "center", "right"]);

const fontSizeSchema = v.pipe(
  v.number(),
  v.safeInteger(),
  v.minValue(MIN_FONT_SIZE),
  v.maxValue(MAX_FONT_SIZE)
);

const alignField = (fallback: string): SettingsField => ({
  default: fallback,
  invalidMessage: "Choose an alignment from the list.",
  key: "align",
  label: "Alignment",
  options: [
    { label: "Left", value: "left" },
    { label: "Center", value: "center" },
    { label: "Right", value: "right" },
  ],
  type: "select",
});

const colorField = (fallback: string, label = "Color"): SettingsField => ({
  default: fallback,
  invalidMessage: INVALID_COLOR,
  key: "color",
  label,
  type: "color",
});

const fontSizeField = (fallback: number): SettingsField => ({
  default: fallback,
  invalidMessage: `Use a whole number from ${MIN_FONT_SIZE} to ${MAX_FONT_SIZE}.`,
  key: "fontSize",
  label: "Font size",
  max: MAX_FONT_SIZE,
  min: MIN_FONT_SIZE,
  type: "number",
  unit: "px",
});

/** One type of Block's part of the definition that lives in `core`. */
interface BlockDefinition {
  label: string;
  defaults: Record<string, unknown>;
  schema: v.GenericSchema<unknown, Record<string, unknown>>;
  /** The settings panel's fields, whose defaults can depend on the properties. */
  fields: (props: Record<string, unknown>) => readonly SettingsField[];
  /** The Block's CSS, for both the canvas and the email output. */
  styles: (props: Record<string, unknown>) => Record<string, string>;
}

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
  colorField(TEXT_LOOK.color),
  fontSizeField(TEXT_LOOK.fontSize),
];

export const textBlock = {
  defaults: {
    content: { content: [{ type: "paragraph" }], type: "doc" },
  } satisfies TextBlockProps,
  fields: () => TEXT_FIELDS,
  label: "Text",
  schema: textBlockSchema,
  styles: (props) => {
    const {
      align = TEXT_LOOK.align,
      color = TEXT_LOOK.color,
      fontSize = TEXT_LOOK.fontSize,
    } = props as TextBlockProps;
    return {
      color,
      "font-size": `${fontSize}px`,
      "text-align": align,
    };
  },
} satisfies BlockDefinition;

/** What a Heading looks like until a person changes it. */
const HEADING_LOOK = { align: "left", color: "#000000" } as const;

const HEADING_FONT_SIZES = { 1: 32, 2: 24, 3: 20 } as const;

const headingBlockSchema = v.strictObject({
  align: v.optional(alignSchema),
  color: v.optional(colorSchema),
  content: richTextSchema,
  fontSize: v.optional(fontSizeSchema),
  level: v.picklist([1, 2, 3]),
});

type HeadingBlockProps = v.InferOutput<typeof headingBlockSchema>;

const headingBlock = {
  defaults: {
    content: { content: [{ type: "paragraph" }], type: "doc" },
    level: 1,
  } satisfies HeadingBlockProps,
  fields: (props) => [
    {
      invalidMessage: "Choose a level from the list.",
      key: "level",
      label: "Level",
      options: [
        { label: "Heading 1", value: 1 },
        { label: "Heading 2", value: 2 },
        { label: "Heading 3", value: 3 },
      ],
      type: "select",
    },
    alignField(HEADING_LOOK.align),
    colorField(HEADING_LOOK.color),
    fontSizeField(HEADING_FONT_SIZES[(props as HeadingBlockProps).level]),
  ],
  label: "Heading",
  schema: headingBlockSchema,
  styles: (props) => {
    const {
      align = HEADING_LOOK.align,
      color = HEADING_LOOK.color,
      level,
      fontSize = HEADING_FONT_SIZES[level],
    } = props as HeadingBlockProps;
    return {
      color,
      "font-size": `${fontSize}px`,
      "font-weight": "700",
      "text-align": align,
    };
  },
} satisfies BlockDefinition;

/** What a Button looks like until a person changes it. */
const BUTTON_LOOK = {
  align: "left",
  backgroundColor: "#2563eb",
  color: "#ffffff",
} as const;

const buttonBlockSchema = v.strictObject({
  align: v.optional(alignSchema),
  backgroundColor: v.optional(colorSchema),
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
  {
    description: "A URL, or a Merge Tag such as {{cta_url}}.",
    invalidMessage: INVALID_LINK,
    key: "href",
    label: "Link",
    type: "text",
  },
  {
    default: BUTTON_LOOK.backgroundColor,
    invalidMessage: INVALID_COLOR,
    key: "backgroundColor",
    label: "Background color",
    type: "color",
  },
  colorField(BUTTON_LOOK.color, "Text color"),
  alignField(BUTTON_LOOK.align),
];

const buttonBlock = {
  defaults: { label: "Button" } satisfies ButtonBlockProps,
  fields: () => BUTTON_FIELDS,
  label: "Button",
  schema: buttonBlockSchema,
  styles: (props) => {
    const {
      align = BUTTON_LOOK.align,
      backgroundColor = BUTTON_LOOK.backgroundColor,
      color = BUTTON_LOOK.color,
    } = props as ButtonBlockProps;
    return {
      "background-color": backgroundColor,
      color,
      "text-align": align,
    };
  },
} satisfies BlockDefinition;

export const blockDefinitions = new Map<string, BlockDefinition>([
  ["text", textBlock],
  ["heading", headingBlock],
  ["button", buttonBlock],
]);

/** The types of Block a person can add, in the order the palette shows them. */
export const BLOCK_TYPES = [...blockDefinitions].map(([type, { label }]) => ({
  label,
  type,
}));

/** What a person calls a type of Block. */
export const blockLabel = (type: string) =>
  blockDefinitions.get(type)?.label ?? type;

export const describeIssues = (issues: readonly v.BaseIssue<unknown>[]) =>
  issues
    .map((issue) => {
      const path = v.getDotPath(issue);
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");

/** Checks what `owner`'s properties would become. */
export const parseProps = (
  schema: v.GenericSchema<unknown, Record<string, unknown>>,
  props: unknown,
  owner: string
) => {
  const result = v.safeParse(schema, props);
  return result.success
    ? { props: result.output, valid: true as const }
    : {
        reason: `Invalid props for ${owner}: ${describeIssues(result.issues)}`,
        valid: false as const,
      };
};

export const validateProps = (
  block: Pick<Block, "id" | "type">,
  props: unknown
) => {
  const definition = blockDefinitions.get(block.type);
  return definition
    ? parseProps(definition.schema, props, `Block "${block.id}"`)
    : {
        reason: `Block "${block.id}" has unknown type "${block.type}"`,
        valid: false as const,
      };
};

/** A Block's CSS, for both the canvas and the email output. */
export const blockStyles = ({ props, type }: Pick<Block, "props" | "type">) =>
  blockDefinitions.get(type)?.styles(props) ?? {};

/** The settings panel's fields for a Block. */
export const blockSettingsFields = ({
  props,
  type,
}: Pick<Block, "props" | "type">) =>
  blockDefinitions.get(type)?.fields(props) ?? [];
