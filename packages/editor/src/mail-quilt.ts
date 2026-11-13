import {
  BLOCK_TYPES,
  blockLabel,
  blockStyles,
  createEditor,
  isAllowedLinkHref,
  isSameDocument,
  loadDocument,
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
import { keyed } from "lit/directives/keyed.js";
import { repeat } from "lit/directives/repeat.js";
import { styleMap } from "lit/directives/style-map.js";

import {
  blockContentStyles,
  hasRichText,
  renderBlockContent,
} from "./block-content.js";
import { BLOCKS, createBlockDragging, dropCommand } from "./block-dragging.js";
import type { BlockDragging, DragSource, DropPlace } from "./block-dragging.js";
import {
  arrowDirection,
  blocksIn,
  columnLabel,
  historyInput,
  historyShortcut,
  isComposing,
  isLinkShortcut,
  locate,
  MOVE_BUTTONS,
  moveCommand,
  moveRowCommand,
  neighbourBlockId,
  onToolbarArrowKeys,
  placeLabel,
  positionLabel,
  REDO_KEYS,
  REDO_SHORTCUTS,
  ROW_MOVE_BUTTONS,
  UNDO_KEYS,
  UNDO_SHORTCUTS,
} from "./block-keyboard.js";
import type { Direction } from "./block-keyboard.js";
import { formatBarStyles, renderFormatBar } from "./format-bar.js";
import type { FormatBarEvents } from "./format-bar.js";
import { blockIcon, ICONS } from "./icons.js";
import { previewStyles, renderPreview } from "./preview.js";
import type { Preview, PreviewEvents } from "./preview.js";
import {
  draftKey,
  fieldText,
  fieldValue,
  settingsPanelStyles,
} from "./settings-panel.js";
import type { FieldDraft, SettingsSection } from "./settings-panel.js";
import { renderSidePanel, sidePanelStyles } from "./side-panel.js";
import type { PanelTab, SidePanelEvents } from "./side-panel.js";
import { createTextBlockView } from "./text-block-view.js";
import type { TextBlockView, TextFormats } from "./text-block-view.js";
import { themeTokens, UI_LANG, uiStyles } from "./theme.js";
import { createTooltips } from "./tooltips.js";
import type { Tooltips } from "./tooltips.js";

/** Narrower than this, there's no room to edit, and a notice shows instead. */
const MIN_EDITOR_WIDTH = 640;

/** Typing after a gap this long starts a new undo step. */
const TYPING_PAUSE_MS = 1000;

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

type MoveOperation = Extract<Operation, { type: "move" }>;

export class MailQuilt extends LitElement {
  static override styles = [
    themeTokens,
    uiStyles,
    settingsPanelStyles,
    sidePanelStyles,
    blockContentStyles,
    formatBarStyles,
    previewStyles,
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

      /* The Row that follows the pointer, which also shows what's under it. */
      .row-frame[data-drag-ghost] {
        background: #ffffff;
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
  #selectedBlockId: string | undefined;
  /** Whether focus is in the selected Block's text or its format bar. */
  #editingText = false;
  /** The selected Row, when a Row rather than a Block is selected. */
  #selectedRowId: string | undefined;
  /** Whether the side panel shows the selected Block's or Row's settings, not its tabs. */
  #showProperties = false;
  #panelTab: PanelTab = "content";
  /** What had focus in the editor when the current update began. */
  #focusedBeforeUpdate: Element | null | undefined;
  /** Set while `updated` gives focus back, which selects nothing new. */
  #restoringFocus = false;
  #formats: TextFormats | undefined;
  /** Text in the settings panel that isn't the document's value. */
  readonly #drafts = new Map<string, FieldDraft>();
  /** One copy of the document for each update, as `value` makes a new one. */
  #rendered: BlocksDocument | undefined;
  /** Image URLs that didn't load, which the canvas stops trying to show. */
  readonly #failedImages = new Set<string>();
  /** Set while the link field is open. */
  #linkForm: { refusals: number } | undefined;
  /** Set while the Preview is open. */
  #preview: Preview | undefined;
  /** The current document's HTML, once the Preview has rendered it. */
  #previewHtml: string | undefined;
  /** Set while the element is connected. */
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

  readonly #sidePanelEvents: SidePanelEvents = {
    onAddBlock: (blockType) => this.#addBlock(blockType),
    onAddRow: (layout) => this.#addRow(layout),
    onBack: () => this.#showTabs(),
    onChooseLayout: (rowId, layout) =>
      this.#apply({ layout, rowId, type: "setRowLayout" }),
    onControlMousedown: (event) => this.#onControlMousedown(event),
    onSelectTab: (tab) => this.#selectTab(tab),
    settings: {
      draftOf: (key) => this.#drafts.get(key),
      onCommit: (section, field, control) =>
        this.#commitField(section, field, control),
      onInput: (section, field, { value }) =>
        this.#draftField(section, field, value),
      onKeydown: (event) => this.#onSettingsKeydown(event),
    },
  };

  readonly #formatBarEvents: FormatBarEvents = {
    onBack: () => this.#selectedView?.focus(),
    onCancelLink: () => this.#cancelLinkForm(),
    onControlMousedown: (event) => this.#onControlMousedown(event),
    onLineBreak: () => this.#selectedView?.insertLineBreak(),
    onOpenLinkForm: () => this.#openLinkForm(),
    onRemoveLink: () => this.#removeLink(),
    onSubmitLink: (href) => this.#submitLink(href),
    onToggleMark: (mark) => this.#selectedView?.toggleMark(mark),
  };

  readonly #previewEvents: PreviewEvents = {
    onClose: () => this.#closePreview(),
    onClosed: () => this.#onPreviewClose(),
  };

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

  get value(): BlocksDocument | undefined {
    return this.#editor?.getDocument();
  }

  /**
   * A document with the same content as the last one received or sent out
   * changes nothing, so a controlled host keeps its undo history and cursor. Any
   * other document loads and clears undo history. A document that can't be
   * trusted fires `mq-error`, and the current email stays as it was. Any value
   * is checked, such as a saved email read back from JSON, so any is allowed.
   */
  set value(document: unknown) {
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
    this.#dragging = createBlockDragging({
      onDrop: (source, place) => this.#drop(source, place),
      root: this.renderRoot as ShadowRoot,
    });
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
    const blocks = this.#rendered ? blocksIn(this.#rendered) : [];
    for (const block of blocks) {
      if (hasRichText(block) && !this.#views.has(block.id)) {
        this.#views.set(
          block.id,
          createTextBlockView({
            // A Heading is bold already, so the mark would change nothing.
            canBold: block.type !== "heading",
            content: block.props.content as RichTextDocument,
            label: `${blockLabel(block.type)} Block`,
            onChange: (next) => this.#commitText(block.id, next),
            onFocus: () => this.#selectFocused(block.id, true),
            onStateChange: () => this.#syncFormats(),
            onTypingBreak: () => {
              this.#typingSession += 1;
            },
          })
        );
      }
    }
    this.#removeViewsExcept(new Set(blocks.map(({ id }) => id)));
    for (const view of this.#views.values()) {
      view.setLang(this.#emailLang);
    }
    const rows = this.#rendered?.rows ?? [];
    if (
      this.#selectedRowId !== undefined &&
      !rows.some(({ id }) => id === this.#selectedRowId)
    ) {
      this.#select(undefined);
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
        this.#selectedBlockId === undefined
          ? undefined
          : this.#blockElement(this.#selectedBlockId);
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
        ? this.#selectedView
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
      this.#restoringFocus = true;
      (tool ?? block ?? view ?? rowTool ?? this.#floatingToolbar)?.focus();
      this.#restoringFocus = false;
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
      ${renderPreview(this.#preview, this.#previewEvents)}
      <div class="visually-hidden" lang=${UI_LANG} role="status">
        ${keyed(this.#announcementId, html`<span>${this.#announcement}</span>`)}
      </div>
      <p hidden id="block-keys" lang=${UI_LANG}>
        Press Enter to edit the text, and Escape to come back. In the text,
        press Alt+F10 to reach its formatting. Use arrow keys to select another
        Block, and Alt with arrow keys to move this one.
      </p>
      <p hidden id="block-keys-no-text" lang=${UI_LANG}>
        Use arrow keys to select another Block, and Alt with arrow keys to move
        this one.
      </p>
      ${this.#narrow ? this.#renderNarrowNotice() : nothing}
      <div
        class="ui editor"
        lang=${UI_LANG}
        part="frame"
        ?data-collapsed=${this.#narrow}
        style=${styleMap({ "--email-width": `${settings.width}px` })}
        @keydown=${this.#onEditorKeydown}
      >
        <div
          class="canvas-area"
          @click=${this.#onWorkspaceClick}
          @pointerdown=${this.#onWorkspacePointerdown}
        >
          <div
            class="email"
            @beforeinput=${this.#onBeforeInput}
            @keydown=${this.#onEmailKeydown}
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
        ${renderSidePanel(
          {
            document,
            selectedBlock: selected,
            selectedRowId: this.#selectedRowId,
            showProperties: this.#showProperties,
            tab: this.#panelTab,
          },
          this.#sidePanelEvents
        )}
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
      <div class="ui narrow-notice" lang=${UI_LANG} part="frame">
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
   * Beside the Row, on hover, on focus, and while the Row is selected. One stop
   * for Tab, then arrow keys go along. Alt+↑ and Alt+↓ move the Row from here,
   * as the Move buttons say.
   */
  #renderRowToolbar(row: Row, index: number, count: number) {
    return html`
      <div
        aria-current=${row.id === this.#selectedRowId ? "true" : nothing}
        aria-label=${`Row ${index + 1}`}
        aria-orientation="vertical"
        class="ui row-toolbar"
        role="toolbar"
        @keydown=${(event: KeyboardEvent) =>
          this.#onRowToolbarKeydown(event, row.id)}
        @mousedown=${this.#onControlMousedown}
      >
        <div class="bar" @keydown=${onToolbarArrowKeys}>
          ${renderDragHandle(this.#onHandleMousedown, "Drag Row")}
          <button
            aria-label="Select Row"
            class="icon-button"
            ?data-active=${row.id === this.#selectedRowId}
            data-action="select-row"
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
                tabindex="-1"
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
            tabindex="-1"
            type="button"
            @click=${({ detail }: MouseEvent) =>
              this.#deleteRow(row.id, detail === 0)}
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
                <div class="ui placeholder">
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
    const selected = block.id === this.#selectedBlockId;
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
        ${renderBlockContent(
          block,
          this.#emailLang,
          this.#failedImages,
          this.#onImageError
        )}
        ${selected ? this.#renderBlockToolbar() : nothing}
        ${
          selected && rich && this.#editingText
            ? renderFormatBar(
                {
                  formats: this.#formats,
                  linkForm: this.#linkForm,
                },
                this.#formatBarEvents
              )
            : nothing
        }
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
          @click=${({ detail }: MouseEvent) =>
            this.#deleteSelectedBlock(detail === 0)}
        >
          ${ICONS.delete}
        </button>
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

  /** On each Block's content. With none set, it's unknown, as in the export. */
  get #emailLang() {
    return this.#rendered?.settings.language ?? "";
  }

  get #selectedView() {
    return this.#selectedBlockId === undefined
      ? undefined
      : this.#views.get(this.#selectedBlockId);
  }

  /** Firefox's scroll on focus leaves a Block that's partly in view where it is. */
  #onBlockFocus({ currentTarget }: FocusEvent, blockId: string) {
    this.#selectFocused(blockId, false);
    (currentTarget as HTMLElement).scrollIntoView({ block: "nearest" });
  }

  /**
   * Shows the selected Block's settings again after Back, when its text still has
   * focus and so gets no new focus event. Its own toolbars leave the panel be.
   */
  #onBlockClick({ currentTarget, target }: MouseEvent) {
    if (
      !this.#showProperties &&
      (currentTarget as HTMLElement).dataset.blockId ===
        this.#selectedBlockId &&
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

  /** Focus on a Block, or in its text, selects the Block. */
  #selectFocused(blockId: string, inText: boolean) {
    this.#editingText = inText;
    // The Block is selected already, and the panel stays as it was left.
    if (!this.#restoringFocus) {
      this.#select({ blockId });
    }
  }

  /**
   * Selects a Block, a Row or nothing, and shows what's selected in the side
   * panel. Whether a Block's text is being edited is up to where focus is.
   */
  #select(target: { blockId: string } | { rowId: string } | undefined) {
    const blockId = target && "blockId" in target ? target.blockId : undefined;
    this.#selectedBlockId = blockId;
    this.#selectedRowId =
      target && "rowId" in target ? target.rowId : undefined;
    this.#showProperties = target !== undefined;
    this.#linkForm = undefined;
    if (blockId === undefined) {
      this.#editingText = false;
    }
    this.#formats = this.#selectedView?.formats();
    this.requestUpdate();
  }

  /**
   * Selects a Row in place of any Block, and shows its settings. Its toolbar's
   * button takes focus, so typing can't go on in a Block's text.
   */
  async #selectRow(rowId: string) {
    // From the keyboard, as from the Rows tab, the focus ring follows.
    const focusVisible =
      this.shadowRoot?.activeElement?.matches(":focus-visible") ?? false;
    this.#select({ rowId });
    await this.updateComplete;
    const button = this.renderRoot
      .querySelector(`.row-frame[data-row-selected] .row-toolbar`)
      ?.querySelector<HTMLElement>('[data-action="select-row"]');
    if (button && this.shadowRoot?.activeElement !== button) {
      button.focus({ focusVisible } as FocusOptions);
    }
  }

  /** Re-renders only on a change, because this runs on every transaction. */
  #syncFormats() {
    const formats = this.#selectedView?.formats();
    if (JSON.stringify(formats) !== JSON.stringify(this.#formats)) {
      this.#formats = formats;
      this.requestUpdate();
    }
  }

  /** From the Block itself too: its text takes focus, and shows the format bar. */
  async #openLinkForm() {
    const view = this.#selectedView;
    if (!view) {
      return;
    }
    if (!this.#editingText) {
      view.focus();
    }
    this.#linkForm = { refusals: 0 };
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
    this.#selectedView?.focus();
  }

  #removeLink() {
    this.#closeLinkForm();
    this.#selectedView?.removeLink();
  }

  #submitLink(href: string) {
    if (!isAllowedLinkHref(href)) {
      this.#linkForm = { refusals: (this.#linkForm?.refusals ?? 0) + 1 };
      this.requestUpdate();
      return;
    }
    this.#closeLinkForm();
    this.#selectedView?.setLink(href);
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

  readonly #onImageError = (src: string) => {
    this.#failedImages.add(src);
    this.requestUpdate();
  };

  /**
   * Applies a Command and reports a change with `mq-change`. A rejection is a bug
   * here unless it's `refusable`, as what a person typed is. Text on the canvas
   * shows its own change, so it needs no `render`.
   */
  #apply(
    command: Command,
    {
      mergeKey,
      refusable = false,
      render = true,
    }: { mergeKey?: string; refusable?: boolean; render?: boolean } = {}
  ) {
    const editor = this.#editor;
    const result = editor?.apply(command, { mergeKey });
    if (!(editor && result)) {
      return;
    }
    if (!result.ok) {
      if (!(result.unchanged || refusable)) {
        // The controls only offer what's allowed, so this is a bug here.
        console.error(`<mail-quilt> rejected a Command: ${result.reason}`);
      }
      return result;
    }
    if (render) {
      this.requestUpdate();
    }
    this.#emitChange(editor.getDocument());
    return result;
  }

  #draftField(section: SettingsSection, field: SettingsField, text: string) {
    const key = draftKey(section, field);
    const refusals = this.#drafts.get(key)?.refusals ?? 0;
    if (text === fieldText(field, section.values) && !refusals) {
      this.#drafts.delete(key);
    } else {
      this.#drafts.set(key, { refusals, text });
    }
  }

  /**
   * Each commit is one undo step. What can't be accepted stays to be fixed. A
   * retry the person didn't ask for doesn't say again what they've been told.
   */
  #commitField(
    section: SettingsSection,
    field: SettingsField,
    control: HTMLInputElement | HTMLSelectElement,
    retry = false
  ) {
    const key = draftKey(section, field);
    const value = fieldValue(field, control);
    // An image URL that failed may load now, so entering it again tries again.
    if (typeof value === "string") {
      this.#failedImages.delete(value);
    }
    const result = this.#apply(section.command({ [field.key]: value }), {
      refusable: true,
    });
    if (result?.ok || result?.unchanged) {
      this.#drafts.delete(key);
    } else {
      const refusals = this.#drafts.get(key)?.refusals ?? 0;
      this.#drafts.set(key, {
        refusals: retry ? refusals : refusals + 1,
        text: control.value,
      });
    }
    if (result?.ok) {
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
      if (control && this.#drafts.get(key)?.refusals) {
        this.#commitField(section, field, control, true);
      }
    }
  }

  /** Escape takes back what was typed in a settings field. */
  #onSettingsKeydown(event: KeyboardEvent) {
    const key = this.#draftKeyOf(event);
    if (key !== undefined && event.key === "Escape" && !isComposing(event)) {
      event.preventDefault();
      event.stopPropagation();
      this.#drafts.delete(key);
      this.requestUpdate();
    }
  }

  /** The settings field the key was pressed in, while it holds a draft. */
  #draftKeyOf({ target }: KeyboardEvent) {
    const key = (target as HTMLElement).dataset.draftKey;
    return key !== undefined && this.#drafts.has(key) ? key : undefined;
  }

  /**
   * Undo and redo, from anywhere in the editor. Text being typed in a settings
   * field has the field's own undo, like the link field, which keeps its keys.
   */
  #onEditorKeydown(event: KeyboardEvent) {
    if (this.#draftKeyOf(event) === undefined) {
      this.#runHistoryStep(event, historyShortcut(event));
    }
  }

  #selectedPosition(document: BlocksDocument) {
    return this.#selectedBlockId === undefined
      ? undefined
      : locate(document, this.#selectedBlockId);
  }

  /** After the selected Block's Row, or else at the end, and selects it. */
  async #addRow(layout: RowLayout) {
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
    const result = this.#apply({
      index: rowIndex === undefined ? document.rows.length : rowIndex + 1,
      layout,
      type: "insertRow",
    });
    if (result?.ok && result.createdId !== undefined) {
      await this.#selectRow(result.createdId);
    }
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
      (this.#selectedBlockId === undefined && this.#selectedRowId === undefined)
    ) {
      return;
    }
    this.#select(undefined);
    this.#floatingToolbar?.focus({ focusVisible: false } as FocusOptions);
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

  /**
   * From the keyboard, focus goes to the next Block, or else the one before, as
   * it would be lost. A button pressed with a key clicks with a `detail` of 0.
   */
  async #deleteSelectedBlock(fromKeyboard: boolean) {
    const document = this.#editor?.getDocument();
    const blockId = this.#selectedBlockId;
    if (!document || blockId === undefined) {
      return;
    }
    const neighbour =
      neighbourBlockId(document, blockId, "down") ??
      neighbourBlockId(document, blockId, "up");
    if (this.#apply({ blockId, type: "removeBlock" })?.ok) {
      this.#announce("Block deleted.");
      await this.updateComplete;
      if (fromKeyboard && neighbour !== undefined) {
        this.#blockElement(neighbour)?.focus();
      }
    }
  }

  /**
   * From the keyboard, focus goes to the next Row's tools, or else the one
   * before, as it would be lost.
   */
  async #deleteRow(rowId: string, fromKeyboard: boolean) {
    const rows = this.#editor?.getDocument().rows ?? [];
    const index = rows.findIndex(({ id }) => id === rowId);
    const neighbour = rows[index + 1] ?? rows[index - 1];
    if (this.#apply({ rowId, type: "removeRow" })?.ok) {
      this.#announce("Row deleted.");
      await this.updateComplete;
      if (fromKeyboard && neighbour) {
        this.renderRoot
          .querySelector(
            `.row-frame[data-row-id="${CSS.escape(neighbour.id)}"] .row-toolbar`
          )
          ?.querySelector<HTMLElement>('[data-action="select-row"]')
          ?.focus();
      }
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
    const result = this.#apply(
      target
        ? { blockType, ...target, type: "insertBlock" }
        : { blockType, rowIndex: 0, type: "insertBlockInNewRow" }
    );
    if (result?.ok) {
      await this.#showPlaced(result.createdId);
    }
  }

  /** Selects a Block that was just put in place, in its text if it has any. */
  async #showPlaced(blockId: string | undefined) {
    this.#select(blockId === undefined ? undefined : { blockId });
    await this.updateComplete;
    if (this.#selectedView) {
      this.#selectedView.focus();
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
    const result = this.#apply(dropCommand(source, place));
    if (!result?.ok) {
      return;
    }
    if ("rowId" in source) {
      this.#announceRowMove(source.rowId);
      return;
    }
    if ("rowLayout" in source) {
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

  /** The text schema is no wider than core's, so a rejection is a bug here. */
  #commitText(blockId: string, content: RichTextDocument) {
    const now = performance.now();
    if (now - this.#lastTypedAt >= TYPING_PAUSE_MS) {
      this.#typingSession += 1;
    }
    this.#lastTypedAt = now;
    this.#apply(
      { blockId, props: { content }, type: "updateBlockProps" },
      { mergeKey: `${blockId}:${this.#typingSession}`, render: false }
    );
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

  #onEmailKeydown(event: KeyboardEvent) {
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
    }
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
      this.#selectedView?.focus();
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
    const blockId = this.#selectedBlockId;
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
    const blockId = this.#selectedBlockId;
    if (!document || blockId === undefined) {
      return;
    }
    const command = moveCommand(document, blockId, direction);
    if (!command) {
      this.#announce(`The Block can't move ${direction}.`);
      return;
    }
    if (this.#apply(command)?.ok) {
      this.#announceMove(blockId);
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
    if (!(event.altKey && direction)) {
      return;
    }
    // Alt+Left would go back in history.
    event.preventDefault();
    if (direction === "up" || direction === "down") {
      this.#moveRow(rowId, direction);
    } else {
      this.#announce(`The Row can't move ${direction}.`);
    }
  }

  /** One step, keeping the selection, and focus on the Row's tools if it was there. */
  #moveRow(rowId: string, direction: "down" | "up") {
    const document = this.#editor?.getDocument();
    const command = document && moveRowCommand(document, rowId, direction);
    if (!command) {
      this.#announce(`The Row can't move ${direction}.`);
      return;
    }
    if (this.#apply(command)?.ok) {
      this.#announceRowMove(rowId);
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
   * A drag handle in a toolbar has its own.
   */
  #onControlMousedown(event: MouseEvent) {
    const { target } = event;
    if (
      target instanceof HTMLInputElement ||
      (target instanceof Element && target.closest(".drag-handle"))
    ) {
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
    for (const block of blocksIn(document)) {
      this.#views
        .get(block.id)
        ?.setContent(block.props.content as RichTextDocument);
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
    if (blockId === this.#selectedBlockId) {
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
      this.#selectedBlockId !== undefined &&
      !blockIds.has(this.#selectedBlockId)
    ) {
      this.#select(undefined);
    }
  }

  #destroyViews() {
    for (const view of this.#views.values()) {
      view.destroy();
    }
    this.#views.clear();
    // The toolbar's state describes those views and their selections.
    this.#select(undefined);
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

/** Fired with the new document after each change. */
export type MailQuiltChangeEvent = CustomEvent<{ document: BlocksDocument }>;
/** Fired when a document set as `value` is refused, with why. */
export type MailQuiltErrorEvent = CustomEvent<{ reason: string }>;

declare global {
  interface HTMLElementEventMap {
    "mq-change": MailQuiltChangeEvent;
    "mq-error": MailQuiltErrorEvent;
  }

  interface HTMLElementTagNameMap {
    "mail-quilt": MailQuilt;
  }
}
