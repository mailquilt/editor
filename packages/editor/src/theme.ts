import { css } from "lit";

/** What `theme` takes. Without it, or with any other value, the theme is light. */
export type MailQuiltTheme = "light" | "dark" | "auto";

/**
 * The built-in dark theme: the color tokens, and the shadows, which a light
 * theme's would lose on a dark workspace. From the picked 0.4.0 frames
 * (`docs/design/0.4.0`), apart from the danger color, which stays a red as
 * the light theme's is, and a field's edge, which is lighter for 3:1.
 *
 * The `--_mq-…` values aren't tokens. They're what the dark theme uses a
 * token differently for: a color swatch's edge, light so a dark color still
 * shows on a dark field; a Block's keyboard focus, which is on the email,
 * mostly white, where the light accent-strong would be faint; and a switch
 * whose chosen one is lighter than its track, as the frames draw it.
 */
const darkTheme = css`
  --mq-color-workspace: #101113;
  --mq-color-surface: #161719;
  --mq-color-surface-muted: #212226;
  --mq-color-surface-hover: #2a2b30;
  --mq-color-text: #ededef;
  --mq-color-text-muted: #a8a8b1;
  --mq-color-border: #26272b;
  --mq-color-border-strong: #6f7179;
  --mq-color-accent: #6f86ff;
  --mq-color-accent-strong: #b0bdff;
  --mq-color-accent-soft: rgb(125 148 255 / 15%);
  --mq-color-outline-hover: rgb(125 148 255 / 45%);
  --mq-color-on-accent: #0d0e10;
  --mq-color-danger: #ff7a6e;
  --mq-color-tooltip: #ededef;
  --mq-color-on-tooltip: #0d0e10;
  --mq-color-warning: #ff9b5e;
  --mq-color-on-warning: #101113;
  --mq-color-success: #4ade80;
  /* On the email, which keeps its own light colors, so as the light theme. */
  --mq-color-stand-in: #e8eaee;
  --mq-color-on-stand-in: #52525b;
  --mq-color-scheme: dark;
  --mq-color-scrim: rgb(0 0 0 / 60%);
  --mq-shadow-small: 0 1px 2px rgb(0 0 0 / 40%);
  --mq-shadow:
    0 0 0 1px rgb(255 255 255 / 9%), 0 16px 40px -8px rgb(0 0 0 / 70%);
  --_mq-swatch-edge: inset 0 0 0 1px rgb(255 255 255 / 22%);
  --_mq-block-focus: var(--mq-color-accent);
  --_mq-segments-track: var(--mq-color-surface-muted);
  --_mq-segment-chosen: var(--mq-color-surface-hover);
`;

/**
 * The editor's theme tokens: a light theme, and a dark one with `theme`. A host
 * overrides any of them on the element itself, which wins over `:host` in
 * either theme. The email card doesn't use them, because it shows the email's
 * own settings. A custom property of the editor's own that isn't a token is
 * named `--_mq-…`, so it's kept apart from these.
 */
export const themeTokens = css`
  :host {
    --mq-font-family:
      system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    --mq-font-size: 13px;
    --mq-font-size-small: 12px;

    --mq-color-workspace: #eeeff1;
    --mq-color-surface: #ffffff;
    --mq-color-surface-muted: #f5f6f7;
    --mq-color-surface-hover: #eceef0;
    --mq-color-text: #16181d;
    --mq-color-text-muted: #5f6570;
    --mq-color-border: #e4e6ea;
    --mq-color-border-strong: #8b919b;
    --mq-color-accent: #3355ff;
    --mq-color-accent-strong: #2340d6;
    --mq-color-accent-soft: rgb(51 85 255 / 10%);
    --mq-color-outline-hover: rgb(51 85 255 / 45%);
    --mq-color-on-accent: #ffffff;
    --mq-color-danger: #c42b1c;
    --mq-color-tooltip: #16181d;
    --mq-color-on-tooltip: #f7f7f8;
    --mq-color-warning: #c2410c;
    --mq-color-on-warning: #ffffff;
    --mq-color-success: #15803d;
    --mq-color-stand-in: #e8eaee;
    --mq-color-on-stand-in: #52525b;
    /* Over the email behind a sheet on a phone. */
    --mq-color-scrim: rgb(0 0 0 / 45%);
    /* For what the browser draws itself, such as a dropdown's open list. */
    --mq-color-scheme: light;

    --mq-space-1: 4px;
    --mq-space-2: 8px;
    --mq-space-3: 12px;
    --mq-space-4: 16px;
    --mq-space-5: 24px;

    --mq-radius-small: 6px;
    --mq-radius: 10px;
    --mq-radius-large: 14px;
    --mq-shadow-small: 0 1px 2px rgb(22 24 29 / 8%);
    --mq-shadow:
      0 0 0 1px rgb(22 24 29 / 4%), 0 2px 4px rgb(22 24 29 / 4%),
      0 12px 32px -8px rgb(22 24 29 / 14%);
    --_mq-swatch-edge: inset 0 0 0 1px rgb(0 0 0 / 12%);
    --_mq-block-focus: var(--mq-color-accent-strong);
    --_mq-segments-track: var(--mq-color-surface-hover);
    --_mq-segment-chosen: var(--mq-color-surface);
  }

  :host([theme="dark"]) {
    ${darkTheme}
  }

  @media (prefers-color-scheme: dark) {
    :host([theme="auto"]) {
      ${darkTheme}
    }
  }
`;

