import { BLOCK_TYPES, ROW_LAYOUTS } from "@mailquilt/core";
import type { RowLayout } from "@mailquilt/core";
import {
  blockSettingsFields,
  EMAIL_SETTINGS_FIELDS,
  rowSettingsFields,
  rowLayoutOf,
} from "@mailquilt/core/internal";
import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";

import { BLOCK_VIEWS } from "./block-types.js";
import { place } from "./editor-places.js";
import { ICONS } from "./icons.js";
import { UPLOADABLE_TYPES } from "./image-uploads.js";
import { fieldTags } from "./merge-tag-picker.js";
import type { PanelApi } from "./panel-api.js";
import { columnPlace } from "./positions.js";
import type { BlockPosition, RowPosition } from "./positions.js";
import type { PanelTab } from "./selection.js";
import { draftKey, renderSettingsPanel } from "./settings-panel.js";
import type { SettingsSection } from "./settings-panel.js";
import type { StringId } from "./strings.js";
import { styleProperties } from "./style-properties.js";
import { blockTypeName } from "./text.js";
import type { Text } from "./text.js";

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

  /*
   * Forced colors drop the backgrounds and shadows that show which is chosen.
   * An outline stays.
   */
  @media (forced-colors: active) {
    .layout-option[aria-pressed="true"] {
      outline: 2px solid Highlight;
      outline-offset: -2px;
    }
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
    display: flex;
    flex: 1 0 var(--_mq-panel-width);
    /*
     * Its own width beside the canvas, and the whole width once it has
     * wrapped below it.
     */
    max-width: max(
      var(--_mq-panel-width),
      (var(--_mq-side-by-side) - 100%) * 9999
    );
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

  .panel-title,
  .panel-section-title {
    font-size: var(--_mq-font-size-panel-title);
    font-weight: 600;
    letter-spacing: -0.01em;
    margin: 0;
  }

  .panel-title {
    line-height: 1.25;
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

  /*
   * The edge is a shadow. Forced colors drop shadows, and draw the transparent
   * outline in the system's color instead.
   */
  .tile,
  .layout-tile {
    align-items: center;
    background: var(--mq-color-surface);
    border: 0;
    border-radius: var(--mq-radius);
    box-shadow:
      inset 0 0 0 1px var(--mq-color-border),
      var(--mq-shadow-small);
    color: var(--mq-color-text);
    cursor: grab;
    display: flex;
    flex-direction: column;
    font-size: var(--mq-font-size-small);
    font-weight: 500;
    gap: 10px;
    justify-content: center;
    outline: 1px solid transparent;
    outline-offset: -1px;
    padding: var(--mq-space-3) var(--mq-space-2);
    /*
     * A touch that goes up or down scrolls the panel, which the tiles fill, and
     * one that goes sideways, towards the email, drags the tile.
     */
    touch-action: pan-y;
    transition:
      background-color 120ms,
      box-shadow 120ms;
  }

  .tile {
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

const PANEL_TABS: { icon: TemplateResult; id: PanelTab; label: StringId }[] = [
  { icon: ICONS.content, id: "content", label: "side.content" },
  { icon: ICONS.rows, id: "rows", label: "side.rows" },
  { icon: ICONS.settings, id: "settings", label: "side.settings" },
];

/** A layout as its Column widths, for a picker that names it beside this. */
const renderThumbnail = (layout: RowLayout) => html`
  <span aria-hidden="true" class="thumbnail">
    ${layout
      .split("/")
      .map(
        (width) =>
          html`<span style=${styleProperties({ "flex-grow": width })}></span>`
      )}
  </span>
`;

/** What the side panel shows, with a way Back to its tabs. */
const renderPanelHeader = (
  icon: TemplateResult,
  title: string,
  subtitle: string,
  api: PanelApi
) => html`
  <div class="panel-header" data-place=${place("controls")}>
    <button
      aria-label=${api.text("side.back")}
      class="icon-button"
      data-tooltip=${api.text("side.back")}
      type="button"
      @click=${({ detail }: MouseEvent) => api.showTabs(detail === 0)}
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
const renderRowProperties = ({ row, rowIndex }: RowPosition, api: PanelApi) => {
  const { text } = api;
  const current = rowLayoutOf(row);
  const section: SettingsSection = {
    command: (props) => ({ props, rowId: row.id, type: "updateRowProps" }),
    fields: rowSettingsFields(row),
    id: "row",
    legend: text("side.row"),
    targetId: row.id,
    unsetColor: api.email.settings.backgroundColor,
    values: row.props,
  };
  return html`
    ${renderPanelHeader(
      ICONS.rows,
      text("side.rowTitle", { row: rowIndex + 1 }),
      current
        ? text("side.layoutOf", { layout: current })
        : text("side.customLayout"),
      api
    )}
    <div class="panel-scroll thin-scrollbar">
      <div class="panel-section">
        <h3 class="panel-section-title" id="row-layout-title">
          ${text("side.layout")}
        </h3>
        <div
          aria-labelledby="row-layout-title"
          class="layout-choices"
          data-place=${place("controls")}
          role="group"
        >
          ${ROW_LAYOUTS.map(
            (layout) => html`
              <button
                aria-pressed=${layout === current ? "true" : "false"}
                class="layout-option"
                type="button"
                @click=${() => api.setRowLayout(row.id, layout)}
              >
                ${renderThumbnail(layout)}<span>${layout}</span>
              </button>
            `
          )}
        </div>
      </div>
      ${renderSettingsPanel(section, api.drafts, fieldTags(api), text)}
    </div>
  `;
};

const BLOCK_SECTION_ID = "block";

/** Where what's typed in a selected Block's field is kept. */
export const blockDraftKey = (blockId: string, fieldKey: string) =>
  draftKey({ id: BLOCK_SECTION_ID, targetId: blockId }, { key: fieldKey });

/**
 * Opens the file picker, with only the types an upload takes. The picker is
 * the button's, so it's no Tab stop of its own.
 */
const renderUploadButton = (
  blockId: string,
  uploadImage: (blockId: string, file: File) => void,
  text: Text
) => html`
  <button
    class="text-button"
    type="button"
    @click=${({ currentTarget }: MouseEvent) =>
      (
        (currentTarget as Element).nextElementSibling as HTMLInputElement
      ).click()}
  >
    ${text("side.uploadImage")}
  </button>
  <input
    accept=${UPLOADABLE_TYPES.join(",")}
    hidden
    type="file"
    @change=${({ currentTarget }: Event) => {
      const input = currentTarget as HTMLInputElement;
      const [file] = input.files ?? [];
      // So the same file can be picked again.
      input.value = "";
      if (file) {
        uploadImage(blockId, file);
      }
    }}
  />
`;

/** The selected Block's fields. */
const renderProperties = (
  { block, columnIndex, rowIndex }: BlockPosition,
  api: PanelApi
) => {
  const section: SettingsSection = {
    command: (props) => ({
      blockId: block.id,
      props,
      type: "updateBlockProps",
    }),
    extras:
      block.type === "image"
        ? {
            src: {
              control: api.uploadImage
                ? renderUploadButton(block.id, api.uploadImage, api.text)
                : undefined,
              error: api.uploadErrorOf(block.id),
            },
          }
        : undefined,
    fields: blockSettingsFields(block),
    id: BLOCK_SECTION_ID,
    legend: api.text("side.block"),
    targetId: block.id,
    values: block.props,
  };
  return html`
    ${renderPanelHeader(
      BLOCK_VIEWS[block.type].icon,
      blockTypeName(block.type, api.text),
      api.text("side.blockPlace", columnPlace(rowIndex, columnIndex)),
      api
    )}
    <div class="panel-scroll thin-scrollbar">
      ${renderSettingsPanel(section, api.drafts, fieldTags(api), api.text)}
    </div>
  `;
};

const renderTabPanel = (api: PanelApi) => {
  const { text } = api;
  switch (api.tab) {
    case "content": {
      return html`
        <div class="panel-intro">
          <h3 class="panel-section-title">${text("side.blocks")}</h3>
          <p class="panel-hint">${text("side.blocksHelp")}</p>
        </div>
        <div
          aria-label=${text("side.addContent")}
          class="tiles"
          data-place=${place("controls")}
          role="group"
        >
          ${BLOCK_TYPES.map(
            ({ type }) => html`
              <button
                aria-label=${text("side.addBlock", {
                  type: blockTypeName(type, text),
                })}
                class="tile"
                data-block-type=${type}
                data-place=${place("paletteItem")}
                type="button"
                @click=${() => api.addBlock(type)}
              >
                ${BLOCK_VIEWS[type].icon}
                <span>${blockTypeName(type, text)}</span>
              </button>
            `
          )}
        </div>
      `;
    }
    case "rows": {
      return html`
        <div class="panel-intro">
          <h3 class="panel-section-title">${text("side.layouts")}</h3>
          <p class="panel-hint">${text("side.layoutsHelp")}</p>
        </div>
        <div
          aria-label=${text("side.addRow")}
          class="layout-tiles"
          data-place=${place("controls")}
          role="group"
        >
          ${ROW_LAYOUTS.map(
            (layout) => html`
              <button
                aria-label=${text("side.addLayout", { layout })}
                class="layout-tile"
                data-place=${place("paletteItem")}
                data-row-layout=${layout}
                type="button"
                @click=${({ detail }: MouseEvent) =>
                  api.addRow(layout, detail === 0)}
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
          legend: text("side.email"),
          targetId: "",
          values: { ...api.email.settings },
        },
        api.drafts,
        fieldTags(api),
        text
      );
    }
  }
};

const renderTabs = (api: PanelApi) => {
  const current = api.tab;
  return html`
    <div class="panel-top">
      <div
        aria-label=${api.text("side.panel")}
        class="segments"
        data-place=${place("panelTabs")}
        role="tablist"
      >
        ${PANEL_TABS.map(
          ({ icon, id, label }) => html`
            <button
              aria-controls=${id === current ? `tabpanel-${id}` : nothing}
              aria-selected=${id === current ? "true" : "false"}
              class="segment"
              id=${`tab-${id}`}
              role="tab"
              tabindex=${id === current ? "0" : "-1"}
              type="button"
              @click=${() => api.selectTab(id)}
              @focus=${() => api.selectTab(id)}
            >
              ${icon}<span>${api.text(label)}</span>
            </button>
          `
        )}
      </div>
    </div>
    <div
      aria-labelledby=${`tab-${current}`}
      class=${
        current === "settings"
          ? "panel-scroll thin-scrollbar"
          : "panel-scroll thin-scrollbar padded"
      }
      id=${`tabpanel-${current}`}
      role="tabpanel"
    >
      ${renderTabPanel(api)}
    </div>
  `;
};

const renderPanelView = (api: PanelApi) => {
  const { selectedBlock, selectedRow, showsSettings } = api;
  if (showsSettings && selectedRow) {
    return renderRowProperties(selectedRow, api);
  }
  if (showsSettings && selectedBlock) {
    return renderProperties(selectedBlock, api);
  }
  return renderTabs(api);
};

export const renderSidePanel = (api: PanelApi) => html`
  <div
    class="side-panel"
    data-place=${place("sidePanel")}
    data-testid="side-panel"
  >
    <div class="side-panel-inner" data-testid="side-panel-content">
      ${renderPanelView(api)}
    </div>
  </div>
`;
