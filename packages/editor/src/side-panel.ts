import { BLOCK_TYPES, ROW_LAYOUTS } from "@mailquilt/core";
import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";

import { BLOCK_VIEWS } from "./block-types.js";
import { place } from "./editor-places.js";
import { ICONS } from "./icons.js";
import type { PanelApi } from "./panel-api.js";
import { renderThumbnail } from "./selection-bar.js";
import type { PanelTab } from "./selection.js";
import type { StringId } from "./strings.js";
import { blockTypeName } from "./text.js";

export const sidePanelStyles = css`
  /* A layout's Columns lit up, on the one the pointer is over. */
  .layout-tile:hover .thumbnail > span {
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
     * Below the top bar, and no taller than the rest of the window, or of the
     * part of a Shell the email scrolls in, which the Shell gives as
     * --_mq-visible-height.
     */
    max-height: calc(
      min(100dvh, var(--_mq-visible-height, 100dvh)) - var(--_mq-top-bar-height)
    );
    min-width: 0;
    overflow: hidden;
    position: sticky;
    top: var(--_mq-top-bar-height);
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

  .panel-section-title {
    font-size: var(--_mq-font-size-panel-title);
    font-weight: 600;
    letter-spacing: -0.01em;
    margin: 0;
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

/** For adding: Blocks, and Rows. */
const PANEL_TABS: { icon: TemplateResult; id: PanelTab; label: StringId }[] = [
  { icon: ICONS.content, id: "content", label: "side.content" },
  { icon: ICONS.rows, id: "rows", label: "side.rows" },
];

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
    default: {
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
      class="panel-scroll thin-scrollbar padded"
      id=${`tabpanel-${current}`}
      role="tabpanel"
    >
      ${renderTabPanel(api)}
    </div>
  `;
};

/** Beside the Canvas, what's added to the email: Blocks, and Rows. */
export const renderSidePanel = (api: PanelApi) => html`
  <div
    class="side-panel"
    data-place=${place("sidePanel")}
    data-testid="side-panel"
  >
    <div class="side-panel-inner" data-testid="side-panel-content">
      ${renderTabs(api)}
    </div>
  </div>
`;
