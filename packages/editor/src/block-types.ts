import type { Block, BlockType } from "@mailquilt/core";
import { blockStyles, EMAIL_LOOK, MERGE_TAG } from "@mailquilt/core/internal";
import type { BlockProps } from "@mailquilt/core/internal";
import { css, html, nothing, svg, unsafeCSS } from "lit";
import type { TemplateResult } from "lit";

import { icon } from "./icons.js";
import { styleProperties } from "./style-properties.js";
import { createTextSchema } from "./text-schema.js";
import type { TextSchema } from "./text-schema.js";

// The editor's part of each type of Block, in one table, so a type core adds
// and this doesn't handle is a type error. Core's part is in its `blocks.ts`.

export const blockTypeStyles = css`
  /* The same space as a Text Block's padding, as in the email output. */
  .padded-block {
    padding: ${unsafeCSS(EMAIL_LOOK.blockPadding)};
  }

  /* Like MJML: it fills the Column, and a width it's given stops at the Column. */
  .image-block img,
  .image-placeholder {
    box-sizing: border-box;
    display: block;
    margin-inline: auto;
    max-width: 100%;
    width: 100%;
  }

  .image-block img {
    height: auto;
    -webkit-user-select: none;
    user-select: none;
  }

  /* Only on the canvas: a stand-in until the image has a URL that loads. */
  .image-placeholder {
    align-items: center;
    background: repeating-linear-gradient(
      -45deg,
      #f4f5f7,
      #f4f5f7 8px,
      #eef0f3 8px,
      #eef0f3 16px
    );
    border-radius: 4px;
    color: #52525b;
    display: flex;
    flex-direction: column;
    font:
      500 13px/1.4 system-ui,
      sans-serif;
    gap: 8px;
    justify-content: center;
    min-height: 120px;
    overflow-wrap: anywhere;
    padding: 12px;
    text-align: center;
    -webkit-user-select: none;
    user-select: none;
  }

  .image-placeholder .icon {
    color: #71717a;
    height: 28px;
    width: 28px;
  }

  /* The color and width come from the Block, for the top border alone. */
  .divider {
    border-style: solid none none;
  }

  /* Nothing shows in the email, but a person has to be able to find it. */
  .spacer {
    background: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 6px,
      rgb(113 113 122 / 8%) 6px,
      rgb(113 113 122 / 8%) 12px
    );
    outline: 1px dashed #a1a1aa;
    outline-offset: -1px;
  }

  /* A thin one can still be clicked, without changing the space it takes up. */
  .spacer::before {
    content: "";
    /* Only as far as makes it 12px tall, so that a taller one takes nothing. */
    inset-block: min(0px, calc((100% - 12px) / 2));
    inset-inline: 0;
    position: absolute;
  }

  /* What MJML gives a button, so that the canvas looks like the email output. */
  .button {
    border-radius: 3px;
    display: inline-block;
    overflow-wrap: anywhere;
    padding: 10px 25px;
    /* MJML's table centers the lines of a label, wherever the Button sits. */
    text-align: center;
    -webkit-user-select: none;
    user-select: none;
  }
`;

/** What a Block without text needs to draw, apart from its props and styles. */
interface DrawContext {
  /** The email's language, which a Block's own words take. */
  lang: string;
  failedImages: ReadonlySet<string>;
  onImageError: (src: string) => void;
}

/** The editor's part of one type of Block. */
type BlockTypeView<Type extends BlockType> = {
  /** In the palette and the Side panel. */
  icon: TemplateResult;
} & (
  | {
      /** It's edited as text on the canvas, in a TextBlockView. */
      text: { canBold: boolean; schema: TextSchema };
    }
  | {
      /** What it draws on the canvas. Its stand-ins take the editor's `lang`. */
      draw: (
        props: BlockProps[Type],
        styles: Record<string, string>,
        context: DrawContext
      ) => TemplateResult;
    }
);

/**
 * A Button's face, and no link, because a click on the canvas selects it. Its
 * background belongs to this and not the whole Block, unlike a Block's other styles.
 */
const drawButton = (
  { label }: BlockProps["button"],
  { "text-align": align, ...face }: Record<string, string>,
  { lang }: DrawContext
) => html`
  <div
    class="padded-block"
    lang=${lang}
    style=${styleProperties({ "text-align": align })}
  >
    <span
      class="button"
      data-testid="button-face"
      style=${styleProperties(face)}
      >${label}</span
    >
  </div>
`;

