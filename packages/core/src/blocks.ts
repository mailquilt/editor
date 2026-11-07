import * as v from "valibot";

import type { Block } from "./document.js";
import { richTextSchema } from "./rich-text.js";
import { colorSchema, INVALID_COLOR } from "./settings.js";
import type { SettingsField } from "./settings.js";

const MIN_FONT_SIZE = 1;
const MAX_FONT_SIZE = 200;

/** What a Text Block looks like until a person changes it. */
const TEXT_LOOK = { align: "left", color: "#000000", fontSize: 16 } as const;

const textBlockSchema = v.strictObject({
  align: v.optional(v.picklist(["left", "center", "right"])),
  color: v.optional(colorSchema),
  content: richTextSchema,
  fontSize: v.optional(
    v.pipe(
      v.number(),
      v.safeInteger(),
      v.minValue(MIN_FONT_SIZE),
      v.maxValue(MAX_FONT_SIZE)
    )
  ),
});

type TextBlockProps = v.InferOutput<typeof textBlockSchema>;

const TEXT_FIELDS: readonly SettingsField[] = [
  {
    default: TEXT_LOOK.align,
    invalidMessage: "Choose an alignment from the list.",
    key: "align",
    label: "Alignment",
    options: [
      { label: "Left", value: "left" },
      { label: "Center", value: "center" },
      { label: "Right", value: "right" },
    ],
    type: "select",
  },
  {
    default: TEXT_LOOK.color,
    invalidMessage: INVALID_COLOR,
    key: "color",
    label: "Color",
    type: "color",
  },
  {
    default: TEXT_LOOK.fontSize,
    invalidMessage: `Use a whole number from ${MIN_FONT_SIZE} to ${MAX_FONT_SIZE}.`,
    key: "fontSize",
    label: "Font size",
    max: MAX_FONT_SIZE,
    min: MIN_FONT_SIZE,
    type: "number",
    unit: "px",
  },
];

export const textBlock = {
  defaults: {
    content: { content: [{ type: "paragraph" }], type: "doc" },
  } satisfies TextBlockProps,
  fields: TEXT_FIELDS,
  schema: textBlockSchema,
  /** The Block's CSS, for both the canvas and the email output. */
  styles: (props: Record<string, unknown>): Record<string, string> => {
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
};

export const blockDefinitions = new Map([["text", textBlock]]);

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

/** The settings panel's fields for a type of Block. */
export const blockSettingsFields = (type: string) =>
  blockDefinitions.get(type)?.fields ?? [];
