import {
  BLOCK_TYPES,
  blockLabel,
  blockSettingsFields,
  blockStyles,
  createEditor,
  EMAIL_SETTINGS_FIELDS,
  findBlockPosition,
  INVALID_LINK,
  isAllowedLinkHref,
  isSameDocument,
  loadDocument,
  ROW_LAYOUTS,
  ROW_SETTINGS_FIELDS,
  rowLayoutOf,
  rowStyles,
} from "@mailquilt/core";
import type {
  Block,
  BlocksDocument,
  Column,
  Command,
  Editor,
  Operation,
  RichTextDocument,
  Row,
  RowLayout,
  SettingsField,
} from "@mailquilt/core";
import { renderEmail } from "@mailquilt/renderer";
import { css, html, LitElement, nothing } from "lit";
import type { TemplateResult } from "lit";
import { keyed } from "lit/directives/keyed.js";
import { repeat } from "lit/directives/repeat.js";
import { styleMap } from "lit/directives/style-map.js";

import { BLOCKS, createBlockDragging } from "./block-dragging.js";
import type { BlockDragging, DragSource, DropPlace } from "./block-dragging.js";
import {
  arrowDirection,
  columnLabel,
  moveCommand,
  neighbourBlockId,
  placeLabel,
  positionLabel,
} from "./block-keyboard.js";
import type { Direction } from "./block-keyboard.js";
import { blockIcon, ICONS } from "./icons.js";
import {
  draftKey,
  fieldText,
  fieldValue,
  renderSettingsPanel,
  settingsPanelStyles,
} from "./settings-panel.js";
import type { FieldDraft, SettingsSection } from "./settings-panel.js";
import { createTextBlockView } from "./text-block-view.js";
import type {
  TextBlockView,
  TextFormats,
  ToggleableMark,
} from "./text-block-view.js";
import { themeTokens, uiStyles } from "./theme.js";
import { createTooltips } from "./tooltips.js";
import type { Tooltips } from "./tooltips.js";

/** Narrower than this, there's no room to edit, and a notice shows instead. */
const MIN_EDITOR_WIDTH = 640;

/**
 * The language of the editor's own words, for its tools inside the email, which
 * would otherwise take the email's language.
 */
const UI_LANG = "en";

/** Typing after a gap this long starts a new undo step. */
const TYPING_PAUSE_MS = 1000;

const IS_MAC = /Mac|iPhone|iPad/u.test(navigator.userAgent);
/** How a shortcut with Ctrl, or Command on Apple devices, is written. */
const MOD_KEY = IS_MAC ? "⌘" : "Ctrl+";
const UNDO_KEYS = `${MOD_KEY}Z`;
const REDO_KEYS = IS_MAC ? "⇧⌘Z" : "Ctrl+Y";
const UNDO_SHORTCUTS = "Control+Z Meta+Z";
const REDO_SHORTCUTS = "Control+Y Control+Shift+Z Meta+Shift+Z";

const MARK_BUTTONS: { keys: string; label: string; mark: ToggleableMark }[] = [
  { keys: `${MOD_KEY}B`, label: "Bold", mark: "bold" },
  { keys: `${MOD_KEY}I`, label: "Italic", mark: "italic" },
  { keys: `${MOD_KEY}U`, label: "Underline", mark: "underline" },
];

const MOVE_BUTTONS: { direction: Direction; keys: string; shortcut: string }[] =
  [
    { direction: "up", keys: "Alt+↑", shortcut: "Alt+ArrowUp" },
    { direction: "down", keys: "Alt+↓", shortcut: "Alt+ArrowDown" },
    { direction: "left", keys: "Alt+←", shortcut: "Alt+ArrowLeft" },
    { direction: "right", keys: "Alt+→", shortcut: "Alt+ArrowRight" },
  ];

type MoveButton = (typeof MOVE_BUTTONS)[number];

/** A Block's up and down, which also move a Row. */
const ROW_MOVE_BUTTONS = MOVE_BUTTONS.filter(
  (button): button is MoveButton & { direction: "down" | "up" } =>
    button.direction === "up" || button.direction === "down"
);

type PanelTab = "content" | "rows" | "settings";

const PANEL_TABS: { icon: unknown; id: PanelTab; label: string }[] = [
  { icon: ICONS.content, id: "content", label: "Content" },
  { icon: ICONS.rows, id: "rows", label: "Rows" },
  { icon: ICONS.settings, id: "settings", label: "Settings" },
];

/** A layout as its Column widths, for a picker that names it beside this. */
const renderThumbnail = (layout: RowLayout) => html`
  <span aria-hidden="true" class="thumbnail">
    ${layout
      .split("/")
      .map(
        (width) => html`<span style=${styleMap({ "flex-grow": width })}></span>`
      )}
  </span>
`;

/** Only a pointer drags, so this isn't offered to assistive technology. */
const renderDragHandle = (
  onMousedown: (event: MouseEvent) => void,
  tooltip = "Drag Block"
) => html`
  <div
    aria-hidden="true"
    class="drag-handle"
    data-tooltip=${tooltip}
    @mousedown=${onMousedown}
  >
    ${ICONS.grip}
  </div>
`;

/** For what has to stay with the element it happened in. */
const stopPropagation = (event: Event) => event.stopPropagation();

const TOOLBAR_KEYS = new Set([
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "End",
  "Home",
]);

/**
 * Arrow keys, Home and End go along a toolbar's own buttons, either way up. With
 * a modifier they're left alone, as Alt+↑ is a shortcut to move a Block.
 */
const onToolbarArrowKeys = (event: KeyboardEvent) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return;
  }
  const toolbar = event.currentTarget as HTMLElement;
  const buttons = [
    ...toolbar.querySelectorAll<HTMLButtonElement>(
      ":scope > button:not(:disabled)"
    ),
  ];
  const index = buttons.indexOf(event.target as HTMLButtonElement);
  if (!TOOLBAR_KEYS.has(event.key) || index === -1) {
    return;
  }
  event.preventDefault();
  const last = buttons.length - 1;
  const previous = index === 0 ? last : index - 1;
  const following = index === last ? 0 : index + 1;
  const next = {
    ArrowDown: following,
    ArrowLeft: previous,
    ArrowRight: following,
    ArrowUp: previous,
    End: last,
    Home: 0,
  }[event.key];
  buttons[next ?? index]?.focus();
};

/** Whether a Block has text to edit on the canvas, and so a TextBlockView. */
const hasRichText = ({ type }: Pick<Block, "type">) =>
  type === "text" || type === "heading";

/** Layouts without Latin letters report their own, so use the key's position. */
const shortcutKey = (event: KeyboardEvent) =>
  /^[a-z]$/iu.test(event.key)
    ? event.key.toLowerCase()
    : event.code.replace("Key", "").toLowerCase();

const isLinkShortcut = (event: KeyboardEvent) =>
  !(event.isComposing || event.altKey || event.shiftKey) &&
  (event.metaKey || event.ctrlKey) &&
  shortcutKey(event) === "k";

const historyShortcut = (event: KeyboardEvent) => {
  if (event.isComposing || event.altKey) {
    return;
  }
  const key = shortcutKey(event);
  if (key === "z" && (event.metaKey || event.ctrlKey)) {
    return event.shiftKey ? "redo" : "undo";
  }
  if (key === "y" && event.ctrlKey && !event.metaKey && !event.shiftKey) {
    return "redo";
  }
};

/** WebKit can end a composition first, and then report the key as 229. */
const isComposing = (event: KeyboardEvent) =>
  event.isComposing || event.keyCode === 229;

const historyInput = (event: InputEvent) => {
  if (event.inputType === "historyUndo") {
    return "undo";
  }
  if (event.inputType === "historyRedo") {
    return "redo";
  }
};

/** The Command for a drop, which adds a Row if it landed outside any. */
const dropCommand = (source: DragSource, place: DropPlace): Command => {
  if ("rowId" in source) {
    return {
      index: "rowIndex" in place ? place.rowIndex : 0,
      rowId: source.rowId,
      type: "moveRow",
    };
  }
  if ("rowLayout" in source) {
    return {
      index: "rowIndex" in place ? place.rowIndex : 0,
      layout: source.rowLayout as RowLayout,
      type: "insertRow",
    };
  }
  if ("blockId" in source) {
    return "columnId" in place
      ? { ...source, ...place, type: "moveBlock" }
      : { ...source, ...place, type: "moveBlockToNewRow" };
  }
  return "columnId" in place
    ? { ...source, ...place, type: "insertBlock" }
    : { ...source, ...place, type: "insertBlockInNewRow" };
};

type MoveOperation = Extract<Operation, { type: "move" }>;

/** One opening of the Preview. */
interface Preview {
  /** Unset while the email renders. */
  result?: { html: string } | { failure: string };
}