/** What every surface of the editor's own shares. */
export const uiStyles = css`
  /* Not tokens, so a host doesn't set them: values the styles share. */
  :host {
    /* Font sizes the tokens don't cover. */
    --_mq-font-size-tag: 11px;
    --_mq-font-size-bar-title: 14px;
    --_mq-font-size-panel-title: 15px;
    --_mq-font-size-sheet-title: 16px;
    --_mq-font-size-page-title: 20px;
    /* Check's plain text and HTML, in the system's fixed-width font. */
    --_mq-font-size-code: 13px;
    --_mq-font-family-code:
      ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono",
      monospace;

    /* The top bar's height, which what sticks below it stays clear of. */
    --_mq-top-bar-height: 52px;
    /* The Selection bar's, which sticks below the top bar. */
    --_mq-selection-bar-height: 48px;
    /* On a phone, the Selection bar's, docked at the bottom. */
    --_mq-phone-bar-height: 60px;

    /* What's in front of what on the canvas, from the back. */
    --_mq-layer-handle: 1;
    --_mq-layer-shown-handle: 2;
    --_mq-layer-tags: 4;
    --_mq-layer-drop-indicator: 6;
    --_mq-layer-floating-toolbar: 7;
    --_mq-layer-block-tools: 8;
    --_mq-layer-selection-bar: 9;
    --_mq-layer-top-bar: 10;
    --_mq-layer-tooltip: 20;
  }

  /* Author styles below can set display, which would otherwise show these. */
  [hidden] {
    display: none !important;
  }

  /*
   * Inherited properties cross the Shadow DOM boundary, and the email's own
   * settings reach the controls on the canvas, so each surface starts again here.
   * Two aren't reset by all: direction, set here so the editor is left to right
   * on any page, and custom properties, so the host's tokens still reach it.
   */
  .ui {
    all: initial;
    direction: ltr;
    -webkit-font-smoothing: antialiased;
    box-sizing: border-box;
    color: var(--mq-color-text);
    color-scheme: var(--mq-color-scheme);
    font-family: var(--mq-font-family);
    font-size: var(--mq-font-size);
    line-height: 1.5;
  }

  .ui *,
  .ui *::before,
  .ui *::after {
    box-sizing: border-box;
  }

  /*
   * Around the editor and the Shell, so each reads as one
   * component on the host's page. A ring rather than a border, so it takes no
   * room from what's inside.
   */
  .frame {
    background: var(--mq-color-workspace);
    border-radius: var(--mq-radius);
    box-shadow: 0 0 0 1px var(--mq-color-border);
  }

  /* Without weight, so each control's own color and font win over these. */
  :where(.ui) :where(button, input, select) {
    color: inherit;
    font: inherit;
  }

  .visually-hidden {
    clip-path: inset(50%);
    height: 1px;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
    width: 1px;
  }

  .icon {
    display: block;
    flex: none;
    height: 16px;
    width: 16px;
  }

  .icon-button {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: var(--mq-radius-small);
    color: var(--mq-color-text-muted);
    cursor: pointer;
    display: inline-flex;
    flex: none;
    height: 28px;
    justify-content: center;
    padding: 0;
    transition:
      background-color 120ms,
      color 120ms;
    width: 28px;
  }

  .icon-button:hover:not(:disabled, [aria-disabled="true"]) {
    background: var(--mq-color-surface-hover);
    color: var(--mq-color-text);
  }

  /* An edge too, so "on" doesn't rest on color alone. */
  .icon-button[aria-pressed="true"],
  .icon-button[aria-expanded="true"],
  .icon-button[data-active] {
    background: var(--mq-color-accent-soft);
    box-shadow: inset 0 0 0 1px var(--mq-color-accent-strong);
    color: var(--mq-color-accent-strong);
  }

  .icon-button:disabled {
    cursor: default;
    opacity: 0.45;
  }

  /*
   * Off with aria-disabled, it stays reachable, so its tooltip says why. Only
   * its icon fades, so its focus ring stays at full strength.
   */
  .icon-button[aria-disabled="true"] {
    cursor: default;
  }

  .icon-button[aria-disabled="true"] > .icon {
    opacity: 0.45;
  }

  /*
   * Forced colors, such as Windows High Contrast, drop backgrounds and shadows,
   * which are all that show what's selected or on. An outline stays.
   */
  @media (forced-colors: active) {
    .icon-button[aria-pressed="true"],
    .icon-button[aria-expanded="true"],
    .icon-button[data-active] {
      outline: 2px solid Highlight;
      outline-offset: -2px;
    }
  }

  .icon-button.danger:hover {
    color: var(--mq-color-danger);
  }

  /* A button with words on it, which need no tooltip. */
  .text-button {
    background: var(--mq-color-surface);
    border: 1px solid var(--mq-color-border);
    border-radius: var(--mq-radius-small);
    box-shadow: var(--mq-shadow-small);
    cursor: pointer;
    font-weight: 500;
    height: 28px;
    padding: 0 var(--mq-space-3);
    transition: background-color 120ms;
  }

  .text-button:hover {
    background: var(--mq-color-surface-hover);
  }

  .text-button.primary {
    background: var(--mq-color-accent);
    border-color: var(--mq-color-accent);
    color: var(--mq-color-on-accent);
  }

  .text-button.primary:hover {
    background: var(--mq-color-accent-strong);
  }

  .ui button:focus-visible,
  .ui input:focus-visible {
    outline: 2px solid var(--mq-color-accent);
    outline-offset: 1px;
  }

  /* Something under way, such as a test sending or a web font loading. */
  .spinner {
    border: 2px solid
      color-mix(in srgb, var(--mq-color-text-muted) 35%, transparent);
    border-radius: 50%;
    border-top-color: var(--mq-color-text-muted);
    flex: none;
    height: 12px;
    width: 12px;
  }

  @media (prefers-reduced-motion: no-preference) {
    .spinner {
      animation: spin 800ms linear infinite;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(1turn);
    }
  }

  /* An area that scrolls, with a scrollbar as quiet as its borders. */
  .thin-scrollbar {
    scrollbar-color: var(--mq-color-border) transparent;
    scrollbar-width: thin;
  }

  /*
   * A segmented control, such as the Modes or the Preview's width:
   * the chosen one is a raised chip in the track.
   */
  .segments {
    background: var(--_mq-segments-track);
    border-radius: var(--mq-radius);
    box-shadow: inset 0 0 0 1px var(--mq-color-border);
    display: flex;
    gap: 2px;
    padding: 3px;
  }

  .segment {
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

  .segment:hover {
    color: var(--mq-color-text);
  }

  /* An edge at 3:1, as a field's, so the chosen one doesn't rest on a shadow. */
  .segment:is([aria-selected="true"], [aria-pressed="true"]) {
    background: var(--_mq-segment-chosen);
    box-shadow:
      0 0 0 1px var(--mq-color-border-strong),
      var(--mq-shadow-small);
    color: var(--mq-color-text);
  }

  .segment:is([aria-selected="true"], [aria-pressed="true"]) .icon {
    color: var(--mq-color-accent);
  }

  /* Forced colors drop the background and shadow that show which is chosen. */
  @media (forced-colors: active) {
    .segment:is([aria-selected="true"], [aria-pressed="true"]) {
      outline: 2px solid Highlight;
      outline-offset: -2px;
    }
  }

  /* A raised bar of tools, on the canvas or above it. */
  .bar {
    align-items: center;
    background: var(--mq-color-surface);
    border: 1px solid var(--mq-color-border);
    border-radius: var(--mq-radius);
    box-shadow: var(--mq-shadow);
    display: flex;
    gap: 2px;
    padding: 3px;
  }

  .bar .separator {
    align-self: stretch;
    background: var(--mq-color-border);
    flex: none;
    margin: 4px 2px;
    width: 1px;
  }

  /*
   * On a phone, in a sheet's menu, the editor's and the Shell's: a line with
   * its icon and name, as tall as a fingertip, and a choice of a few.
   */
  .sheet-item {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: var(--mq-radius-small);
    cursor: pointer;
    display: flex;
    font-size: var(--_mq-font-size-sheet-title);
    gap: var(--mq-space-3);
    height: 44px;
    margin-inline: calc(-1 * var(--mq-space-2));
    padding: 0 var(--mq-space-2);
    text-align: start;
    width: calc(100% + 2 * var(--mq-space-2));
  }

  .sheet-item:hover:not(:disabled, [aria-disabled="true"]) {
    background: var(--mq-color-surface-hover);
  }

  .sheet-item:is(:disabled, [aria-disabled="true"]) {
    color: var(--mq-color-text-muted);
    cursor: default;
  }

  .sheet-item > span {
    flex: 1;
  }

  .sheet-choices > .segment {
    height: 34px;
  }

  /* Over a popover's own styles too. See tooltips.ts. */
  .tooltip {
    background: var(--mq-color-tooltip);
    border: 0;
    border-radius: var(--mq-radius-small);
    box-shadow: var(--mq-shadow);
    color: var(--mq-color-on-tooltip);
    font-size: var(--mq-font-size-small);
    font-weight: 500;
    inset: 0 auto auto 0;
    margin: 0;
    max-width: 240px;
    overflow: visible;
    padding: 5px 8px;
    /* So it never covers a control that's pressed. See tooltips.ts. */
    pointer-events: none;
    position: fixed;
    white-space: nowrap;
    z-index: var(--_mq-layer-tooltip);
  }
`;
