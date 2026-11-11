import { blockStyles } from "@mailquilt/core";
import type { Block } from "@mailquilt/core";
import { css, html, nothing } from "lit";
import { styleMap } from "lit/directives/style-map.js";

import { blockIcon } from "./icons.js";

export const blockContentStyles = css`
  /* The same space as a Text Block's padding, as in the email output. */
  .button-block,
  .image-block,
  .divider-block {
    padding: 16px;
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

/** Whether a Block has text to edit on the canvas, and so a TextBlockView. */
export const hasRichText = ({ type }: Pick<Block, "type">) =>
  type === "text" || type === "heading";

/**
 * A Button's face, and no link, because a click on the canvas selects it. Its
 * background belongs to this and not the whole Block, unlike a Block's other styles.
 */
const renderButton = (block: Block) => {
  const { "text-align": align, ...face } = blockStyles(block);
  return html`
    <div class="button-block" style=${styleMap({ "text-align": align })}>
      <span class="button" style=${styleMap(face)}>${block.props.label}</span>
    </div>
  `;
};

/**
 * The picture, and no link, because a click on the canvas selects it. A URL with a
 * Merge Tag has nothing to load until the email is sent, and a URL that failed
 * would otherwise collapse to nothing without alt text. Nor does a browser get to
 * drag the picture itself, which would take over from dragging the Block.
 */
const renderImage = (
  block: Block,
  failedImages: ReadonlySet<string>,
  onImageError: (src: string) => void
) => {
  const { alt = "", src } = block.props as { alt?: string; src?: string };
  const size = styleMap(blockStyles(block));
  const failed = src !== undefined && failedImages.has(src);
  return html`
    <div class="image-block">
      ${
        src === undefined || src.includes("{{") || failed
          ? html`
              <div class="image-placeholder" style=${size}>
                ${blockIcon("image")}
                <span>
                  ${failed ? `Couldn't load ${src}` : (src ?? "No image URL yet")}
                </span>
              </div>
            `
          : html`
              <img
                alt=${alt}
                draggable="false"
                src=${src}
                style=${size}
                @error=${() => onImageError(src)}
              />
            `
      }
    </div>
  `;
};

const renderDivider = (block: Block) => html`
  <div class="divider-block">
    <div class="divider" style=${styleMap(blockStyles(block))}></div>
  </div>
`;

const renderSpacer = (block: Block) =>
  html`<div class="spacer" style=${styleMap(blockStyles(block))}></div>`;

/** What a Block without text draws on the canvas. */
export const renderBlockContent = (
  block: Block,
  failedImages: ReadonlySet<string>,
  onImageError: (src: string) => void
) => {
  switch (block.type) {
    case "button": {
      return renderButton(block);
    }
    case "image": {
      return renderImage(block, failedImages, onImageError);
    }
    case "divider": {
      return renderDivider(block);
    }
    case "spacer": {
      return renderSpacer(block);
    }
    default: {
      return nothing;
    }
  }
};
