import * as v from "valibot";

import {
  BORDER_FIELDS,
  blockBoxEntries,
  borderStyles,
  MAX_CORNERS,
  paddingFields,
  paddingStyles,
} from "./box-settings.js";
import { deviceEntries } from "./device-settings.js";
import type { Block, EmailStyle } from "./document.js";
import {
  imageSrcSchema,
  linkHrefSchema,
  headingTextSchema,
  richTextSchema,
} from "./rich-text.js";
import { rowPropsSchema } from "./row-settings.js";
import { colorField, pixelField } from "./settings-fields.js";
import type { SettingsField } from "./settings-fields.js";
import { parseProps } from "./validation.js";
import {
  colorSchema,
  fontSizeSchema,
  hexColor,
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
  /**
   * What a change to its props sets, where one prop follows another, before
   * it's checked. Without it, the change as it's given.
   */
  changes?: (
    props: Props,
    changes: Record<string, unknown>
  ) => Record<string, unknown>;
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
  ...deviceEntries({ fontSize: v.optional(fontSizeSchema) }),
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
  ...deviceEntries({ fontSize: v.optional(fontSizeSchema) }),
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
  ...deviceEntries({ fontSize: v.optional(fontSizeSchema) }),
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
    // Only a Phone value gives a Button a font size of its own.
    const textFontSize =
      (props as { fontSize?: number }).fontSize ?? style.textFontSize;
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
    ...deviceEntries({ width: v.optional(wholePixelsSchema) }),
    alt: v.optional(v.string()),
    /** Adds nothing to what the email says, so a screen reader skips it. */
    decorative: v.optional(v.boolean()),
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
  ),
  // Exported with empty alt text, so nothing would name a link around it.
  v.check(
    ({ alt, decorative, href }) =>
      !decorative || (alt === undefined && href === undefined),
    "A decorative Image can't have alt text or a link"
  )
);

type ImageBlockProps = v.InferOutput<typeof imageBlockSchema>;

const ALT_TEXT_FIELD: SettingsField = {
  descriptionId: "field.altText.description",
  invalidMessageId: "invalid.altText",
  key: "alt",
  labelId: "field.altText",
  type: "text",
};