const renderPreviewContent = ({ result }: Preview) => {
  if (!result) {
    return html`<p role="status">Loading preview…</p>`;
  }
  return "html" in result
    ? html`
        <iframe sandbox="" srcdoc=${result.html} title="Email preview"></iframe>
      `
    : html`
        <p role="alert">The preview couldn't be loaded: ${result.failure}</p>
      `;
};

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
const renderBlockContent = (
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

export class MailQuilt extends LitElement {
  static override styles = [
    themeTokens,
    uiStyles,
    settingsPanelStyles,
    css`
      /* A column, so the editor fills any height the host gives the element. */
      :host {
        display: flex;
        flex-direction: column;
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
       * again, and so none of them takes focus.
       */
      .editor[data-collapsed] {
        flex-grow: 0;
        height: 0;
        min-height: 0;
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
        font-size: 16px;
        line-height: 1.5;
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
        background: var(--mq-color-surface);
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

      .placeholder .icon-button {
        border: 1px solid var(--mq-color-border);
        height: 26px;
        width: 26px;
      }

      .block {
        position: relative;
      }

      /* Where a browser scrolls a focused Block to, clear of its tag and tools. */
      .block,
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
        border-radius: 4px 4px 0 0;
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
        border-radius: var(--mq-radius-small) var(--mq-radius-small) 0 0;
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

      /* The Block that follows the pointer, which also shows what's under it. */
      .block[data-drag-ghost] {
        background: #ffffff;
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

      [data-block-type],
      [data-row-layout] {
        touch-action: none;
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
        background: color-mix(
          in srgb,
          var(--mq-color-surface) 14%,
          transparent
        );
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
        background: color-mix(
          in srgb,
          var(--mq-color-surface) 18%,
          transparent
        );
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
        background: color-mix(
          in srgb,
          var(--mq-color-surface) 14%,
          transparent
        );
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
      .row-frame:hover:not(:has([aria-current="true"])) > .row-toolbar,
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
        > .row-toolbar:not(:focus-within) {
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

      /* The Row that follows the pointer, which also shows what's under it. */
      .row-frame[data-drag-ghost] {
        background: #ffffff;
        box-shadow: var(--mq-shadow);
        opacity: 0.85;
      }

      .layout-option {
        align-items: center;
        background: transparent;
        border: 1px solid transparent;
        border-radius: var(--mq-radius-small);
        color: var(--mq-color-text-muted);
        cursor: pointer;
        display: flex;
        flex-direction: column;
        font-size: var(--mq-font-size-small);
        font-weight: 500;
        gap: 4px;
        padding: 6px;
        white-space: nowrap;
      }

      .layout-option:hover {
        background: var(--mq-color-surface-hover);
        color: var(--mq-color-text);
      }

      .layout-option[aria-pressed="true"] {
        background: var(--mq-color-accent-soft);
        border-color: var(--mq-color-accent);
        color: var(--mq-color-accent-strong);
      }

      /* A layout as its Column widths. */
      .thumbnail {
        display: flex;
        gap: 3px;
        height: 22px;
        width: 100%;
      }

      .thumbnail > span {
        background: var(--mq-color-surface-muted);
        border: 1px solid
          color-mix(
            in srgb,
            var(--mq-color-border-strong) 55%,
            var(--mq-color-surface)
          );
        border-radius: 3px;
        flex-basis: 0;
        transition:
          background-color 120ms,
          border-color 120ms;
      }

      .layout-option:hover .thumbnail > span,
      .layout-tile:hover .thumbnail > span,
      .layout-option[aria-pressed="true"] .thumbnail > span {
        background: var(--mq-color-accent-soft);
        border-color: var(--mq-color-accent);
      }

      /*
       * Below the text being edited, at its end: clear of where the next Block's
       * text starts, and of its drag handle.
       */
      .format-bar {
        flex-wrap: wrap;
        inset-block-start: calc(100% + 6px);
        inset-inline-end: 0;
        max-width: min(360px, calc(100vw - 32px));
        position: absolute;
        width: max-content;
        z-index: 5;
      }

      .link-form {
        align-items: center;
        border-top: 1px solid var(--mq-color-border);
        display: flex;
        flex-basis: 100%;
        flex-wrap: wrap;
        gap: 6px;
        margin-block-start: 2px;
        padding: var(--mq-space-2) var(--mq-space-1) var(--mq-space-1);
      }

      .link-form label {
        color: var(--mq-color-text-muted);
        display: flex;
        flex: 1 1 100%;
        flex-direction: column;
        font-size: var(--mq-font-size-small);
        font-weight: 500;
        gap: 4px;
      }

      .link-form input {
        background: var(--mq-color-surface);
        border: 1px solid var(--mq-color-border-strong);
        border-radius: var(--mq-radius-small);
        color: var(--mq-color-text);
        height: 30px;
        min-width: 0;
        padding: 0 8px;
        width: 100%;
      }

      .link-form input:focus-visible {
        border-color: var(--mq-color-accent);
        box-shadow: 0 0 0 3px var(--mq-color-accent-soft);
        outline-offset: -1px;
      }

      .link-form p {
        color: var(--mq-color-danger);
        flex-basis: 100%;
        font-size: var(--mq-font-size-small);
        margin: 0;
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

      /* A sidebar, flush on the right, as tall as the editor. */
      .side-panel {
        background: var(--mq-color-surface);
        border-inline-start: 1px solid
          color-mix(
            in srgb,
            var(--mq-color-border-strong) 40%,
            var(--mq-color-border)
          );
        box-sizing: border-box;
        display: flex;
        flex: 1 0 var(--panel-width);
        /*
         * Its own width beside the canvas, and the whole width once it has
         * wrapped below it.
         */
        max-width: max(var(--panel-width), (var(--side-by-side) - 100%) * 9999);
        min-width: 0;
      }

      .side-panel-inner {
        background: var(--mq-color-surface);
        display: flex;
        flex: 1;
        flex-direction: column;
        /*
         * No taller than the window, or than the part of a Shell the email
         * scrolls in, which the Shell gives as --mq-visible-height.
         */
        max-height: min(100dvh, var(--mq-visible-height, 100dvh));
        min-width: 0;
        overflow: hidden;
        position: sticky;
        top: 0;
      }

      .panel-scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-color: var(--mq-color-border) transparent;
        scrollbar-width: thin;
      }

      .panel-scroll.padded {
        display: flex;
        flex-direction: column;
        gap: var(--mq-space-4);
        padding: var(--mq-space-4);
      }

      .panel-top {
        padding: var(--mq-space-3) var(--mq-space-3) 0;
      }

      /* A segmented control: the selected tab is a raised chip in the track. */
      .tabs {
        background: var(--mq-color-surface-hover);
        border-radius: var(--mq-radius);
        box-shadow: inset 0 0 0 1px var(--mq-color-border);
        display: flex;
        gap: 2px;
        padding: 3px;
      }

      .tab {
        align-items: center;
        background: transparent;
        border: 0;
        border-radius: 8px;
        color: var(--mq-color-text-muted);
        cursor: pointer;
        display: flex;
        flex: 1;
        font-weight: 500;
        gap: 6px;
        height: 32px;
        justify-content: center;
        padding: 0 var(--mq-space-2);
        transition:
          background-color 120ms,
          color 120ms;
      }

      .tab:hover {
        color: var(--mq-color-text);
      }

      .tab[aria-selected="true"] {
        background: var(--mq-color-surface);
        box-shadow:
          0 0 0 1px var(--mq-color-border),
          0 1px 3px rgb(22 24 29 / 10%);
        color: var(--mq-color-text);
      }

      .tab[aria-selected="true"] .icon {
        color: var(--mq-color-accent);
      }

      .panel-header {
        align-items: center;
        border-bottom: 1px solid var(--mq-color-border);
        display: flex;
        gap: var(--mq-space-2);
        padding: 10px var(--mq-space-3);
      }

      .type-badge {
        align-items: center;
        background: var(--mq-color-text);
        border-radius: var(--mq-radius);
        color: var(--mq-color-surface);
        display: flex;
        flex: none;
        height: 36px;
        justify-content: center;
        width: 36px;
      }

      .panel-heading {
        min-width: 0;
      }

      .panel-title {
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.01em;
        line-height: 1.25;
        margin: 0;
      }

      .panel-subtitle {
        color: var(--mq-color-text-muted);
        font-size: var(--mq-font-size-small);
        margin: 0;
      }

      .panel-section {
        border-bottom: 1px solid var(--mq-color-border);
        display: flex;
        flex-direction: column;
        gap: var(--mq-space-3);
        padding: var(--mq-space-4);
      }

      .panel-section .panel-section-title {
        font-size: var(--mq-font-size);
      }

      .layout-choices {
        display: grid;
        gap: var(--mq-space-1);
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .panel-intro {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .panel-section-title {
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.01em;
        margin: 0;
      }

      .panel-hint {
        color: var(--mq-color-text-muted);
        font-size: var(--mq-font-size-small);
        line-height: 1.45;
        margin: 0;
      }

      .tiles {
        display: grid;
        gap: var(--mq-space-2);
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .tile,
      .layout-tile {
        align-items: center;
        background: var(--mq-color-surface);
        border: 0;
        border-radius: var(--mq-radius);
        box-shadow:
          inset 0 0 0 1px var(--mq-color-border),
          0 1px 2px rgb(22 24 29 / 4%);
        color: var(--mq-color-text);
        cursor: pointer;
        display: flex;
        flex-direction: column;
        font-size: var(--mq-font-size-small);
        font-weight: 500;
        gap: 10px;
        justify-content: center;
        padding: var(--mq-space-3) var(--mq-space-2);
        transition:
          background-color 120ms,
          box-shadow 120ms;
      }

      .tile {
        cursor: grab;
        min-height: 84px;
        -webkit-user-select: none;
        user-select: none;
      }

      .tile .icon {
        color: var(--mq-color-text);
        height: 20px;
        width: 20px;
      }

      .tile:hover,
      .layout-tile:hover {
        background: var(--mq-color-surface);
        box-shadow:
          inset 0 0 0 1px var(--mq-color-text),
          var(--mq-shadow-small);
      }

      .tile:active {
        cursor: grabbing;
      }

      .layout-tiles {
        display: grid;
        gap: var(--mq-space-2);
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .layout-tile {
        align-items: stretch;
        color: var(--mq-color-text-muted);
        cursor: grab;
        gap: var(--mq-space-2);
        padding: var(--mq-space-3);
      }

      .layout-tile:hover {
        color: var(--mq-color-text);
      }

      .layout-tile .thumbnail {
        height: 40px;
      }

      /* Shown in place of the editor where there's no room to edit. */
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

      /* ProseMirror's base styles (ADR 0002). */
      .ProseMirror {
        font-variant-ligatures: none;
        overflow-wrap: break-word;
        padding: 16px;
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

      .announcement {
        clip-path: inset(50%);
        height: 1px;
        overflow: hidden;
        position: absolute;
        white-space: nowrap;
        width: 1px;
      }

      /* A closed dialog relies on the browser's display: none, so no all: initial. */
      .preview {
        background: var(--mq-color-surface);
        border: 0;
        border-radius: var(--mq-radius);
        box-shadow: var(--mq-shadow);
        /*
         * The window less a gap, up to a size that still reads as a dialog. A
         * wider email scrolls inside it.
         */
        height: calc(100dvh - 32px);
        max-height: 880px;
        max-width: 960px;
        overflow: hidden;
        padding: 0;
        width: calc(100vw - 32px);
      }

      .preview::backdrop {
        background: rgb(16 24 40 / 55%);
        backdrop-filter: blur(2px);
      }

      .preview-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      .preview-header {
        align-items: center;
        border-bottom: 1px solid var(--mq-color-border);
        display: flex;
        justify-content: space-between;
        padding: var(--mq-space-2) var(--mq-space-3) var(--mq-space-2)
          var(--mq-space-4);
      }

      .preview-header h2 {
        font: inherit;
        font-size: 14px;
        font-weight: 600;
        margin: 0;
      }

      .preview-panel iframe {
        background: var(--mq-color-workspace);
        border: 0;
        flex: 1;
        min-height: 0;
        width: 100%;
      }

      .preview-panel > p {
        margin: 0;
        padding: var(--mq-space-4);
      }

      .preview-panel > p[role="alert"] {
        color: var(--mq-color-danger);
      }
    `,
  ];

  #editor: Editor | undefined;
  /** A private copy of the document last received from or sent to the host. */
  #lastKnownDocument: BlocksDocument | undefined;
  readonly #views = new Map<string, TextBlockView>();
  /** Edits in the same typing session merge into one undo step. */
  #typingSession = 0;
  #lastTypedAt = 0;
  /** The selected Block, which the toolbars act on: the last one to have focus. */
  #activeBlockId: string | undefined;
  /** Whether focus is in the selected Block's text or its format bar. */
  #editingText = false;
  /** The selected Row, when a Row rather than a Block is selected. */
  #selectedRowId: string | undefined;
  /** Whether the side panel shows the selected Block's or Row's settings, not its tabs. */
  #showProperties = false;
  #panelTab: PanelTab = "content";
  /** What had focus in the editor when the current update began. */
  #focusedBeforeUpdate: Element | null | undefined;
  #formats: TextFormats | undefined;
  /** Text in the settings panel that isn't the document's value. */
  readonly #drafts = new Map<string, FieldDraft>();
  /** One copy of the document for each update, as `value` makes a new one. */
  #rendered: BlocksDocument | undefined;
  /** Image URLs that didn't load, which the canvas stops trying to show. */
  readonly #failedImages = new Set<string>();
  /** Set while the link field is open. */
  #linkForm: { error: boolean } | undefined;
  /** Set while the Preview is open. */
  #preview: Preview | undefined;
  /** The current document's HTML, once the Preview has rendered it. */
  #previewHtml: string | undefined;
  /** Set while the element is connected and has rendered. */
  #dragging: BlockDragging | undefined;
  #tooltips: { element: HTMLElement; tooltips: Tooltips } | undefined;
  /** What the screen reader last heard about a move. */
  #announcement = "";
  /** Each announcement gets a new element, so the same words are read again. */
  #announcementId = 0;
  /** Where the Enter key now held down was pressed. */
  #enterPressedOn: EventTarget | undefined;
  /** The last press began on the workspace itself, not after a drag from a Block. */
  #pressedOnWorkspace = false;
  /** Too narrow to edit in, as on a phone or in a narrow part of a page. */
  #narrow = false;
  readonly #resizeObserver = new ResizeObserver(([entry]) => {
    const narrow = (entry?.contentRect.width ?? 0) < MIN_EDITOR_WIDTH;
    if (narrow !== this.#narrow) {
      this.#narrow = narrow;
      this.requestUpdate();
    }
  });

  constructor() {
    super();
    // On the way in, because ProseMirror handles the key before it bubbles here.
    this.addEventListener("keydown", this.#onKeydownCapture, { capture: true });
    // A host may set `value` before this element is defined, which leaves an
    // own property in front of the setter.
    if (Object.hasOwn(this, "value")) {
      const { value } = this;
      Reflect.deleteProperty(this, "value");
      this.value = value;
    }
  }

  get value() {
    return this.#editor?.getDocument();
  }

  /**
   * A document with the same content as the last one received or sent out
   * changes nothing, so a controlled host keeps its undo history and cursor. Any
   * other document loads and clears undo history. A document that can't be
   * trusted fires `mq-error`, and the current email stays as it was.
   */
  set value(document: BlocksDocument | undefined) {
    // Checked first, because a controlled host does this after every keystroke.
    if (isSameDocument(document, this.#lastKnownDocument)) {
      return;
    }
    if (document === undefined) {
      this.#show(undefined);
      return;
    }
    const loaded = loadDocument(document);
    if (!loaded.ok) {
      this.#emitError(loaded.reason);
      return;
    }
    // An older document only matches the current one once it has been migrated.
    if (!isSameDocument(loaded.document, this.#lastKnownDocument)) {
      this.#show(loaded.document);
    }
  }

  /** Returns the final HTML. MJML loads the first time this is called. */
  async exportHtml() {
    if (!this.#editor) {
      throw new Error("<mail-quilt> has no document to export");
    }
    return await renderEmail(this.#editor.getDocument());
  }

  override connectedCallback() {
    super.connectedCallback();
    this.#resizeObserver.observe(this);
    if (this.shadowRoot) {
      this.#dragging = createBlockDragging({
        onDrop: (source, place) => this.#drop(source, place),
        root: this.shadowRoot,
      });
    }
    this.requestUpdate();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#resizeObserver.disconnect();
    this.#dragging?.destroy();
    this.#dragging = undefined;
    this.#tooltips?.tooltips.destroy();
    this.#tooltips = undefined;
    this.#destroyViews();
  }

  protected override willUpdate() {
    this.#focusedBeforeUpdate = this.shadowRoot?.activeElement;
    this.#rendered = this.value;
    // Lit still updates detached elements, and nothing would destroy these
    // views. connectedCallback requests an update that creates them instead.
    if (!this.isConnected) {
      return;
    }
    const blockIds = new Set<string>();
    const rows = this.#rendered?.rows ?? [];
    for (const row of rows) {
      for (const column of row.columns) {
        for (const block of column.blocks) {
          blockIds.add(block.id);
          if (hasRichText(block) && !this.#views.has(block.id)) {
            this.#views.set(
              block.id,
              createTextBlockView({
                // A Heading is bold already, so the mark would change nothing.
                canBold: block.type !== "heading",
                content: block.props.content as RichTextDocument,
                label: `${blockLabel(block.type)} Block`,
                onChange: (next) => this.#commitText(block.id, next),
                onFocus: () => {
                  this.#editingText = true;
                  this.#selectBlock(block.id);
                },
                onStateChange: () => this.#syncFormats(),
                onTypingBreak: () => {
                  this.#typingSession += 1;
                },
              })
            );
          }
        }
      }
    }
    this.#removeViewsExcept(blockIds);
    if (!rows.some(({ id }) => id === this.#selectedRowId)) {
      this.#selectedRowId = undefined;
    }
  }

  /**
   * A change can remove the element with focus, or disable it. Focus stays in the
   * editor, where undo still works. A Block that just moved, or whose link field
   * just closed, gets it back, on the Block itself or the same tool if that's
   * where it was, so that the next move works. Otherwise the floating toolbar
   * takes it, because it does nothing when a key that activated a button is
   * pressed again or held down.
   */
  protected override updated() {
    const before = this.#focusedBeforeUpdate;
    const active = this.shadowRoot?.activeElement as
      | HTMLButtonElement
      | null
      | undefined;
    if (before && (!active || active.disabled)) {
      const selected =
        this.#activeBlockId === undefined
          ? undefined
          : this.#blockElement(this.#activeBlockId);
      const { action } = (before as HTMLElement).dataset;
      const tool =
        action === undefined
          ? undefined
          : selected?.querySelector<HTMLElement>(
              `.block-toolbar [data-action="${action}"]`
            );
      const block = before.matches(".block") ? selected : undefined;
      // What was removed is detached by now, without the Block around it.
      const view = before.closest(".block, .format-bar, .link-form")
        ? this.#activeView
        : undefined;
      // A Row that moved keeps its tools. At either end, one of them is disabled.
      const rowTools = before.isConnected
        ? before.closest(".row-toolbar")
        : undefined;
      const rowTool = rowTools
        ? (
            [
              before,
              ...rowTools.querySelectorAll("button"),
            ] as HTMLButtonElement[]
          ).find((button) => !button.disabled)
        : undefined;
      (tool ?? block ?? view ?? rowTool ?? this.#floatingToolbar)?.focus();
    }
    if (this.isConnected && this.shadowRoot) {
      this.#syncTooltips(this.shadowRoot);
    }
  }

  protected override render() {
    const document = this.#rendered;
    if (!document) {
      return nothing;
    }
    const { rows, settings } = document;
    const selected = this.#selectedPosition(document);

    return html`
      ${this.#renderPreview()}
      <div class="announcement" role="status">
        ${keyed(this.#announcementId, html`<span>${this.#announcement}</span>`)}
      </div>
      <p hidden id="block-keys">
        Press Enter to edit the text, and Escape to come back. In the text,
        press Alt+F10 to reach its formatting. Use arrow keys to select another
        Block, and Alt with arrow keys to move this one.
      </p>
      <p hidden id="block-keys-no-text">
        Use arrow keys to select another Block, and Alt with arrow keys to move
        this one.
      </p>
      ${this.#narrow ? this.#renderNarrowNotice() : nothing}
      <div
        class="ui editor"
        part="frame"
        ?data-collapsed=${this.#narrow}
        style=${styleMap({ "--email-width": `${settings.width}px` })}
      >
        <div
          class="canvas-area"
          @click=${this.#onWorkspaceClick}
          @pointerdown=${this.#onWorkspacePointerdown}
        >
          <div
            class="email"
            lang=${settings.language ?? nothing}
            @beforeinput=${this.#onBeforeInput}
            @keydown=${this.#onKeydown}
            style=${styleMap({
              "background-color": settings.backgroundColor,
              "font-family": settings.fontFamily,
              width: `${settings.width}px`,
            })}
          >
            ${repeat(
              rows,
              (row) => row.id,
              (row, rowIndex) => html`
                <div
                  class="row-frame"
                  data-row-id=${row.id}
                  ?data-row-selected=${row.id === this.#selectedRowId}
                >
                  <div
                    aria-hidden="true"
                    class="ui row-tag"
                    @click=${() => this.#selectRow(row.id)}
                    @mousedown=${this.#onHandleMousedown}
                  >
                    Row
                  </div>
                  ${this.#renderRowToolbar(row, rowIndex, rows.length)}
                  <div class="row" style=${styleMap(rowStyles(row))}>
                    ${repeat(
                      row.columns,
                      (column) => column.id,
                      (column, columnIndex) =>
                        this.#renderColumn(
                          column,
                          columnLabel(rowIndex, columnIndex)
                        )
                    )}
                  </div>
                </div>
              `
            )}
            <div class="drop-indicator" hidden></div>
          </div>
          ${this.#renderFloatingToolbar()}
        </div>
        ${this.#renderSidePanel(document, selected)}
        <div class="ui tooltip" hidden role="tooltip"></div>
      </div>
    `;
  }

  /**
   * On a phone there's no room for the canvas and the side panel. The editor
   * stays as it is, so nothing is lost, and the email can still be previewed.
   */
  #renderNarrowNotice() {
    return html`
      <div class="ui narrow-notice" part="frame">
        <span class="notice-icon">${ICONS.monitor}</span>
        <p class="notice-title">Editing needs more room</p>
        <p class="notice-body">
          Make the editor at least ${MIN_EDITOR_WIDTH}px wide, such as by
          widening the window, to change this email. You can still preview it
          here.
        </p>
        <button
          class="text-button primary"
          type="button"
          @click=${this.#openPreview}
        >
          ${ICONS.preview}<span>Preview email</span>
        </button>
      </div>
    `;
  }

  /**
   * Beside the Row, on hover, on focus, and while the Row is selected.
   * Alt+↑ and Alt+↓ move the Row from here, as the Move buttons say.
   */
  #renderRowToolbar(row: Row, index: number, count: number) {
    return html`
      <div
        aria-label=${`Row ${index + 1}`}
        class="ui row-toolbar"
        lang=${UI_LANG}
        role="group"
        @keydown=${(event: KeyboardEvent) =>
          this.#onRowToolbarKeydown(event, row.id)}
        @mousedown=${this.#onControlMousedown}
      >
        <div class="bar">
          ${renderDragHandle(this.#onHandleMousedown, "Drag Row")}
          <button
            aria-label="Select Row"
            aria-pressed=${row.id === this.#selectedRowId ? "true" : "false"}
            class="icon-button"
            data-tooltip="Select Row"
            type="button"
            @click=${() => this.#selectRow(row.id)}
          >
            ${ICONS.select}
          </button>
          ${ROW_MOVE_BUTTONS.map(
            ({ direction, keys, shortcut }) => html`
              <button
                aria-keyshortcuts=${shortcut}
                aria-label=${`Move Row ${direction}`}
                class="icon-button"
                data-tooltip=${`Move Row ${direction} (${keys})`}
                ?disabled=${direction === "up" ? index === 0 : index === count - 1}
                type="button"
                @click=${() => this.#moveRow(row.id, direction)}
              >
                ${ICONS[direction]}
              </button>
            `
          )}
          <button
            aria-label="Delete Row"
            class="icon-button danger"
            data-tooltip="Delete Row"
            type="button"
            @click=${() => this.#apply({ rowId: row.id, type: "removeRow" })}
          >
            ${ICONS.delete}
          </button>
        </div>
      </div>
    `;
  }

  #renderColumn({ blocks, id, width }: Column, place: string) {
    return html`
      <div
        class=${blocks.length === 0 ? "column empty" : "column"}
        data-column-id=${id}
        style=${styleMap({ width: `${width}%` })}
      >
        ${repeat(
          blocks,
          (block) => block.id,
          (block, blockIndex) =>
            this.#renderBlock(
              block,
              `${place}, ${positionLabel(blockIndex, blocks.length)}`
            )
        )}
        ${
          blocks.length === 0
            ? html`
                <div class="ui placeholder" lang=${UI_LANG}>
                  <div class="placeholder-label">
                    <span class="placeholder-icon">${ICONS.plus}</span>
                    <p>Drop a Block here</p>
                  </div>
                  <div class="add-blocks">
                    ${BLOCK_TYPES.map(
                      ({ label, type }) => html`
                        <button
                          aria-label=${`Add ${label} Block here, ${place}`}
                          class="icon-button"
                          data-tooltip=${`Add ${label} Block here`}
                          type="button"
                          @click=${() => this.#addBlock(type, { columnId: id, index: 0 })}
                        >
                          ${blockIcon(type)}
                        </button>
                      `
                    )}
                  </div>
                </div>
              `
            : nothing
        }
      </div>
    `;
  }

  #renderBlock(block: Block, place: string) {
    const selected = block.id === this.#activeBlockId;
    const rich = hasRichText(block);
    return html`
      <div
        aria-current=${selected ? "true" : nothing}
        aria-describedby=${rich ? "block-keys" : "block-keys-no-text"}
        aria-label=${`${blockLabel(block.type)} Block, ${place}`}
        class="block"
        data-block-id=${block.id}
        data-label=${blockLabel(block.type)}
        role="group"
        style=${styleMap(rich ? blockStyles(block) : {})}
        tabindex="0"
        @click=${this.#onBlockClick}
        @focus=${(event: FocusEvent) => this.#onBlockFocus(event, block.id)}
        @focusout=${this.#onBlockFocusout}
        @keydown=${this.#onBlockKeydown}
      >
        ${selected ? nothing : renderDragHandle(this.#onHandleMousedown)}
        ${rich ? this.#views.get(block.id)?.element : nothing}
        ${renderBlockContent(block, this.#failedImages, this.#onImageError)}
        ${selected ? this.#renderBlockToolbar() : nothing}
        ${selected && rich && this.#editingText ? this.#renderFormatBar() : nothing}
      </div>
    `;
  }

  /** The selected Block's tools. One stop for Tab, then arrow keys go along. */
  #renderBlockToolbar() {
    return html`
      <div
        aria-label="Block tools"
        aria-orientation="vertical"
        class="ui bar block-toolbar"
        lang=${UI_LANG}
        role="toolbar"
        @keydown=${onToolbarArrowKeys}
        @mousedown=${this.#onControlMousedown}
      >
        ${renderDragHandle(this.#onHandleMousedown)}
        <span class="separator"></span>
        ${MOVE_BUTTONS.map(
          ({ direction, keys, shortcut }, index) => html`
            <button
              aria-keyshortcuts=${shortcut}
              aria-label=${`Move Block ${direction}`}
              class="icon-button"
              data-action=${`move-${direction}`}
              data-tooltip=${`Move Block ${direction} (${keys})`}
              tabindex=${index === 0 ? "0" : "-1"}
              type="button"
              @click=${() => this.#moveSelectedBlock(direction)}
            >
              ${ICONS[direction]}
            </button>
          `
        )}
        <span class="separator"></span>
        <button
          aria-label="Delete Block"
          class="icon-button danger"
          data-action="delete"
          data-tooltip="Delete Block"
          tabindex="-1"
          type="button"
          @click=${this.#deleteSelectedBlock}
        >
          ${ICONS.delete}
        </button>
      </div>
    `;
  }

  /**
   * Next to the text being edited. Alt+F10 reaches it from the text and Escape
   * goes back, so it takes no stop of its own from Tab.
   */
  #renderFormatBar() {
    const formats = this.#formats;
    return html`
      <div
        aria-label="Text formatting"
        class="ui bar format-bar"
        lang=${UI_LANG}
        role="toolbar"
        @keydown=${this.#onFormatBarKeydown}
        @mousedown=${this.#onControlMousedown}
      >
        ${MARK_BUTTONS.map(
          ({ keys, label, mark }) => html`
            <button
              aria-label=${label}
              aria-pressed=${formats?.[mark] ? "true" : "false"}
              class="icon-button"
              data-tooltip=${`${label} (${keys})`}
              ?disabled=${!formats || (mark === "bold" && !formats.canBold)}
              tabindex="-1"
              type="button"
              @click=${() => this.#activeView?.toggleMark(mark)}
            >
              ${ICONS[mark]}
            </button>
          `
        )}
        <span class="separator"></span>
        <button
          aria-label="Link"
          aria-pressed=${formats?.linkHref === undefined ? "false" : "true"}
          class="icon-button"
          data-tooltip=${`Link (${MOD_KEY}K)`}
          ?disabled=${!formats}
          tabindex="-1"
          type="button"
          @click=${this.#openLinkForm}
        >
          ${ICONS.link}
        </button>
        <button
          aria-label="Line break"
          class="icon-button"
          data-tooltip="Line break (Shift+Enter)"
          ?disabled=${!formats}
          tabindex="-1"
          type="button"
          @click=${() => this.#activeView?.insertLineBreak()}
        >
          ${ICONS.lineBreak}
        </button>
        ${this.#linkForm ? this.#renderLinkForm(this.#linkForm.error) : nothing}
      </div>
    `;
  }

  /** Away from the side panel, so it never covers the settings. */
  #renderFloatingToolbar() {
    return html`
      <div
        aria-label="Email tools"
        class="ui bar floating-toolbar"
        role="group"
        tabindex="-1"
        @keydown=${this.#onToolbarKeydown}
        @mousedown=${this.#onControlMousedown}
      >
        <button
          aria-keyshortcuts=${UNDO_SHORTCUTS}
          aria-label="Undo"
          class="icon-button"
          data-tooltip=${`Undo (${UNDO_KEYS})`}
          type="button"
          @click=${() => this.#stepHistory("undo")}
        >
          ${ICONS.undo}
        </button>
        <button
          aria-keyshortcuts=${REDO_SHORTCUTS}
          aria-label="Redo"
          class="icon-button"
          data-tooltip=${`Redo (${REDO_KEYS})`}
          type="button"
          @click=${() => this.#stepHistory("redo")}
        >
          ${ICONS.redo}
        </button>
        <span class="separator"></span>
        <button
          aria-label="Preview"
          class="icon-button"
          data-tooltip="Preview"
          type="button"
          @click=${this.#openPreview}
        >
          ${ICONS.preview}
        </button>
      </div>
    `;
  }

  #renderSidePanel(
    document: BlocksDocument,
    selected: ReturnType<typeof findBlockPosition>
  ) {
    return html`
      <div class="side-panel">
        <div class="side-panel-inner" @keydown=${this.#onPanelKeydown}>
          ${this.#renderPanelView(document, selected)}
        </div>
      </div>
    `;
  }

  #renderPanelView(
    document: BlocksDocument,
    selected: ReturnType<typeof findBlockPosition>
  ) {
    if (this.#showProperties) {
      const rowIndex = document.rows.findIndex(
        ({ id }) => id === this.#selectedRowId
      );
      const row = document.rows[rowIndex];
      if (row) {
        return this.#renderRowProperties(document, row, rowIndex);
      }
      if (selected) {
        return this.#renderProperties(document, selected);
      }
    }
    return this.#renderTabs(document);
  }

  /** A selected Row: its layout, then its settings. Empty Rows too. */
  #renderRowProperties(document: BlocksDocument, row: Row, rowIndex: number) {
    const current = rowLayoutOf(row);
    const section: SettingsSection = {
      command: (props) => ({ props, rowId: row.id, type: "updateRowProps" }),
      fields: ROW_SETTINGS_FIELDS,
      id: "row",
      legend: "Row",
      targetId: row.id,
      unsetColor: document.settings.backgroundColor,
      values: row.props,
    };
    return html`
      ${this.#renderPanelHeader(
        ICONS.rows,
        `Row ${rowIndex + 1}`,
        current ? `${current} layout` : "Custom layout"
      )}
      <div class="panel-scroll">
        <div class="panel-section">
          <p class="panel-section-title" id="row-layout-title">Layout</p>
          <div
            aria-labelledby="row-layout-title"
            class="layout-choices"
            role="group"
            @mousedown=${this.#onControlMousedown}
          >
            ${ROW_LAYOUTS.map(
              (layout) => html`
                <button
                  aria-pressed=${layout === current ? "true" : "false"}
                  class="layout-option"
                  type="button"
                  @click=${() => this.#chooseLayout(row.id, layout, current)}
                >
                  ${renderThumbnail(layout)}<span>${layout}</span>
                </button>
              `
            )}
          </div>
        </div>
        ${this.#renderSettings([section])}
      </div>
    `;
  }

  /** The selected Block's fields. A Row's show when the Row is selected. */
  #renderProperties(
    document: BlocksDocument,
    {
      block,
      columnId,
      rowIndex,
    }: NonNullable<ReturnType<typeof findBlockPosition>>
  ) {
    const row = document.rows[rowIndex];
    const columnIndex =
      row?.columns.findIndex(({ id }) => id === columnId) ?? 0;
    const sections: SettingsSection[] = [
      {
        command: (props) => ({
          blockId: block.id,
          props,
          type: "updateProps",
        }),
        fields: blockSettingsFields(block),
        id: "block",
        legend: "Block",
        targetId: block.id,
        values: block.props,
      },
    ];
    return html`
      ${this.#renderPanelHeader(
        blockIcon(block.type),
        blockLabel(block.type),
        columnLabel(rowIndex, columnIndex)
      )}
      <div class="panel-scroll">${this.#renderSettings(sections)}</div>
    `;
  }

  /** What the side panel shows, with a way Back to its tabs. */
  #renderPanelHeader(icon: TemplateResult, title: string, subtitle: string) {
    return html`
      <div class="panel-header" @mousedown=${this.#onControlMousedown}>
        <button
          aria-label="Back"
          class="icon-button back-button"
          data-tooltip="Back"
          type="button"
          @click=${this.#showTabs}
        >
          ${ICONS.left}
        </button>
        <span class="type-badge">${icon}</span>
        <div class="panel-heading">
          <p class="panel-title">${title}</p>
          <p class="panel-subtitle">${subtitle}</p>
        </div>
      </div>
    `;
  }

  #renderTabs(document: BlocksDocument) {
    const current = this.#panelTab;
    return html`
      <div class="panel-top">
        <div
          aria-label="Side panel"
          class="tabs"
          role="tablist"
          @keydown=${onToolbarArrowKeys}
        >
          ${PANEL_TABS.map(
            ({ icon, id, label }) => html`
              <button
                aria-controls=${id === current ? `tabpanel-${id}` : nothing}
                aria-selected=${id === current ? "true" : "false"}
                class="tab"
                id=${`tab-${id}`}
                role="tab"
                tabindex=${id === current ? "0" : "-1"}
                type="button"
                @click=${() => this.#selectTab(id)}
                @focus=${() => this.#selectTab(id)}
              >
                ${icon}<span>${label}</span>
              </button>
            `
          )}
        </div>
      </div>
      <div
        aria-labelledby=${`tab-${current}`}
        class=${current === "settings" ? "panel-scroll" : "panel-scroll padded"}
        id=${`tabpanel-${current}`}
        role="tabpanel"
      >
        ${this.#renderTabPanel(current, document)}
      </div>
    `;
  }

  #renderTabPanel(tab: PanelTab, document: BlocksDocument) {
    switch (tab) {
      case "content": {
        return html`
          <div class="panel-intro">
            <p class="panel-section-title">Blocks</p>
            <p class="panel-hint">
              Drag one onto the email, or choose one to add it after the
              selected Block, into the selected Row, or at the end.
            </p>
          </div>
          <div
            aria-label="Add content"
            class="tiles"
            role="group"
            @mousedown=${this.#onControlMousedown}
          >
            ${BLOCK_TYPES.map(
              ({ label, type }) => html`
                <button
                  class="tile"
                  data-block-type=${type}
                  type="button"
                  @click=${() => this.#addBlock(type)}
                >
                  ${blockIcon(type)}
                  <span>${label}</span>
                </button>
              `
            )}
          </div>
        `;
      }
      case "rows": {
        return html`
          <div class="panel-intro">
            <p class="panel-section-title">Layouts</p>
            <p class="panel-hint">
              Drag one between Rows, or choose one to add it after the selected
              Row, or at the end of the email.
            </p>
          </div>
          <div
            aria-label="Add a Row"
            class="layout-tiles"
            role="group"
            @mousedown=${this.#onControlMousedown}
          >
            ${ROW_LAYOUTS.map(
              (layout) => html`
                <button
                  class="layout-tile"
                  data-row-layout=${layout}
                  type="button"
                  @click=${() => this.#addRow(layout)}
                >
                  ${renderThumbnail(layout)}<span>${layout}</span>
                </button>
              `
            )}
          </div>
        `;
      }
      default: {
        return this.#renderSettings([
          {
            command: (settings) => ({ settings, type: "updateEmailSettings" }),
            fields: EMAIL_SETTINGS_FIELDS,
            id: "email",
            legend: "Email",
            targetId: "",
            values: { ...document.settings },
          },
        ]);
      }
    }
  }

  #renderSettings(sections: SettingsSection[]) {
    return renderSettingsPanel(sections, {
      draftOf: (key) => this.#drafts.get(key),
      onCommit: (section, field, control) =>
        this.#commitField(section, field, control),
      onInput: (section, field, { value }) =>
        this.#draftField(section, field, value),
      onKeydown: (event) => this.#onSettingsKeydown(event),
    });
  }

  /**
   * The dialog stays rendered so that closing it, not removing it, returns focus.
   * An empty `sandbox` gives the email an opaque origin and no scripts, forms,
   * popups or top-level navigation.
   */
  #renderPreview() {
    const preview = this.#preview;
    return html`
      <dialog
        aria-labelledby="preview-title"
        class="preview"
        @close=${this.#onPreviewClose}
      >
        <div class="ui preview-panel">
          <div class="preview-header">
            <h2 id="preview-title">Preview</h2>
            <button
              class="text-button"
              type="button"
              @click=${this.#closePreview}
            >
              Close
            </button>
          </div>
          ${preview ? renderPreviewContent(preview) : nothing}
        </div>
      </dialog>
    `;
  }

  #renderLinkForm(error: boolean) {
    const href = this.#formats?.linkHref;
    return html`
      <form
        class="link-form"
        novalidate
        @beforeinput=${stopPropagation}
        @keydown=${this.#onLinkFormKeydown}
        @submit=${this.#onLinkFormSubmit}
      >
        <label>
          Link URL
          <input
            aria-describedby=${error ? "link-error" : nothing}
            aria-invalid=${error ? "true" : "false"}
            autocomplete="off"
            name="href"
            spellcheck="false"
            type="text"
            value=${href ?? ""}
          />
        </label>
        <button class="text-button primary" type="submit">Apply</button>
        ${
          href === undefined
            ? nothing
            : html`
                <button
                  class="text-button"
                  type="button"
                  @click=${this.#removeLink}
                >
                  Remove link
                </button>
              `
        }
        <button
          class="text-button"
          type="button"
          @click=${this.#cancelLinkForm}
        >
          Cancel
        </button>
        ${
          error
            ? html`<p id="link-error" role="alert">${INVALID_LINK}</p>`
            : nothing
        }
      </form>
    `;
  }

  get #activeView() {
    return this.#activeBlockId === undefined
      ? undefined
      : this.#views.get(this.#activeBlockId);
  }

  /** Firefox's scroll on focus leaves a Block that's partly in view where it is. */
  #onBlockFocus({ currentTarget }: FocusEvent, blockId: string) {
    this.#editingText = false;
    this.#selectBlock(blockId);
    (currentTarget as HTMLElement).scrollIntoView({ block: "nearest" });
  }

  /**
   * Shows the selected Block's settings again after Back, when its text still has
   * focus and so gets no new focus event. Its own toolbars leave the panel be.
   */
  #onBlockClick({ currentTarget, target }: MouseEvent) {
    if (
      !this.#showProperties &&
      (currentTarget as HTMLElement).dataset.blockId === this.#activeBlockId &&
      !(target as Element).closest(".block-toolbar, .format-bar")
    ) {
      this.#showProperties = true;
      this.requestUpdate();
    }
  }

  /**
   * The text stops being edited once focus leaves it and its format bar. State
   * rather than CSS, which would hide the bar while focus is on its way there.
   * Checked once focus has landed: the Preview opening over the text, or the
   * window losing focus while a URL is copied elsewhere, leave the bar as it is.
   */
  #onBlockFocusout() {
    if (!this.#editingText) {
      return;
    }
    setTimeout(() => {
      const active = this.shadowRoot?.activeElement;
      if (
        this.#editingText &&
        document.hasFocus() &&
        !active?.closest(".ProseMirror, .format-bar, .preview")
      ) {
        this.#editingText = false;
        this.requestUpdate();
      }
    }, 0);
  }

  #selectBlock(blockId: string) {
    this.#activeBlockId = blockId;
    this.#selectedRowId = undefined;
    this.#showProperties = true;
    this.#closeLinkForm();
    this.#syncFormats();
    this.requestUpdate();
  }

  /**
   * Selects a Row in place of any Block, and shows its settings. Its toolbar's
   * button takes focus, so typing can't go on in a Block's text.
   */
  async #selectRow(rowId: string) {
    this.#clearBlockSelection();
    this.#selectedRowId = rowId;
    this.#showProperties = true;
    this.requestUpdate();
    await this.updateComplete;
    const button = this.renderRoot
      .querySelector(`.row-frame[data-row-selected] .row-toolbar`)
      ?.querySelector<HTMLElement>('[aria-label="Select Row"]');
    if (button && this.shadowRoot?.activeElement !== button) {
      button.focus({ focusVisible: false } as FocusOptions);
    }
  }

  /** No Block selected, nor its text, format bar or link field. */
  #clearBlockSelection() {
    this.#activeBlockId = undefined;
    this.#editingText = false;
    this.#formats = undefined;
    this.#linkForm = undefined;
  }

  /** Re-renders only on a change, because this runs on every transaction. */
  #syncFormats() {
    const formats = this.#activeView?.formats();
    if (JSON.stringify(formats) !== JSON.stringify(this.#formats)) {
      this.#formats = formats;
      this.requestUpdate();
    }
  }

  /** From the Block itself too: its text takes focus, and shows the format bar. */
  async #openLinkForm() {
    const view = this.#activeView;
    if (!view) {
      return;
    }
    if (!this.#editingText) {
      view.focus();
    }
    this.#linkForm = { error: false };
    this.requestUpdate();
    await this.updateComplete;
    const input =
      this.renderRoot.querySelector<HTMLInputElement>(".link-form input");
    input?.focus();
    input?.select();
  }

  #closeLinkForm() {
    if (this.#linkForm) {
      this.#linkForm = undefined;
      this.requestUpdate();
    }
  }

  #cancelLinkForm() {
    this.#closeLinkForm();
    this.#activeView?.focus();
  }

  #removeLink() {
    this.#closeLinkForm();
    this.#activeView?.removeLink();
  }

  /**
   * The link field has its own typing and undo, so its keys stop here, before
   * the format bar, the Block and the email act on them.
   */
  #onLinkFormKeydown(event: KeyboardEvent) {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      this.#cancelLinkForm();
    }
  }

  /** Escape goes back to the text, as from the link field. */
  #onFormatBarKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && !isComposing(event)) {
      event.preventDefault();
      event.stopPropagation();
      this.#activeView?.focus();
      return;
    }
    onToolbarArrowKeys(event);
  }

  #onLinkFormSubmit(event: SubmitEvent) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const href = String(new FormData(form).get("href")).trim();
    if (!isAllowedLinkHref(href)) {
      this.#linkForm = { error: true };
      this.requestUpdate();
      return;
    }
    this.#closeLinkForm();
    this.#activeView?.setLink(href);
  }

  get #previewDialog() {
    return this.renderRoot.querySelector<HTMLDialogElement>(".preview");
  }

  /** Shows the document as it is now, compiling it only if it has changed. */
  async #openPreview({ currentTarget }: Event) {
    // Toolbar buttons don't take focus from a mouse press, and the dialog returns
    // focus to whatever had it.
    if (!this.shadowRoot?.activeElement) {
      (currentTarget as HTMLElement).focus();
    }

    const cached = this.#previewHtml;
    const preview: Preview = {};
    if (cached !== undefined) {
      preview.result = { html: cached };
    }
    this.#preview = preview;
    this.#previewDialog?.showModal();
    this.requestUpdate();
    if (cached !== undefined) {
      return;
    }

    try {
      const email = await this.exportHtml();
      preview.result = { html: email };
      // Closed in the meantime, so the document may have changed since.
      if (this.#preview === preview) {
        this.#previewHtml = email;
      }
    } catch (error) {
      console.error("<mail-quilt> couldn't render the preview", error);
      preview.result = {
        failure: error instanceof Error ? error.message : String(error),
      };
    }
    this.requestUpdate();
  }

  #closePreview() {
    this.#previewDialog?.close();
  }

  #onPreviewClose() {
    // This event is queued, so it can arrive after the next opening.
    if (this.#previewDialog?.open) {
      return;
    }
    this.#preview = undefined;
    this.requestUpdate();
  }

  /** Applies a Command that changes the structure of the email. */
  #apply(command: Command) {
    if (this.#tryCommand(command)) {
      this.#publishStructure();
    }
  }

  readonly #onImageError = (src: string) => {
    this.#failedImages.add(src);
    this.requestUpdate();
  };

  /** The accepted result, leaving the caller to show and report the change. */
  #tryCommand(command: Command) {
    const result = this.#editor?.apply(command);
    if (result && !result.ok && !result.unchanged) {
      // The controls only offer what's allowed, so this is a bug here.
      console.error(`<mail-quilt> rejected a Command: ${result.reason}`);
    }
    return result?.ok ? result : undefined;
  }

  #publishStructure() {
    const document = this.#editor?.getDocument();
    if (document) {
      this.requestUpdate();
      this.#emitChange(document);
    }
  }

  #draftField(section: SettingsSection, field: SettingsField, text: string) {
    const key = draftKey(section, field);
    const refused = this.#drafts.get(key)?.refused ?? false;
    if (text === fieldText(field, section.values) && !refused) {
      this.#drafts.delete(key);
    } else {
      this.#drafts.set(key, { refused, text });
    }
  }

  /** Each commit is one undo step. What can't be accepted stays to be fixed. */
  #commitField(
    section: SettingsSection,
    field: SettingsField,
    control: HTMLInputElement | HTMLSelectElement
  ) {
    const key = draftKey(section, field);
    // Rejections are expected here, as they're what a person typed.
    const result = this.#editor?.apply(
      section.command({ [field.key]: fieldValue(field, control) })
    );
    if (result?.ok || result?.unchanged) {
      this.#drafts.delete(key);
    } else {
      this.#drafts.set(key, { refused: true, text: control.value });
    }
    if (result?.ok) {
      this.#publishStructure();
      this.#retryRefusedFields(section);
    } else {
      this.requestUpdate();
    }
  }

  /** A change to one field can make what another was refused for fine. */
  #retryRefusedFields(section: SettingsSection) {
    for (const field of section.fields) {
      const key = draftKey(section, field);
      const control = this.renderRoot.querySelector<HTMLInputElement>(
        `[data-draft-key="${CSS.escape(key)}"]`
      );
      if (control && this.#drafts.get(key)?.refused) {
        this.#commitField(section, field, control);
      }
    }
  }

  /**
   * Text being typed has the field's own undo, like the link field. Otherwise undo
   * is the email's, as everywhere else, and Escape takes back what was typed.
   */
  #onSettingsKeydown(event: KeyboardEvent) {
    const { dataset } = event.target as HTMLElement;
    const key = dataset.draftKey;
    if (key !== undefined && this.#drafts.has(key)) {
      if (event.key === "Escape" && !isComposing(event)) {
        event.preventDefault();
        event.stopPropagation();
        this.#drafts.delete(key);
        this.requestUpdate();
      }
      return;
    }
    this.#runHistoryStep(event, historyShortcut(event));
  }

  #chooseLayout(
    rowId: string,
    layout: RowLayout,
    current: RowLayout | undefined
  ) {
    if (layout !== current) {
      this.#apply({ layout, rowId, type: "setRowLayout" });
    }
  }

  #selectedPosition(document: BlocksDocument) {
    return this.#activeBlockId === undefined
      ? undefined
      : findBlockPosition(document, this.#activeBlockId);
  }

  /** After the selected Block's Row, or else at the end. */
  #addRow(layout: RowLayout) {
    const document = this.#editor?.getDocument();
    if (!document) {
      return;
    }
    const selectedRow = document.rows.findIndex(
      ({ id }) => id === this.#selectedRowId
    );
    const rowIndex =
      selectedRow === -1
        ? this.#selectedPosition(document)?.rowIndex
        : selectedRow;
    this.#apply({
      index: rowIndex === undefined ? document.rows.length : rowIndex + 1,
      layout,
      type: "insertRow",
    });
  }

  #onWorkspacePointerdown({ currentTarget, target }: PointerEvent) {
    this.#pressedOnWorkspace = target === currentTarget;
  }

  /**
   * A click on the workspace around the email clears the selection, as in any
   * design tool. The floating toolbar takes focus, so keyboard undo still works.
   */
  #onWorkspaceClick({ currentTarget, target }: MouseEvent) {
    if (
      target !== currentTarget ||
      !this.#pressedOnWorkspace ||
      (this.#activeBlockId === undefined && this.#selectedRowId === undefined)
    ) {
      return;
    }
    this.#clearBlockSelection();
    this.#selectedRowId = undefined;
    this.#floatingToolbar?.focus({ focusVisible: false } as FocusOptions);
    this.requestUpdate();
  }

  /** Back to the tabs, with the Block still selected for what's added next. */
  async #showTabs() {
    const fromKeyboard =
      this.shadowRoot?.activeElement?.matches(".back-button") ?? false;
    this.#showProperties = false;
    this.requestUpdate();
    if (fromKeyboard) {
      await this.updateComplete;
      this.#tabButton(this.#panelTab)?.focus();
    }
  }

  /** The ARIA tabs pattern: a tab that arrow keys move to shows its panel too. */
  #selectTab(tab: PanelTab) {
    if (tab !== this.#panelTab) {
      this.#panelTab = tab;
      this.requestUpdate();
    }
  }

  #tabButton(tab: PanelTab) {
    return this.renderRoot.querySelector<HTMLElement>(`#tab-${tab}`);
  }

  #deleteSelectedBlock() {
    if (this.#activeBlockId !== undefined) {
      this.#apply({ blockId: this.#activeBlockId, type: "removeBlock" });
    }
  }

  /**
   * Adds a Block and selects it, ready to type in if it has text. By default it
   * goes after the selected Block, or else at the end of the last Column.
   */
  async #addBlock(
    blockType: string,
    place?: { columnId: string; index: number }
  ) {
    const editor = this.#editor;
    if (!editor) {
      return;
    }
    const target = place ?? this.#defaultBlockPlace(editor);
    const block = this.#tryCommand(
      target
        ? { blockType, ...target, type: "insertBlock" }
        : { blockType, rowIndex: 0, type: "insertBlockInNewRow" }
    );
    if (block) {
      await this.#showPlaced(block.createdId);
    }
  }

  /**
   * Reports a change that put a Block in place, then selects it, in its text if
   * it has any.
   */
  async #showPlaced(blockId: string | undefined) {
    this.#activeBlockId = blockId;
    this.#publishStructure();
    await this.updateComplete;
    if (this.#activeView) {
      this.#activeView.focus();
    } else if (blockId !== undefined) {
      this.#blockElement(blockId)?.focus();
    }
  }

  /**
   * After the selected Block, at the end of the selected Row's first Column, or
   * else at the end of the email.
   */
  #defaultBlockPlace(editor: Editor) {
    const document = editor.getDocument();
    const selected = this.#selectedPosition(document);
    if (selected) {
      return { columnId: selected.columnId, index: selected.index + 1 };
    }
    const column =
      document.rows.find(({ id }) => id === this.#selectedRowId)?.columns[0] ??
      document.rows.at(-1)?.columns.at(-1);
    return column && { columnId: column.id, index: column.blocks.length };
  }

  async #drop(source: DragSource, place: DropPlace) {
    const result = this.#tryCommand(dropCommand(source, place));
    if (!result) {
      return;
    }
    if ("rowId" in source) {
      this.#announceRowMove(source.rowId);
      this.#publishStructure();
      await this.updateComplete;
      // Lit may move the Row's element when it reorders the Rows, which takes focus
      // from anything in it. The selection stays, so it gets focus back: in its
      // text if that's where it was, or on the selected Row's tools.
      if (!this.shadowRoot?.activeElement) {
        const block =
          this.#activeBlockId === undefined
            ? undefined
            : this.#blockElement(this.#activeBlockId);
        const view = this.#editingText ? this.#activeView : undefined;
        const rowTool = this.renderRoot.querySelector<HTMLElement>(
          ".row-frame[data-row-selected] .row-toolbar button"
        );
        (view ?? block ?? rowTool ?? this.#floatingToolbar)?.focus();
      }
      return;
    }
    if ("rowLayout" in source) {
      this.#publishStructure();
      if (result.createdId !== undefined) {
        await this.#selectRow(result.createdId);
      }
      return;
    }
    if ("blockId" in source) {
      this.#announceMove(source.blockId);
    }
    await this.#showPlaced(
      "blockId" in source ? source.blockId : result.createdId
    );
  }

  #commitText(blockId: string, content: RichTextDocument) {
    const editor = this.#editor;
    if (!editor) {
      return;
    }
    const now = performance.now();
    if (now - this.#lastTypedAt >= TYPING_PAUSE_MS) {
      this.#typingSession += 1;
    }
    this.#lastTypedAt = now;
    const result = editor.apply(
      { blockId, props: { content }, type: "updateProps" },
      { mergeKey: `${blockId}:${this.#typingSession}` }
    );
    if (!result.ok) {
      if (!result.unchanged) {
        // The text schema should be no wider than core's, so this is a bug here.
        console.error(`<mail-quilt> rejected an edit: ${result.reason}`);
      }
      return;
    }
    this.#emitChange(editor.getDocument());
  }

  #onBeforeInput(event: InputEvent) {
    // WebKit types into a Block's selection, and undoes there too, even with focus
    // on the dialog, a control, the link field or the Block itself.
    const active = this.shadowRoot?.activeElement;
    if (
      this.#previewDialog?.open ||
      (active && !active.closest(".ProseMirror"))
    ) {
      event.preventDefault();
      return;
    }
    this.#runHistoryStep(event, historyInput(event));
  }

  #onKeydown(event: KeyboardEvent) {
    if (
      event.altKey &&
      event.key === "F10" &&
      (event.target as Element).closest(".ProseMirror")
    ) {
      event.preventDefault();
      this.renderRoot
        .querySelector<HTMLElement>(".format-bar > button:not(:disabled)")
        ?.focus();
      return;
    }
    if (isLinkShortcut(event)) {
      // Browsers use this one to focus their search or address bar.
      event.preventDefault();
      this.#openLinkForm();
      return;
    }
    this.#runHistoryStep(event, historyShortcut(event));
  }

  /**
   * A key that moved focus into a Block's text would otherwise keep repeating
   * there, adding empty paragraphs. Repeats only count where the press began.
   */
  readonly #onKeydownCapture = (event: KeyboardEvent) => {
    if (event.key !== "Enter") {
      return;
    }
    const [target] = event.composedPath();
    if (!event.repeat) {
      this.#enterPressedOn = target;
    } else if (target !== this.#enterPressedOn) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  /**
   * These act only with focus on the Block itself, apart from the Move buttons'
   * Alt+arrow shortcuts, which also work in its toolbar. In its text, the same
   * keys move the cursor, by word with Alt on macOS, and Enter starts a new
   * paragraph.
   */
  #onBlockKeydown(event: KeyboardEvent) {
    // The Blocks would change under a drag that's still going.
    if (this.#dragging?.isDragging()) {
      return;
    }
    const block = event.currentTarget as HTMLElement;
    const target = event.target as Element;
    const direction = arrowDirection(event);
    if (event.altKey && direction && target.closest(".block-toolbar")) {
      // Alt+Left would go back in history.
      event.preventDefault();
      this.#moveSelectedBlock(direction);
      return;
    }
    if (target !== block) {
      if (event.key === "Escape" && !isComposing(event)) {
        event.preventDefault();
        // This one is used up, so a host's dialog stays open. Pressed again on the
        // Block, it reaches the host.
        event.stopPropagation();
        block.focus();
      }
      return;
    }
    if (event.key === "Enter") {
      // Otherwise the new paragraph lands in the text that just took focus.
      event.preventDefault();
      this.#activeView?.focus();
      return;
    }
    if (!direction) {
      return;
    }
    // The page would scroll too, or go back in history with Alt+Left.
    event.preventDefault();
    if (event.altKey) {
      this.#moveSelectedBlock(direction);
    } else {
      this.#selectNeighbour(direction);
    }
  }

  #selectNeighbour(direction: Direction) {
    const document = this.#editor?.getDocument();
    const blockId = this.#activeBlockId;
    const next =
      document &&
      blockId !== undefined &&
      neighbourBlockId(document, blockId, direction);
    if (next) {
      this.#blockElement(next)?.focus();
    }
  }

  #moveSelectedBlock(direction: Direction) {
    const document = this.#editor?.getDocument();
    const blockId = this.#activeBlockId;
    if (!document || blockId === undefined) {
      return;
    }
    const command = moveCommand(document, blockId, direction);
    if (!command) {
      this.#announce(`The Block can't move ${direction}.`);
      return;
    }
    if (this.#tryCommand(command)) {
      this.#announceMove(blockId);
      this.#publishStructure();
      this.#revealBlock(blockId);
    }
  }

  #announceMove(blockId: string, prefix = "Moved to") {
    const document = this.#editor?.getDocument();
    const place = document && placeLabel(document, blockId);
    if (place) {
      this.#announce(`${prefix} ${place}.`);
    }
  }

  #announce(text: string) {
    this.#announcement = text;
    this.#announcementId += 1;
    this.requestUpdate();
  }

  #onRowToolbarKeydown(event: KeyboardEvent, rowId: string) {
    // The Rows would change under a drag that's still going.
    if (this.#dragging?.isDragging()) {
      return;
    }
    const direction = arrowDirection(event);
    if (event.altKey && (direction === "up" || direction === "down")) {
      event.preventDefault();
      this.#moveRow(rowId, direction);
    }
  }

  /** One step, keeping the selection, and focus on the Row's tools if it was there. */
  #moveRow(rowId: string, direction: "down" | "up") {
    const rows = this.#editor?.getDocument().rows ?? [];
    const index = rows.findIndex(({ id }) => id === rowId);
    const to = index + (direction === "up" ? -1 : 1);
    if (index === -1 || to < 0 || to >= rows.length) {
      this.#announce(`The Row can't move ${direction}.`);
      return;
    }
    if (this.#tryCommand({ index: to, rowId, type: "moveRow" })) {
      this.#announceRowMove(rowId);
      this.#publishStructure();
      this.#revealRow(rowId);
    }
  }

  #announceRowMove(rowId: string, prefix = "Row moved to") {
    const rows = this.#editor?.getDocument().rows ?? [];
    const index = rows.findIndex(({ id }) => id === rowId);
    if (index !== -1) {
      this.#announce(`${prefix} ${positionLabel(index, rows.length)}.`);
    }
  }

  async #revealRow(rowId: string) {
    await this.updateComplete;
    this.renderRoot
      .querySelector(`.row-frame[data-row-id="${CSS.escape(rowId)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }

  /**
   * Focus alone doesn't do this. A Block keeps focus if its neighbour is what moves
   * in the DOM, and focusing its text doesn't scroll.
   */
  async #revealBlock(blockId: string) {
    await this.updateComplete;
    this.#blockElement(blockId)?.scrollIntoView({ block: "nearest" });
  }

  #blockElement(blockId: string) {
    return this.renderRoot.querySelector<HTMLElement>(
      `${BLOCKS}[data-block-id="${CSS.escape(blockId)}"]`
    );
  }

  /**
   * Pressing a control leaves focus and the selection in the Block. With no focus
   * in the editor, the control takes it, because keyboard undo only reaches the
   * editor from inside it. Browsers disagree on whether a press focuses a button.
   */
  #onControlMousedown(event: MouseEvent) {
    const { target } = event;
    if (target instanceof HTMLInputElement) {
      return;
    }
    event.preventDefault();
    this.#commitFocusedField();
    if (!this.shadowRoot?.activeElement && target instanceof Element) {
      // Without a ring, as for any other press with the pointer.
      target.closest("button")?.focus({ focusVisible: false } as FocusOptions);
    }
  }

  /**
   * Leaves focus and the selection where they are. With no focus in the editor,
   * the floating toolbar takes it, because keyboard undo only reaches the editor
   * from inside.
   */
  readonly #onHandleMousedown = (event: MouseEvent) => {
    event.preventDefault();
    this.#commitFocusedField();
    if (!this.shadowRoot?.activeElement) {
      this.#floatingToolbar?.focus();
    }
  };

  get #floatingToolbar() {
    return this.renderRoot.querySelector<HTMLElement>(".floating-toolbar");
  }

  /** A new render can replace the tooltip, along with everything else. */
  #syncTooltips(root: ShadowRoot) {
    const element = root.querySelector<HTMLElement>(".tooltip");
    if (element !== this.#tooltips?.element) {
      this.#tooltips?.tooltips.destroy();
      this.#tooltips = element
        ? { element, tooltips: createTooltips(root, element) }
        : undefined;
    }
    this.#tooltips?.tooltips.sync();
  }

  /**
   * The presses above keep focus where it is, so a settings field would hold on to
   * what's typed in it while the press acts on the email. Blurring commits it.
   */
  #commitFocusedField() {
    const active = this.shadowRoot?.activeElement;
    if (active?.closest(".settings")) {
      (active as HTMLElement).blur();
    }
  }

  /** Undo and redo from the tabs and tiles. The settings fields have their own. */
  #onPanelKeydown(event: KeyboardEvent) {
    if (!(event.target as Element).closest(".settings")) {
      this.#runHistoryStep(event, historyShortcut(event));
    }
  }

  /** Undo and redo from a toolbar button, where a Block may no longer have focus. */
  #onToolbarKeydown(event: KeyboardEvent) {
    this.#runHistoryStep(event, historyShortcut(event));
  }

  #runHistoryStep(event: Event, step: "redo" | "undo" | undefined) {
    if (!step) {
      return;
    }
    // The browser's own undo would change the text behind the document's back.
    event.preventDefault();
    this.#stepHistory(step);
  }

  #stepHistory(step: "redo" | "undo") {
    const editor = this.#editor;
    if (!editor) {
      return;
    }
    let moved: MoveOperation[] = [];
    const stopListening = editor.subscribe((operations) => {
      moved = operations.filter(
        (operation): operation is MoveOperation => operation.type === "move"
      );
    });
    const changed = editor[step]();
    stopListening();
    if (!changed) {
      return;
    }
    // The change can move the selection the link field would apply to.
    this.#closeLinkForm();
    // What was refused may be fine now, and the fields show what's come back.
    this.#drafts.clear();
    this.#announceHistoryStep(step, moved);
    const document = editor.getDocument();
    for (const row of document.rows) {
      for (const column of row.columns) {
        for (const block of column.blocks) {
          this.#views
            .get(block.id)
            ?.setContent(block.props.content as RichTextDocument);
        }
      }
    }
    // Undo and redo can add, remove or move Blocks, Columns and Rows.
    this.requestUpdate();
    this.#emitChange(document);
  }

  /** One Block or Row moved, or nothing to say. A layout can move many at once. */
  #announceHistoryStep(step: "redo" | "undo", moved: MoveOperation[]) {
    const [operation] = moved;
    if (operation === undefined || moved.length > 1) {
      this.#announce("");
      return;
    }
    const prefix = step === "undo" ? "Undo moved" : "Redo moved";
    if ("rowId" in operation) {
      this.#announceRowMove(operation.rowId, `${prefix} a Row to`);
      return;
    }
    const { blockId } = operation;
    this.#announceMove(blockId, `${prefix} a Block to`);
    if (blockId === this.#activeBlockId) {
      this.#revealBlock(blockId);
    }
  }

  #show(document: BlocksDocument | undefined) {
    this.#lastKnownDocument = document;
    this.#previewHtml = undefined;
    this.#announcement = "";
    this.#drafts.clear();
    // A URL that failed before may load now, as its image may have been
    // uploading, or the connection down.
    this.#failedImages.clear();
    this.#destroyViews();
    this.#editor = document && createEditor({ document });
    this.requestUpdate();
  }

  #emitChange(document: BlocksDocument) {
    // A copy, because the host owns what it receives and may change it.
    this.#lastKnownDocument = structuredClone(document);
    this.#previewHtml = undefined;
    this.dispatchEvent(
      new CustomEvent("mq-change", {
        bubbles: true,
        composed: true,
        detail: { document },
      })
    );
  }

  #emitError(reason: string) {
    // Later, because a host may set `value` just before adding its listener.
    queueMicrotask(() => {
      this.dispatchEvent(
        new CustomEvent("mq-error", {
          bubbles: true,
          composed: true,
          detail: { reason },
        })
      );
    });
  }

  /** A Block that undo brings back gets a new view from the document. */
  #removeViewsExcept(blockIds: Set<string>) {
    for (const [blockId, view] of this.#views) {
      if (!blockIds.has(blockId)) {
        view.destroy();
        this.#views.delete(blockId);
      }
    }
    if (
      this.#activeBlockId !== undefined &&
      !blockIds.has(this.#activeBlockId)
    ) {
      this.#clearBlockSelection();
    }
  }

  #destroyViews() {
    for (const view of this.#views.values()) {
      view.destroy();
    }
    this.#views.clear();
    // The toolbar's state describes those views and their selections.
    this.#clearBlockSelection();
    // The Preview shows the old document. A removed dialog also stays `open`, so
    // it would come back without being modal.
    if (this.#preview) {
      this.#previewDialog?.close();
      this.#preview = undefined;
    }
  }
}

if (!customElements.get("mail-quilt")) {
  customElements.define("mail-quilt", MailQuilt);
}

declare global {
  interface HTMLElementEventMap {
    "mq-change": CustomEvent<{ document: BlocksDocument }>;
    "mq-error": CustomEvent<{ reason: string }>;
  }

  interface HTMLElementTagNameMap {
    "mail-quilt": MailQuilt;
  }
}
