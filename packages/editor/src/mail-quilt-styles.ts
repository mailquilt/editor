import { EMAIL_LOOK } from "@mailquilt/core";
import { css, unsafeCSS } from "lit";

/** The editor's own canvas, Rows, Blocks and toolbars. Its panels have their own. */
export const editorStyles = css`
  /* A column, so the editor fills any height the host gives the element. */
  :host {
    display: flex;
    flex-direction: column;
  }

  :host([hidden]) {
    display: none;
  }

  /*
   * The canvas, then the side panel docked on its right. In a host too narrow
   * for both, the panel goes below rather than squeeze the email. Framed,
   * so it reads as one component on the host's page. Clipped rather than
   * hidden, which would stop the panel and toolbar sticking.
   */
  .editor {
    /* Beside the email, room for a Block's tools and a Row's. */
    --gutter: 40px;
    --panel-width: 320px;
    /* Where the email and the panel stop fitting side by side. */
    --side-by-side: calc(
      var(--email-width) + 2 * var(--gutter) + var(--panel-width)
    );
    align-items: stretch;
    background: var(--mq-color-workspace);
    border-radius: var(--mq-radius);
    /* A ring rather than a border, so it takes no room from the email. */
    box-shadow: 0 0 0 1px var(--mq-color-border);
    display: flex;
    overflow: clip;
    /* Fills any height the host gives, but never shrinks below the email. */
    flex: 1 0 auto;
    flex-wrap: wrap;
    min-height: 600px;
  }

  /*
   * Behind the notice for a host too narrow to edit in. Out of sight, but
   * still in the layout, so a host that takes the width of its content
   * keeps the width the editor gives it, and grows again with the window.
   * Every part hides, as the email card and the tools start their styles
   * again, and so none of them takes focus. Important, as otherwise a host's
   * size for ::part(frame), which the notice shares, would win here.
   */
  .editor[data-collapsed] {
    flex-grow: 0 !important;
    height: 0 !important;
    min-height: 0 !important;
  }

  .editor[data-collapsed],
  .editor[data-collapsed] * {
    visibility: hidden !important;
  }

  .canvas-area {
    background-color: var(--mq-color-workspace);
    display: flex;
    /* The email's own width, so the panel wraps before the email shrinks. */
    flex: 999 1 calc(var(--email-width) + 2 * var(--gutter));
    flex-direction: column;
    gap: var(--mq-space-5);
    /* Room for a selected Block's tools when the panel has gone below. */
    min-height: 480px;
    min-width: 0;
    /* Room for a Row's toolbar beside the email, and a Block's tag above. */
    padding: 56px var(--gutter) var(--mq-space-4);
  }

  /*
   * The email card: the email's own settings, never the editor's tokens.
   * Inherited properties cross the Shadow DOM boundary, so hostile values on
   * the host element stop here.
   */
  .email {
    all: initial;
    box-shadow:
      0 0 0 1px rgb(16 24 40 / 6%),
      0 1px 2px rgb(16 24 40 / 6%),
      0 12px 32px -12px rgb(16 24 40 / 18%);
    box-sizing: border-box;
    color: #000000;
    display: block;
    font-size: ${unsafeCSS(EMAIL_LOOK.fontSize)};
    line-height: ${unsafeCSS(EMAIL_LOOK.lineHeight)};
    margin: 0 auto;
    max-width: 100%;
    position: relative;
  }

  .drop-indicator {
    background: var(--mq-color-accent);
    border-radius: 2px;
    box-shadow: 0 0 0 2px rgb(255 255 255 / 80%);
    height: 3px;
    margin-block-start: -1.5px;
    pointer-events: none;
    position: absolute;
    z-index: 6;
  }

  .drop-indicator::before,
  .drop-indicator::after {
    background: var(--mq-color-surface);
    border: 2px solid var(--mq-color-accent);
    border-radius: 50%;
    box-sizing: border-box;
    content: "";
    height: 9px;
    position: absolute;
    top: -3px;
    width: 9px;
  }

  .drop-indicator::before {
    left: -5px;
  }

  .drop-indicator::after {
    right: -5px;
  }

  .row-frame {
    position: relative;
  }

  .row {
    display: flex;
  }

  .row-frame:hover > .row {
    outline: 1px dashed var(--mq-color-outline-hover);
    outline-offset: -1px;
  }

  .row-frame[data-row-selected] > .row {
    box-shadow: inset 0 0 0 3px rgb(255 255 255 / 55%);
    outline: 2px solid var(--mq-color-accent);
    outline-offset: -2px;
  }

  /*
   * A Row's tag, above its top end corner, away from its Blocks' tags. A
   * press on it selects the Row.
   */
  .row-tag {
    background: var(--mq-color-accent);
    border-radius: var(--mq-radius-small) var(--mq-radius-small) 0 0;
    bottom: 100%;
    color: var(--mq-color-on-accent);
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    inset-inline-end: 0;
    line-height: 20px;
    opacity: 0;
    padding: 0 8px;
    pointer-events: none;
    position: absolute;
    /* It drags the Row, which a touch would otherwise scroll the page for. */
    touch-action: none;
    z-index: 4;
  }

  .row-frame:hover > .row-tag,
  .row-frame[data-row-selected] > .row-tag {
    opacity: 1;
    pointer-events: auto;
  }

  .row-frame[data-row-selected] > .row-tag {
    background: var(--mq-color-text);
    color: var(--mq-color-surface);
  }

  .email[data-dragging] .row-tag {
    display: none;
  }

  .column {
    min-width: 0;
    transition: background-color 120ms;
  }

  /* While a Block is dragged, where it can land, and where it will. */
  .email[data-dragging="block"] .column {
    outline: 1px dashed var(--mq-color-outline-hover);
    outline-offset: -1px;
  }

  .email[data-dragging="block"] .column[data-drop-target] {
    background-image: linear-gradient(
      var(--mq-color-accent-soft),
      var(--mq-color-accent-soft)
    );
    outline: 2px solid var(--mq-color-accent);
    outline-offset: -2px;
  }

  .column.empty {
    /* So that the padding doesn't add to a width that matches the export's. */
    box-sizing: border-box;
    display: flex;
    min-height: 112px;
    padding: var(--mq-space-2);
  }

  /*
   * Quiet until the pointer or focus comes to it. The label and the buttons
   * share one spot, so whichever shows is centred: the buttons on hover or
   * keyboard focus, and the label otherwise.
   */
  .placeholder {
    background: var(--mq-color-surface);
    border: 1.5px dashed var(--mq-color-border-strong);
    border-radius: var(--mq-radius-small);
    color: var(--mq-color-text-muted);
    display: grid;
    flex: 1;
    font-size: var(--mq-font-size-small);
    font-weight: 500;
    min-width: 0;
    place-items: center;
    padding: var(--mq-space-3) var(--mq-space-2);
    text-align: center;
    transition:
      background-color 120ms,
      border-color 120ms;
  }

  .column.empty:hover .placeholder,
  .placeholder:focus-within,
  .email[data-dragging] .column[data-drop-target] .placeholder {
    border-color: var(--mq-color-accent);
    color: var(--mq-color-accent-strong);
  }

  .placeholder p {
    margin: 0;
  }

  .placeholder-label,
  .placeholder .add-blocks {
    grid-area: 1 / 1;
    transition: opacity 120ms;
  }

  /*
   * Faded out, it still paints over the buttons in its spot, so it never
   * takes the pointer from them.
   */
  .placeholder-label {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: var(--mq-space-1);
    pointer-events: none;
  }

  .column.empty:hover .placeholder-label,
  .placeholder:focus-within .placeholder-label {
    opacity: 0;
  }

  .email[data-dragging] .placeholder-label {
    opacity: 1;
  }

  .email[data-dragging] .placeholder .add-blocks {
    opacity: 0;
  }

  .placeholder-icon {
    align-items: center;
    background: var(--mq-color-surface-muted);
    border-radius: 50%;
    display: flex;
    height: 28px;
    justify-content: center;
    width: 28px;
  }

  .placeholder .add-blocks {
    display: flex;
    flex-wrap: wrap;
    gap: var(--mq-space-1);
    justify-content: center;
    opacity: 0;
  }

  .column.empty:hover .add-blocks,
  .placeholder:focus-within .add-blocks {
    opacity: 1;
  }

  /* With no hover to bring them out, the buttons show, in the label's place. */
  @media (hover: none) {
    .placeholder .add-blocks {
      opacity: 1;
    }

    .placeholder-label {
      opacity: 0;
    }
  }

  /* In the placeholder's color, which turns to the accent as a drop target. */
  .placeholder .icon-button {
    border: 1px solid var(--mq-color-border);
    color: inherit;
    height: 26px;
    width: 26px;
  }

  .block {
    position: relative;
  }

  /*
   * Where a focused Block, and its tools, are scrolled to: clear of its tag above
   * and of the floating toolbar below.
   */
  .block,
  .block-toolbar,
  .ProseMirror {
    scroll-margin-block: 48px 72px;
  }

  .block:hover {
    outline: 1px solid var(--mq-color-outline-hover);
    outline-offset: -1px;
  }

  /* A white inner ring keeps it visible on a dark email background. */
  .block[aria-current="true"] {
    box-shadow: inset 0 0 0 3px rgb(255 255 255 / 55%);
    outline: 2px solid var(--mq-color-accent);
    outline-offset: -2px;
  }

  /* Stands out from a Block that's only selected, or whose text has focus. */
  .block:focus-visible {
    background-color: var(--mq-color-accent-soft);
    outline: 3px solid var(--mq-color-accent-strong);
    outline-offset: -3px;
  }

  /*
   * The type of Block, on a tag above its top start corner. It takes no
   * clicks, so it never covers the Block above.
   */
  .block:hover::after,
  .block[aria-current="true"]::after {
    background: var(--mq-color-accent);
    border-radius: var(--mq-radius-small) var(--mq-radius-small) 0 0;
    bottom: 100%;
    color: var(--mq-color-on-accent);
    content: attr(data-label);
    font:
      600 11px/20px var(--mq-font-family),
      sans-serif;
    inset-inline-start: 0;
    letter-spacing: 0.01em;
    padding: 0 6px;
    pointer-events: none;
    position: absolute;
    white-space: nowrap;
    z-index: 4;
  }

  .block[aria-current="true"]::after {
    background: var(--mq-color-text);
    color: var(--mq-color-surface);
  }

  .email[data-dragging] .block::after {
    display: none;
  }

  /*
   * The copy that follows the pointer is a popover, so that it's in the top
   * layer. This takes away a popover's own look, leaving what it copies.
   */
  :where([data-drag-ghost]) {
    background: none;
    border: none;
    color: inherit;
    overflow: visible;
    padding: 0;
  }

  /* What's dragged keeps its place, unseen, while its copy moves. */
  [data-drag-source] {
    opacity: 0;
  }

  /*
   * The Block that follows the pointer, which also shows what's under it. On its
   * Row's color, or else the email's, as its text is meant to be read on that.
   */
  .block[data-drag-ghost] {
    background: var(--_mq-row-background, var(--_mq-email-background));
    box-shadow: var(--mq-shadow);
    opacity: 0.85;
  }

  /*
   * Narrower than a Text Block's padding, so that a press on any text selects it
   * instead of dragging the Block.
   */
  .drag-handle {
    align-items: center;
    background: var(--mq-color-surface);
    border: 1px solid var(--mq-color-border);
    border-radius: 0 0 var(--mq-radius-small) 0;
    box-shadow: var(--mq-shadow-small);
    box-sizing: border-box;
    color: var(--mq-color-text-muted);
    cursor: grab;
    display: flex;
    height: 24px;
    inset-block-start: 0;
    inset-inline-start: 0;
    justify-content: center;
    opacity: 0;
    position: absolute;
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
    width: 16px;
    z-index: 1;
  }

  .drag-handle .icon {
    height: 14px;
    width: 14px;
  }

  .block:hover .drag-handle,
  .block[aria-current="true"] .drag-handle {
    opacity: 1;
    z-index: 2;
  }

  @media (hover: none) {
    .drag-handle {
      opacity: 1;
    }
  }

  /*
   * Only a thin Spacer's handle reaches past its Block. While it's hidden it
   * leaves that space alone. While it shows, it's on top, to be pressed.
   */
  @media (hover: hover) {
    .block:has(> .spacer):not(:hover, [aria-current="true"]) .drag-handle {
      pointer-events: none;
    }
  }

  /*
   * Down the selected Block's start side, outside it: in the gutter for the
   * first Column, and over the end of the Column before for the others, where
   * no Block keeps its handle.
   */
  .block-toolbar {
    background: var(--mq-color-text);
    border-color: transparent;
    color: var(--mq-color-surface);
    flex-direction: column;
    inset-block-start: 0;
    inset-inline-end: calc(100% + 4px);
    position: absolute;
    z-index: 5;
  }

  .block-toolbar .icon-button {
    color: color-mix(in srgb, var(--mq-color-surface) 78%, transparent);
  }

  .block-toolbar .icon-button:hover {
    background: color-mix(in srgb, var(--mq-color-surface) 14%, transparent);
    color: var(--mq-color-surface);
  }

  .block-toolbar .icon-button.danger:hover {
    background: var(--mq-color-danger);
    color: var(--mq-color-on-accent);
  }

  .block-toolbar .icon-button:focus-visible {
    outline-color: var(--mq-color-surface);
  }

  .block-toolbar .separator {
    background: color-mix(in srgb, var(--mq-color-surface) 18%, transparent);
    height: 1px;
    margin: 2px 4px;
    width: auto;
  }

  .block-toolbar .drag-handle,
  .row-toolbar .drag-handle {
    background: none;
    border: 0;
    border-radius: var(--mq-radius-small);
    box-shadow: none;
    height: 22px;
    opacity: 1;
    position: static;
    width: 28px;
  }

  .block-toolbar .drag-handle {
    color: color-mix(in srgb, var(--mq-color-surface) 60%, transparent);
  }

  .block-toolbar .drag-handle:hover {
    background: color-mix(in srgb, var(--mq-color-surface) 14%, transparent);
    color: var(--mq-color-surface);
  }

  /*
   * A Row's tools, beside it on the right. The padding bridges the gap, so the
   * pointer can get there without leaving the Row. Hidden, it takes no clicks.
   */
  .row-toolbar {
    inset-block-start: 0;
    inset-inline-start: 100%;
    opacity: 0;
    padding-inline-start: var(--mq-space-2);
    pointer-events: none;
    position: absolute;
    transition: opacity 120ms;
    z-index: 4;
  }

  /*
   * Not while one of its Blocks is selected, which has tools of its own. Its
   * tag still shows on hover, and selects the Row.
   */
  .row-frame:hover:not(:has(.block[aria-current="true"])) > .row-toolbar,
  .row-frame[data-row-selected] > .row-toolbar,
  .row-toolbar:focus-within {
    opacity: 1;
    pointer-events: auto;
  }

  /*
   * While the pointer is on a Row, only its toolbar shows, so a short Row's
   * toolbar never sits over another's buttons.
   */
  .email:has(.row-frame:hover)
    .row-frame:not(:hover)
    > .row-toolbar:not(:has(:focus-visible)) {
    opacity: 0;
    pointer-events: none;
  }

  .row-toolbar > .bar {
    flex-direction: column;
  }

  .row-toolbar .drag-handle:hover {
    background: var(--mq-color-surface-hover);
    color: var(--mq-color-text);
  }

  /* The Row that follows the pointer, on the email's color, as for a Block. */
  .row-frame[data-drag-ghost] {
    background: var(--_mq-email-background);
    box-shadow: var(--mq-shadow);
    opacity: 0.85;
  }

  /*
   * Undo, Redo and Preview, at the bottom left of the canvas while it shows,
   * as far from the canvas's left edge as from the window's bottom.
   */
  .floating-toolbar {
    align-self: flex-start;
    bottom: var(--mq-space-4);
    margin-block-start: auto;
    margin-inline-start: calc(var(--mq-space-4) - var(--gutter));
    position: sticky;
    z-index: 7;
  }

  .floating-toolbar:focus-visible {
    outline: 2px solid var(--mq-color-accent);
    outline-offset: 1px;
  }

  /* In the editor's place, so it fills any height the host gives too. */
  .narrow-notice {
    align-items: center;
    flex-grow: 1;
    background: var(--mq-color-workspace);
    border-radius: var(--mq-radius);
    box-shadow: 0 0 0 1px var(--mq-color-border);
    display: flex;
    flex-direction: column;
    gap: var(--mq-space-3);
    justify-content: center;
    min-height: 360px;
    padding: 40px var(--mq-space-5);
    text-align: center;
  }

  .narrow-notice .notice-icon {
    align-items: center;
    background: var(--mq-color-surface);
    border-radius: var(--mq-radius);
    box-shadow: var(--mq-shadow);
    display: flex;
    height: 56px;
    justify-content: center;
    margin-block-end: var(--mq-space-2);
    width: 56px;
  }

  .narrow-notice .notice-icon .icon {
    height: 24px;
    width: 24px;
  }

  .narrow-notice .notice-title {
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin: 0;
  }

  .narrow-notice .notice-body {
    color: var(--mq-color-text-muted);
    line-height: 1.5;
    margin: 0;
    max-width: 34ch;
  }

  .narrow-notice .text-button {
    align-items: center;
    display: inline-flex;
    gap: var(--mq-space-2);
    height: 40px;
    margin-block-start: var(--mq-space-2);
    padding: 0 var(--mq-space-4);
  }

  @media (prefers-reduced-motion: reduce) {
    .ui *,
    .row-toolbar {
      transition: none !important;
    }
  }

  /* ProseMirror's base styles (ADR 0002). */
  .ProseMirror {
    font-variant-ligatures: none;
    overflow-wrap: break-word;
    padding: ${unsafeCSS(EMAIL_LOOK.blockPadding)};
    position: relative;
    white-space: pre-wrap;
    white-space: break-spaces;
  }

  .ProseMirror:focus-visible {
    outline: 2px solid var(--mq-color-accent);
    outline-offset: -2px;
  }

  .ProseMirror p {
    margin: 0;
  }

  /* In the Block's color, as the export writes it, and underlined. */
  .ProseMirror a {
    color: inherit;
  }
`;