/** A decorative Image has no alt text field, as it can't have any. */
const imageFields = (
  link: SettingsField,
  { decorative = false } = {}
): readonly SettingsField[] => [
  {
    descriptionId: "field.imageUrl.description",
    invalidMessageId: "invalid.imageUrl",
    key: "src",
    labelId: "field.imageUrl",
    type: "text",
  },
  {
    default: false,
    invalidMessageId: "invalid.decorative",
    key: "decorative",
    labelId: "field.decorative",
    type: "toggle",
  },
  ...(decorative ? [] : [ALT_TEXT_FIELD]),
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

const DECORATIVE_IMAGE_FIELDS = imageFields(
  { ...LINK_FIELD, descriptionId: "field.link.decorative", disabled: true },
  { decorative: true }
);

const imageBlock = {
  defaults: {} satisfies ImageBlockProps,
  fields: ({ alt, decorative }) => {
    if (decorative) {
      return DECORATIVE_IMAGE_FIELDS;
    }
    return hasAltText(alt) ? IMAGE_FIELDS : IMAGE_FIELDS_WITHOUT_ALT;
  },
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
  ...deviceEntries(),
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
  ...deviceEntries(),
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
  ...deviceEntries(),
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
    itemFields: [
      {
        invalidMessageId: "invalid.link",
        key: "url",
        labelId: "field.socialUrl",
        type: "text",
      },
    ],
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

/** What a Menu looks like until a person changes it. */
const MENU_LOOK = {
  align: "left",
  color: "#000000",
  fontSize: 16,
  gap: 24,
} as const;

const MAX_MENU_GAP = 100;

const menuBlockSchema = v.strictObject({
  ...blockBoxEntries,
  ...deviceEntries({ fontSize: v.optional(fontSizeSchema) }),
  align: v.optional(alignSchema),
  color: v.optional(colorSchema),
  fontSize: v.optional(fontSizeSchema),
  gap: v.optional(pixelSchema(MAX_MENU_GAP)),
  // In the person's order. A link without a label or a URL is kept, and left
  // out of the email.
  links: v.array(
    v.strictObject({
      // Plain text, as the whole label is the link. Not blank.
      label: v.optional(
        v.pipe(v.string(), v.regex(/\S/u, "A Menu link's label can't be blank"))
      ),
      url: v.optional(linkHrefSchema),
    })
  ),
});

type MenuBlockProps = v.InferOutput<typeof menuBlockSchema>;

const MENU_FIELDS: readonly SettingsField[] = [
  {
    addLabelId: "field.menuLinks.add",
    descriptionId: "field.menuLinks.description",
    invalidMessageId: "invalid.menuLinks",
    itemFields: [
      {
        invalidMessageId: "invalid.menuLabel",
        key: "label",
        labelId: "field.menuLabel",
        type: "text",
      },
      {
        invalidMessageId: "invalid.link",
        key: "url",
        labelId: "field.link",
        type: "text",
      },
    ],
    itemNameId: "field.menuLinks.item",
    key: "links",
    labelId: "field.menuLinks",
    type: "list",
  },
  alignField(MENU_LOOK.align),
  colorField({ fallback: MENU_LOOK.color, labelId: "field.textColor" }),
  fontSizeField(MENU_LOOK.fontSize),
  pixelField("gap", "field.menuGap", {
    fallback: MENU_LOOK.gap,
    max: MAX_MENU_GAP,
  }),
];

const menuBlock = {
  defaults: { links: [] } satisfies MenuBlockProps,
  fields: () => MENU_FIELDS,
  label: "Menu",
  schema: menuBlockSchema,
  styles: (props, { textColor, textFontSize }) => {
    const {
      align = MENU_LOOK.align,
      color = textColor ?? MENU_LOOK.color,
      fontSize = textFontSize ?? MENU_LOOK.fontSize,
    } = props;
    return {
      color,
      "font-size": `${fontSize}px`,
      "line-height": lineHeightFor(fontSize),
      "text-align": align,
    };
  },
} satisfies BlockDefinition<MenuBlockProps>;

/** What a Video's line under its picture looks like until a person changes it. */
const VIDEO_LOOK = { color: "#000000", label: "Watch the video" } as const;

/** The play button's choices, each with what it means, as the bar shows them. */
const PLAY_OPTIONS = [
  {
    descriptionId: "play.below.description",
    labelId: "play.below",
    value: "below",
  },
  { descriptionId: "play.on.description", labelId: "play.on", value: "on" },
  {
    descriptionId: "play.none.description",
    labelId: "play.none",
    value: "none",
  },
] as const;

const videoBlockSchema = v.strictObject({
  ...blockBoxEntries,
  ...deviceEntries(),
  alt: v.optional(v.string()),
  /** The line's color. */
  color: v.optional(colorSchema),
  /** The line's words. Plain text, as the whole line is the link. Not blank. */
  label: v.optional(
    v.pipe(v.string(), v.regex(/\S/u, "A Video's line can't be blank"))
  ),
  play: v.optional(v.picklist(PLAY_OPTIONS.map(({ value }) => value))),
  /**
   * A copy of the thumbnail with a play button drawn on it, which the editor
   * uploads. Shown in its place while `play` is `"on"`.
   */
  playThumbnail: v.optional(imageSrcSchema),
  // Optional, as a new Video has neither until a person gives them.
  thumbnail: v.optional(imageSrcSchema),
  url: v.optional(linkHrefSchema),
});

type VideoBlockProps = v.InferOutput<typeof videoBlockSchema>;

/** The line's fields are there only while the line shows. */
const videoFields = (line: boolean): readonly SettingsField[] => [
  {
    descriptionId: "field.videoUrl.description",
    invalidMessageId: "invalid.link",
    key: "url",
    labelId: "field.videoUrl",
    type: "text",
  },
  {
    descriptionId: "field.thumbnail.description",
    invalidMessageId: "invalid.imageUrl",
    key: "thumbnail",
    labelId: "field.thumbnail",
    type: "text",
  },
  { ...ALT_TEXT_FIELD, descriptionId: "field.videoAlt.description" },
  {
    default: "below",
    invalidMessageId: "invalid.play",
    key: "play",
    labelId: "field.play",
    options: PLAY_OPTIONS,
    type: "select",
  },
  ...(line
    ? [
        {
          default: VIDEO_LOOK.label,
          invalidMessageId: "invalid.videoLabel",
          key: "label",
          labelId: "field.videoLabel",
          type: "text",
        } satisfies SettingsField,
        colorField({ fallback: VIDEO_LOOK.color, labelId: "field.lineColor" }),
      ]
    : []),
];

const VIDEO_FIELDS = { line: videoFields(true), noLine: videoFields(false) };

const videoBlock = {
  // A new thumbnail forgets the copy drawn on the old one, unless a copy comes
  // with it. While the play button was on the picture, the line shows until
  // one is drawn on the new thumbnail, so the email never shows the old
  // picture, nor a video with no sign it's one.
  changes: (props, changes) =>
    !("thumbnail" in changes) ||
    changes.thumbnail === props.thumbnail ||
    "playThumbnail" in changes
      ? changes
      : {
          ...changes,
          ...(props.play === "on" && !("play" in changes)
            ? { play: "below" }
            : {}),
          playThumbnail: null,
        },
  defaults: {} satisfies VideoBlockProps,
  fields: (props) =>
    videoLook(props).line ? VIDEO_FIELDS.line : VIDEO_FIELDS.noLine,
  label: "Video",
  schema: videoBlockSchema,
  // The line's look: its own color, or else the email's links', and the
  // email's text size.
  styles: (props, style) => {
    const fontSize = style.textFontSize ?? TEXT_LOOK.fontSize;
    return {
      color: linkColor(
        props,
        style,
        props.color ?? style.textColor ?? VIDEO_LOOK.color
      ),
      "font-size": `${fontSize}px`,
      "line-height": lineHeightFor(fontSize),
    };
  },
} satisfies BlockDefinition<VideoBlockProps>;

/**
 * Which picture a Video shows, and whether the line shows under it, whether
 * or not it has a link yet, as the canvas draws it.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const videoLook = ({
  play,
  playThumbnail,
  thumbnail,
}: VideoBlockProps) => {
  const drawn = play === "on" && playThumbnail !== undefined;
  return {
    line: play !== "none" && !drawn,
    picture: drawn ? playThumbnail : thumbnail,
  };
};

/**
 * What the email shows of a Video: its picture, the drawn copy if it has one
 * and the play button is on the picture, and whether the line shows under it,
 * which it does too while the play button is meant to be on the picture but
 * no copy is drawn. Nothing for a Video without a link or a thumbnail, which
 * the email leaves out.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const videoShown = (props: VideoBlockProps) => {
  const { url } = props;
  const { line, picture } = videoLook(props);
  return url === undefined || props.thumbnail === undefined
    ? undefined
    : { line, picture: picture as string, url };
};

/** WCAG 2.2's relative luminance of a `#rrggbb` color. */
const luminanceOf = (hex: string) => {
  const [red = 0, green = 0, blue = 0] = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

/**
 * The color of the ▶ on a Video's line, white or black, whichever has more
 * contrast with the circle it's on, which is the line's color.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const playMarkColor = (lineColor: string) => {
  const light = luminanceOf(hexColor(lineColor) ?? VIDEO_LOOK.color);
  return 1.05 / (light + 0.05) >= (light + 0.05) / 0.05 ? "#ffffff" : "#000000";
};

/**
 * The words of a Video's line.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const videoLabel = ({ label = VIDEO_LOOK.label }: VideoBlockProps) =>
  label;

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
 * icons are as far from its edges as a Block's content is. Each icon keeps
 * half the gap on every side, so a padding less than that leaves the icons
 * that far in, never further out.
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
    blockPadding:
      new Set(sides).size === 1 ? (sides[0] as string) : sides.join(" "),
    iconPadding: gap / 2,
    size: iconSize,
    style: iconStyle,
  };
};

/**
 * A Menu's links that the email shows, those with a label and a URL, with half
 * the gap between links on either side of each. Lines that wrap then end at
 * the same place, whatever the alignment. The Block's padding on its left and
 * right is that much less, so the links are as far from its edges as a
 * Block's content is, and never further out.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const menuLinks = (props: MenuBlockProps) => {
  const half = (props.gap ?? MENU_LOOK.gap) / 2;
  const padding = blockPadding(props, "menu");
  const sides = BLOCK_SIDES.map((side) =>
    side === "Top" || side === "Bottom"
      ? `${padding[side]}px`
      : `${Math.max(padding[side] - half, 0)}px`
  );
  return {
    blockPadding:
      new Set(sides).size === 1 ? (sides[0] as string) : sides.join(" "),
    linkPadding: half,
    shown: props.links.filter(
      (link): link is { label: string; url: string } =>
        link.label !== undefined && link.url !== undefined
    ),
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
  ["menu", menuBlock],
  ["video", videoBlock],
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

/** An object schema's entries, inside the checks of a pipe if it's in one. */
const entriesOf = (schema: v.GenericSchema): v.ObjectEntries => {
  const object = "pipe" in schema ? (schema.pipe as unknown[])[0] : schema;
  return (object as { entries: v.ObjectEntries }).entries;
};

/**
 * The settings of a type of Block that can have a Phone value, from its
 * schema, or a Row's with no type.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const phoneValueKeys = (type?: string): readonly string[] => {
  const schema =
    type === undefined ? rowPropsSchema : blockDefinitions.get(type)?.schema;
  const phone = schema && entriesOf(schema).phone;
  return phone
    ? Object.keys(entriesOf((phone as { wrapped: v.GenericSchema }).wrapped))
    : [];
};

/**
 * What a change to a Block's props sets, with the props that follow it, such
 * as a Video's drawn copy, which a new thumbnail drops.
 */
export const blockChanges = (
  { props, type }: Pick<Block, "props" | "type">,
  changes: Record<string, unknown>
) => blockDefinitions.get(type)?.changes?.(props, changes) ?? changes;

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