const IMAGE_ICON = icon(
  svg`<rect height="16" rx="2" width="18" x="3" y="4" /><circle cx="9" cy="10" r="2" /><path d="m21 17-5-5-9 8" />`
);

/**
 * The picture, and no link, because a click on the canvas selects it. A URL with a
 * Merge Tag has nothing to load until the email is sent, and a URL that failed
 * would otherwise collapse to nothing without alt text. Nor does a browser get to
 * drag the picture itself, which would take over from dragging the Block.
 */
const drawImage = (
  { alt = "", src }: BlockProps["image"],
  styles: Record<string, string>,
  { failedImages, lang, onImageError }: DrawContext
) => {
  const size = styleProperties(styles);
  const failed = src !== undefined && failedImages.has(src);
  return html`
    <div class="padded-block image-block">
      ${
        src === undefined || MERGE_TAG.test(src) || failed
          ? html`
              <div class="image-placeholder" style=${size}>
                ${IMAGE_ICON}
                <span>
                  ${failed ? `Couldn't load ${src}` : (src ?? "No image URL yet")}
                </span>
              </div>
            `
          : html`
              <img
                alt=${alt}
                draggable="false"
                lang=${lang}
                src=${src}
                style=${size}
                @error=${() => onImageError(src)}
              />
            `
      }
    </div>
  `;
};

const drawDivider = (
  _props: BlockProps["divider"],
  styles: Record<string, string>
) => html`
  <div class="padded-block">
    <div
      class="divider"
      data-testid="divider-line"
      style=${styleProperties(styles)}
    ></div>
  </div>
`;

const drawSpacer = (
  _props: BlockProps["spacer"],
  styles: Record<string, string>
) => html`<div class="spacer" style=${styleProperties(styles)}></div>`;

/**
 * Each type of Block's view. Text and Heading each have a text schema of their
 * own, though they hold the same for now, so one can change without the other,
 * such as Text getting lists.
 */
export const BLOCK_VIEWS = {
  button: {
    draw: drawButton,
    icon: icon(
      svg`<rect height="8" rx="3" width="18" x="3" y="8" /><path d="M8 12h8" />`
    ),
  },
  divider: {
    draw: drawDivider,
    icon: icon(
      svg`<path d="M7 6h10M7 18h10" stroke-opacity="0.45" /><path d="M3 12h18" />`
    ),
  },
  heading: {
    icon: icon(svg`<path d="M6 4v16M18 4v16M6 12h12" />`),
    // A Heading is bold already, so the mark would change nothing.
    text: { canBold: false, schema: createTextSchema() },
  },
  image: { draw: drawImage, icon: IMAGE_ICON },
  spacer: {
    draw: drawSpacer,
    icon: icon(svg`<path d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4" />`),
  },
  text: {
    icon: icon(svg`<path d="M4 7V5h16v2M9 19h6M12 5v14" />`),
    text: { canBold: true, schema: createTextSchema() },
  },
} satisfies { [Type in BlockType]: BlockTypeView<Type> };

/** The same table, typed so that a Block's own type picks what draws it. */
const VIEWS: { [Type in BlockType]: BlockTypeView<Type> } = BLOCK_VIEWS;

type TextBlockType = {
  [Type in BlockType]: (typeof BLOCK_VIEWS)[Type] extends { text: object }
    ? Type
    : never;
}[BlockType];

/** Whether a Block has text to edit on the canvas, and so a TextBlockView. */
export const hasRichText = (
  block: Block
): block is Extract<Block, { type: TextBlockType }> =>
  "text" in BLOCK_VIEWS[block.type];

const drawContent = <Type extends BlockType>(
  type: Type,
  props: BlockProps[Type],
  context: DrawContext
) => {
  const view = VIEWS[type];
  return "draw" in view
    ? view.draw(props, blockStyles({ props, type }), context)
    : nothing;
};

/** What a Block without text draws on the canvas. */
export const renderBlockContent = (
  block: Block,
  lang: string,
  failedImages: ReadonlySet<string>,
  onImageError: (src: string) => void
) => drawContent(block.type, block.props, { failedImages, lang, onImageError });
