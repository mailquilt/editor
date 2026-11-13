import {
  BLOCK_TYPES,
  blockLabel,
  blockSettingsFields,
  EMAIL_SETTINGS_FIELDS,
  ROW_LAYOUTS,
  ROW_SETTINGS_FIELDS,
  rowLayoutOf,
} from "@mailquilt/core";
import type { BlocksDocument, Row, RowLayout } from "@mailquilt/core";
import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { styleMap } from "lit/directives/style-map.js";

import { onToolbarArrowKeys } from "./block-keyboard.js";
import { blockIcon, ICONS } from "./icons.js";
import { columnLabel } from "./places.js";
import type { BlockPlace } from "./places.js";
import { renderSettingsPanel } from "./settings-panel.js";
import type { SettingsPanelEvents, SettingsSection } from "./settings-panel.js";

export const sidePanelStyles = css`
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
     * scrolls in, which the Shell gives as --_mq-visible-height.
     */
    max-height: min(100dvh, var(--_mq-visible-height, 100dvh));
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
    /* Inside the track's padding, so the corners stay even. */
    border-radius: calc(var(--mq-radius) - 2px);
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

  /* Dragged by touch too, which would otherwise scroll the panel. */
  .tile,
  .layout-tile {
    touch-action: none;
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
`;

export type PanelTab = "content" | "rows" | "settings";

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

export interface SidePanelState {
  document: BlocksDocument;
  /** The selected Block, and where it is. */
  selectedBlock: BlockPlace | undefined;
  selectedRowId: string | undefined;
  /** Whether it shows the selected Block's or Row's settings, not its tabs. */
  showProperties: boolean;
  tab: PanelTab;
}

export interface SidePanelEvents {
  onAddBlock: (blockType: string) => void;
  onAddRow: (layout: RowLayout) => void;
  /** Back from a Block's or Row's settings to the tabs. */
  onBack: () => void;
  onChooseLayout: (rowId: string, layout: RowLayout) => void;
  onControlMousedown: (event: MouseEvent) => void;
  onSelectTab: (tab: PanelTab) => void;
  settings: SettingsPanelEvents;
}

/** What the side panel shows, with a way Back to its tabs. */
const renderPanelHeader = (
  icon: TemplateResult,
  title: string,
  subtitle: string,
  events: SidePanelEvents
) => html`
  <div class="panel-header" @mousedown=${events.onControlMousedown}>
    <button
      aria-label="Back"
      class="icon-button back-button"
      data-tooltip="Back"
      type="button"
      @click=${events.onBack}
    >
      ${ICONS.left}
    </button>
    <span class="type-badge">${icon}</span>
    <div class="panel-heading">
      <h2 class="panel-title">${title}</h2>
      <p class="panel-subtitle">${subtitle}</p>
    </div>
  </div>
`;

/** A selected Row: its layout, then its settings. Empty Rows too. */
const renderRowProperties = (
  document: BlocksDocument,
  row: Row,
  rowIndex: number,
  events: SidePanelEvents
) => {
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
    ${renderPanelHeader(
      ICONS.rows,
      `Row ${rowIndex + 1}`,
      current ? `${current} layout` : "Custom layout",
      events
    )}
    <div class="panel-scroll">
      <div class="panel-section">
        <p class="panel-section-title" id="row-layout-title">Layout</p>
        <div
          aria-labelledby="row-layout-title"
          class="layout-choices"
          role="group"
          @mousedown=${events.onControlMousedown}
        >
          ${ROW_LAYOUTS.map(
            (layout) => html`
              <button
                aria-pressed=${layout === current ? "true" : "false"}
                class="layout-option"
                type="button"
                @click=${() => events.onChooseLayout(row.id, layout)}
              >
                ${renderThumbnail(layout)}<span>${layout}</span>
              </button>
            `
          )}
        </div>
      </div>
      ${renderSettingsPanel(section, events.settings)}
    </div>
  `;
};

/** The selected Block's fields. */
const renderProperties = (
  { block, columnIndex, rowIndex }: BlockPlace,
  events: SidePanelEvents
) => {
  const section: SettingsSection = {
    command: (props) => ({
      blockId: block.id,
      props,
      type: "updateBlockProps",
    }),
    fields: blockSettingsFields(block),
    id: "block",
    legend: "Block",
    targetId: block.id,
    values: block.props,
  };
  return html`
    ${renderPanelHeader(
      blockIcon(block.type),
      blockLabel(block.type),
      columnLabel(rowIndex, columnIndex),
      events
    )}
    <div class="panel-scroll">
      ${renderSettingsPanel(section, events.settings)}
    </div>
  `;
};

const renderTabPanel = (
  tab: PanelTab,
  document: BlocksDocument,
  events: SidePanelEvents
) => {
  switch (tab) {
    case "content": {
      return html`
        <div class="panel-intro">
          <p class="panel-section-title">Blocks</p>
          <p class="panel-hint">
            Drag one onto the email, or choose one to add it after the selected
            Block, into the selected Row, or at the end.
          </p>
        </div>
        <div
          aria-label="Add content"
          class="tiles"
          role="group"
          @mousedown=${events.onControlMousedown}
        >
          ${BLOCK_TYPES.map(
            ({ label, type }) => html`
              <button
                aria-label=${`Add ${label} Block`}
                class="tile"
                data-block-type=${type}
                type="button"
                @click=${() => events.onAddBlock(type)}
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
          @mousedown=${events.onControlMousedown}
        >
          ${ROW_LAYOUTS.map(
            (layout) => html`
              <button
                aria-label=${`Add ${layout} Row`}
                class="layout-tile"
                data-row-layout=${layout}
                type="button"
                @click=${() => events.onAddRow(layout)}
              >
                ${renderThumbnail(layout)}<span>${layout}</span>
              </button>
            `
          )}
        </div>
      `;
    }
    default: {
      return renderSettingsPanel(
        {
          command: (settings) => ({ settings, type: "updateEmailSettings" }),
          fields: EMAIL_SETTINGS_FIELDS,
          id: "email",
          legend: "Email",
          targetId: "",
          values: { ...document.settings },
        },
        events.settings
      );
    }
  }
};

const renderTabs = (
  document: BlocksDocument,
  current: PanelTab,
  events: SidePanelEvents
) => html`
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
            @click=${() => events.onSelectTab(id)}
            @focus=${() => events.onSelectTab(id)}
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
    ${renderTabPanel(current, document, events)}
  </div>
`;

const renderPanelView = (
  {
    document,
    selectedBlock,
    selectedRowId,
    showProperties,
    tab,
  }: SidePanelState,
  events: SidePanelEvents
) => {
  if (showProperties) {
    const rowIndex = document.rows.findIndex(({ id }) => id === selectedRowId);
    const row = document.rows[rowIndex];
    if (row) {
      return renderRowProperties(document, row, rowIndex, events);
    }
    if (selectedBlock) {
      return renderProperties(selectedBlock, events);
    }
  }
  return renderTabs(document, tab, events);
};

export const renderSidePanel = (
  state: SidePanelState,
  events: SidePanelEvents
) => html`
  <div class="side-panel">
    <div class="side-panel-inner">${renderPanelView(state, events)}</div>
  </div>
`;
