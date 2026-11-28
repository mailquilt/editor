import { ROW_LAYOUTS } from "@mailquilt/core";
import type {
  Block,
  BlockType,
  Command,
  Column,
  EmailStyle,
  RowLayout,
} from "@mailquilt/core";
import {
  blockBoxFields,
  blockStyles,
  blockSettingsFields,
  COLUMN_SETTINGS_FIELDS,
  EMAIL_LOOK,
  EMAIL_SETTINGS_FIELDS,
  phoneValueKeys,
  rowLayoutOf,
  rowSettingsFields,
} from "@mailquilt/core/internal";
import type {
  ColumnProps,
  RowProps,
  SettingsField,
  ShowOn,
} from "@mailquilt/core/internal";
import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { keyed } from "lit/directives/keyed.js";
import { live } from "lit/directives/live.js";

import { BLOCK_VIEWS } from "./block-types.js";
import { findPlace, place } from "./editor-places.js";
import type { Place } from "./editor-places.js";
import type { EditorFocus } from "./focus.js";
import { ICONS } from "./icons.js";
import { UPLOADABLE_TYPES } from "./image-uploads.js";
import { keyLabel, withKeys } from "./key-map.js";
import type { Action, KeyScope } from "./key-map.js";
import { fieldTags, NO_FIELD_TAGS } from "./merge-tag-picker.js";
import type { PanelApi } from "./panel-api.js";
import { columnPlace } from "./positions.js";
import type {
  BlockPosition,
  ColumnPosition,
  Direction,
  RowPosition,
} from "./positions.js";
import {
  draftKey,
  fieldText,
  fieldWords,
  phoneMark,
  renderField,
  renderSettingsPanel,
  typedIn,
} from "./settings-panel.js";
import type { ListPart, SettingsSection } from "./settings-panel.js";
import { renderSheet, renderSheetHead } from "./sheet.js";
import type { StringId } from "./strings.js";
import { styleProperties } from "./style-properties.js";
import { blockTypeName } from "./text.js";
import type { Text } from "./text.js";

/**
 * The Selection bar above the Canvas: the selected Block's or Row's main
 * settings and its actions, or the email's settings with nothing selected.
 * What doesn't fit is one press away under More, in a panel docked beside the
 * email where it fits, and floating under the bar where it doesn't. A bar
 * setting with more than one field, such as a Row's padding, opens in a
 * popover from its button.
 */

export const selectionBarStyles = css`
  /*
   * Across the top of the Canvas, under the top bar, and in sight while the
   * email scrolls. Its controls are in the middle, as the email is.
   */
  .bar-dock {
    margin: 0 calc(-1 * var(--_mq-gutter)) var(--mq-space-3);
    order: -1;
    position: sticky;
    top: var(--_mq-top-bar-height);
    z-index: var(--_mq-layer-selection-bar);
  }

  .selection-bar {
    align-items: center;
    background: var(--mq-color-surface);
    border-block-end: 1px solid var(--mq-color-border);
    display: flex;
    gap: var(--mq-space-1);
    justify-content: center;
    min-height: var(--_mq-selection-bar-height);
    padding: 0 var(--mq-space-3);
    white-space: nowrap;
  }

  /* Groups are set apart by space, as the picked frames have them. */
  .selection-bar .bar-separator {
    flex: none;
    width: var(--mq-space-3);
  }

  /* As wide as what's in it, which fitSelectionBar compares with the bar's. */
  .bar-content {
    align-items: center;
    display: flex;
    flex: none;
    gap: var(--mq-space-1);
    max-width: 100%;
  }

  .selection-bar :is(button, input):focus-visible {
    outline: 2px solid var(--mq-color-accent);
    outline-offset: 2px;
  }

  .selection-bar button:active:not(:disabled, [aria-disabled="true"]) {
    transform: scale(0.97);
  }

  .selection-bar button {
    transition:
      background-color 120ms,
      color 120ms,
      transform 100ms;
  }

  /* What's selected and where: "Row 3 / Button". */
  .bar-chip {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: var(--mq-radius-small);
    cursor: pointer;
    display: inline-flex;
    flex: none;
    font-weight: 600;
    gap: var(--mq-space-2);
    height: 32px;
    padding: 0 var(--mq-space-2) 0 var(--mq-space-1);
  }

  .bar-chip:hover,
  .bar-chip[aria-expanded="true"] {
    background: var(--mq-color-surface-hover);
  }

  /* The email's has no menu, as there's nothing around it to select. */
  span.bar-chip {
    cursor: default;
  }

  span.bar-chip:hover {
    background: transparent;
  }

  .bar-chip .chip-icon {
    align-items: center;
    color: var(--mq-color-text-muted);
    display: flex;
    height: 20px;
    justify-content: center;
    width: 20px;
  }

  .bar-chip .chip-icon .icon {
    height: 13px;
    width: 13px;
  }

  .bar-chip .chip-path {
    color: var(--mq-color-text-muted);
    font-weight: 400;
  }

  .bar-chip > .icon,
  .bar-button > .chevron {
    color: var(--mq-color-text-muted);
    height: 14px;
    width: 14px;
  }

  /* Where a popover or a menu hangs from its button. */
  .bar-anchor {
    display: inline-flex;
    flex: none;
    position: relative;
  }

  /*
   * A field typed in. Its edge is at 3:1, as every field's is, so an empty one
   * still reads as a field.
   */
  .bar-field {
    align-items: center;
    background: var(--mq-color-surface);
    border: 1px solid var(--mq-color-border-strong);
    border-radius: var(--mq-radius-small);
    display: inline-flex;
    flex: 0 1 auto;
    gap: var(--mq-space-2);
    height: 32px;
    min-width: 96px;
    width: var(--_mq-field-width, 160px);
    padding: 0 var(--mq-space-2);
    position: relative;
    transition:
      border-color 120ms,
      box-shadow 120ms;
  }

  .bar-field:hover:not(:focus-within) {
    border-color: var(--mq-color-text-muted);
  }

  .bar-field:focus-within {
    border-color: transparent;
    box-shadow: 0 0 0 4px var(--mq-color-accent-soft);
    outline: 2px solid var(--mq-color-accent);
    outline-offset: -1px;
  }

  .bar-field[data-invalid] {
    border-color: var(--mq-color-danger);
  }

  .bar-field > .icon {
    color: var(--mq-color-text-muted);
    height: 14px;
    width: 14px;
  }

  .bar-field .bar-label {
    color: var(--mq-color-text-muted);
    font-size: var(--mq-font-size-small);
    font-weight: 400;
  }

  /*
   * As wide as the field leaves it, rather than the 20 characters a browser
   * gives a field, so the field can shrink to its least where the bar is short
   * of room.
   */
  .bar-field input {
    background: transparent;
    border: 0;
    color: var(--mq-color-text);
    flex: 1;
    height: 30px;
    min-width: 0;
    padding: 0;
    text-overflow: ellipsis;
    width: 0;
  }

  /* The field draws the focus ring. */
  .selection-bar .bar-field input:focus-visible {
    outline: none;
  }

  .bar-field input::placeholder {
    color: var(--mq-color-text-muted);
    opacity: 1;
  }

  /* While the bar measures what it needs, a field is at its least. */
  .bar-content[data-measuring] .bar-field:not(.number) {
    width: 96px;
  }

  .bar-field.number {
    flex: none;
    min-width: 0;
    width: auto;
    padding-inline-end: var(--mq-space-2);
  }

  .bar-field.number input {
    -moz-appearance: textfield;
    flex: none;
    text-align: end;
    width: 4ch;
  }

  .bar-field.number input::-webkit-inner-spin-button,
  .bar-field.number input::-webkit-outer-spin-button {
    appearance: none;
    margin: 0;
  }

  .bar-field .unit {
    color: var(--mq-color-text-muted);
    font-size: var(--mq-font-size-small);
  }

  /* A setting's name before its control, where the control doesn't say. */
  .bar-name {
    color: var(--mq-color-text-muted);
    flex: none;
    font-size: var(--mq-font-size-small);
    font-weight: 400;
    margin-inline: var(--mq-space-1);
  }

  /* A switch, its name, and while it's on, what that means. */
  .bar-switch {
    align-items: center;
    gap: var(--mq-space-2);
    margin-inline: var(--mq-space-1);
  }

  .bar-switch label {
    cursor: pointer;
    font-weight: 500;
  }

  .bar-switch .means {
    color: var(--mq-color-text-muted);
  }

  /*
   * Under a field, what's wrong with what was typed, or the Merge Tags it
   * takes. Over the email, as the bar's popovers are.
   */
  .bar-field .bar-error,
  .bar-anchor > .bar-error,
  .bar-field .field-merge-tag-picker {
    inset-block-start: calc(100% + var(--mq-space-2));
    inset-inline-start: -1px;
    position: absolute;
    z-index: 1;
  }

  .bar-field .field-merge-tag-picker {
    min-width: 220px;
  }

  /*
   * Why a play button couldn't be added, with a way to upload a thumbnail,
   * from the button's end, as it's near the bar's, so it stays on screen.
   */
  .bar-anchor > .bar-error.play-failed {
    inset-inline-end: 0;
    inset-inline-start: auto;
  }

  .bar-error.play-failed {
    color: var(--mq-color-text);
    display: grid;
    gap: var(--mq-space-1);
    justify-items: start;
    width: 300px;
  }

  .play-failed b {
    font-weight: 600;
  }

  .play-failed .text-button {
    margin-block-start: var(--mq-space-1);
  }

  /* A Video's play button choices, each a line with what it means. */
  .play-choices {
    padding: var(--mq-space-1);
    width: 310px;
  }

  .play-choices fieldset {
    border: 0;
    margin: 0;
    padding: 0;
  }

  .play-choices legend {
    block-size: 1px;
    clip-path: inset(50%);
    inline-size: 1px;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
  }

  .play-choice {
    align-items: start;
    border-radius: var(--mq-radius-small);
    cursor: pointer;
    display: grid;
    gap: var(--mq-space-2);
    grid-template-columns: 16px 1fr;
    padding: var(--mq-space-2);
    position: relative;
  }

  .play-choice:hover:not(.off),
  .play-choice:has(input:checked) {
    background: var(--mq-color-surface-hover);
  }

  /* The line shows the ring, inside the popover's edge, and the radio none. */
  .play-choice:has(input:focus-visible) {
    outline: 2px solid var(--mq-color-accent);
    outline-offset: -2px;
  }

  .play-choices .play-choice input:focus-visible {
    outline: none;
  }

  .play-choice.off {
    cursor: default;
  }

  .play-choice.off .words > span:first-child {
    color: var(--mq-color-text-muted);
  }

  /* The radio is the choice's whole line, so only its check mark shows. */
  .play-choice input {
    appearance: none;
    inset: 0;
    margin: 0;
    position: absolute;
  }

  .play-choice .mark {
    color: var(--mq-color-text);
    margin-block-start: 2px;
    visibility: hidden;
  }

  .play-choice .mark .icon {
    height: 16px;
    width: 16px;
  }

  .play-choice:has(input:checked) .mark {
    visibility: visible;
  }

  .play-choice .words {
    display: grid;
    gap: 2px;
  }

  .play-choice .meaning {
    color: var(--mq-color-text-muted);
    font-size: var(--mq-font-size-small);
    line-height: 1.4;
  }

  .bar-error {
    background: var(--mq-color-surface);
    border-radius: var(--mq-radius-small);
    box-shadow: var(--mq-shadow);
    color: var(--mq-color-danger);
    font-size: var(--mq-font-size-small);
    line-height: 1.4;
    margin: 0;
    padding: var(--mq-space-2) var(--mq-space-3);
    white-space: normal;
    width: max(100%, 260px);
  }

  /* A button with words, such as Padding or Upload, quiet until it's pressed. */
  .bar-button {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: var(--mq-radius-small);
    color: var(--mq-color-text-muted);
    cursor: pointer;
    display: inline-flex;
    flex: none;
    font-weight: 500;
    gap: var(--mq-space-2);
    height: 32px;
    padding: 0 var(--mq-space-2);
  }

  .bar-button:hover:not([aria-disabled="true"]) {
    background: var(--mq-color-surface-hover);
    color: var(--mq-color-text);
  }

  /*
   * Off until something else is set, such as a Video's thumbnail before its
   * link. As an icon button's, its words fade, so its focus ring stays at
   * full strength.
   */
  .bar-button[aria-disabled="true"] {
    cursor: default;
  }

  .bar-button[aria-disabled="true"] > * {
    opacity: 0.45;
  }

  .bar-button[aria-expanded="true"] {
    background: var(--mq-color-accent-soft);
    box-shadow: inset 0 0 0 1px var(--mq-color-accent-strong);
    color: var(--mq-color-accent-strong);
  }

  /* The key a button's action has, as frame a04 draws it after "Add". */
  .bar-button kbd {
    color: var(--mq-color-text-muted);
    font: inherit;
    margin-inline-start: calc(var(--mq-space-1) - var(--mq-space-2));
  }

  .bar-button .count {
    color: var(--mq-color-text-muted);
  }

  /* A color, on a swatch with an edge, so white shows on the white bar. */
  .swatch {
    border-radius: var(--mq-radius-small);
    box-shadow: var(--_mq-swatch-edge);
    flex: none;
    height: 18px;
    width: 18px;
  }

  /* A choice of a few, such as an alignment, as a track of buttons. */
  .selection-bar .segments {
    border-radius: var(--mq-radius);
    flex: none;
    gap: 0;
    padding: calc(var(--mq-space-1) / 2);
  }

  .selection-bar .segment {
    flex: none;
    height: 28px;
    min-width: 28px;
    padding: 0 var(--mq-space-2);
  }

  .selection-bar .segment:has(> .icon:only-child) {
    padding: 0;
  }

  /* Show on's three choices, each on one line, sharing More's width. */
  .show-on .segment {
    flex: auto;
    padding-inline: var(--mq-space-2);
    white-space: nowrap;
  }

  /* A layout as its Column widths, in the bar, the Add panel and the Rows list. */
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

  .layout-option:is(:hover, [aria-pressed="true"]) .thumbnail > span {
    background: var(--mq-color-accent-soft);
    border-color: var(--mq-color-accent);
  }

  .selection-bar .layout-option {
    padding: 0 var(--mq-space-1);
    width: 34px;
  }

  .selection-bar .layout-option .thumbnail {
    height: 14px;
  }

  .selection-bar .layout-option .thumbnail > span {
    border-radius: calc(var(--mq-radius-small) / 2);
  }

  .bar-actions {
    align-items: center;
    display: flex;
    gap: var(--mq-space-1);
  }

  /* Forced colors drop the backgrounds that show a pressed or open button. */
  @media (forced-colors: active) {
    .bar-button[aria-expanded="true"],
    .bar-chip[aria-expanded="true"] {
      outline: 2px solid Highlight;
      outline-offset: -2px;
    }
  }

  /* A popover or a menu from the bar, over the email. */
  .bar-popover,
  .bar-menu {
    background: var(--mq-color-surface);
    border-radius: var(--mq-radius);
    box-shadow: var(--mq-shadow);
    inset-block-start: calc(100% + var(--mq-space-2));
    inset-inline-start: 0;
    position: absolute;
    transform-origin: top left;
    white-space: normal;
    z-index: 1;
  }

  /* A list whose items are lines, as frame k02 draws a Menu's links. */
  .bar-popover.wide {
    width: min(520px, calc(100vw - 2 * var(--mq-space-4)));
  }

  /* The way to add a list's first item, in the accent, as frame k03 draws it. */
  .add-first {
    align-items: center;
    display: inline-flex;
    gap: var(--mq-space-1);
    white-space: nowrap;
  }

  .add-first .icon {
    height: 14px;
    width: 14px;
  }

  .bar-popover {
    max-height: calc(
      min(100dvh, var(--_mq-visible-height, 100dvh)) -
        var(--_mq-top-bar-height) - var(--_mq-selection-bar-height) -
        var(--mq-space-5)
    );
    overflow-y: auto;
    width: 320px;
  }

  /*
   * One setting's popover is named by its field, so its title is only for
   * screen readers, which hear it as the group's name.
   */
  .bar-popover:not(.grid) legend {
    clip-path: inset(50%);
    height: 1px;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
    width: 1px;
  }

  /* Short number fields, such as the four sides of a padding, two by two. */
  .bar-popover.grid fieldset {
    display: grid;
    gap: var(--mq-space-3);
    grid-template-columns: 1fr 1fr;
  }

  .bar-popover.grid legend,
  .bar-popover.grid .same-sides,
  .bar-popover.grid .same-sides + .field:last-child {
    grid-column: 1 / -1;
  }

  /* The switch's name and the switch on one line. */
  .bar-popover.grid .field.inline.same-sides {
    align-items: center;
    flex-direction: row;
    justify-content: space-between;
  }

  .bar-popover.grid .field.inline {
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  .bar-menu {
    display: flex;
    flex-direction: column;
    min-width: 180px;
    padding: var(--mq-space-1);
  }

  .bar-menu > button,
  .more-action {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: var(--mq-radius-small);
    color: var(--mq-color-text);
    cursor: pointer;
    display: grid;
    gap: var(--mq-space-3);
    grid-template-columns: 16px 1fr auto;
    height: 32px;
    padding: 0 var(--mq-space-2);
    text-align: start;
  }

  .bar-menu > button:hover,
  .more-action:hover:not([aria-disabled="true"]) {
    background: var(--mq-color-surface-hover);
  }

  .more-action[aria-disabled="true"] {
    color: var(--mq-color-text-muted);
    cursor: default;
    opacity: 0.45;
  }

  .more-action kbd {
    color: var(--mq-color-text-muted);
    font: inherit;
    font-size: var(--mq-font-size-small);
  }

  .more-action.danger:hover {
    color: var(--mq-color-danger);
  }

  /*
   * More: under the bar's end, over the email, or docked beside it where it
   * fits, as tall as the editor, as the Add panel is.
   */
  .more-panel {
    background: var(--mq-color-surface);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    white-space: normal;
  }

  /*
   * Inside the window and the element both, as the element clips what's
   * past its edge: a short email leaves a short element.
   */
  .more-panel.floating {
    border-radius: var(--mq-radius);
    box-shadow: var(--mq-shadow);
    inset-block-start: calc(100% + var(--mq-space-2));
    inset-inline-end: var(--mq-space-3);
    max-height: calc(
      min(
          100dvh,
          var(--_mq-visible-height, 100dvh),
          var(--_mq-editor-height, 100dvh)
        ) -
        var(--_mq-top-bar-height) - var(--_mq-selection-bar-height) -
        var(--mq-space-5)
    );
    position: absolute;
    transform-origin: top right;
    width: var(--_mq-panel-width);
  }

  /* Docked, it's a column as tall as the editor, its panel in sight. */
  .more-dock {
    background: var(--mq-color-surface);
    border-inline-start: 1px solid var(--mq-color-border);
    flex: 0 0 var(--_mq-panel-width);
    min-width: 0;
  }

  .more-panel.docked {
    max-height: calc(
      min(100dvh, var(--_mq-visible-height, 100dvh)) - var(--_mq-top-bar-height)
    );
    position: sticky;
    top: var(--_mq-top-bar-height);
  }

  .more-head {
    align-items: flex-start;
    display: flex;
    gap: var(--mq-space-2);
    justify-content: space-between;
    padding: var(--mq-space-3) var(--mq-space-2) var(--mq-space-2)
      var(--mq-space-4);
  }

  .more-title {
    font-size: var(--_mq-font-size-bar-title);
    font-weight: 600;
    margin: 0;
  }

  .more-subtitle {
    color: var(--mq-color-text-muted);
    font-size: var(--mq-font-size-small);
    margin: 0;
  }

  .more-body {
    overflow-y: auto;
  }

  .more-body > * {
    border-block-start: 1px solid var(--mq-color-border);
  }

  /* Box's padding and border buttons, with a field's edge and width. */
  .box .field.inline > .bar-anchor {
    justify-self: stretch;
  }

  .box .bar-anchor > .bar-button,
  .bar-name + .bar-anchor:not(.play) > .bar-button {
    background-color: var(--mq-color-surface);
    color: var(--mq-color-text);
    border: 1px solid var(--mq-color-border-strong);
    border-radius: var(--mq-radius-small);
    box-shadow: var(--mq-shadow-small);
    height: 32px;
    justify-content: space-between;
    padding: 0 var(--mq-space-2);
    width: 100%;
  }

  .bar-name + .bar-anchor > .bar-button {
    padding: 0 var(--mq-space-2);
    width: auto;
  }

  .box .bar-anchor > .bar-button:hover,
  .bar-name + .bar-anchor:not(.play) > .bar-button:hover {
    border-color: var(--mq-color-text-muted);
  }

  .box .box-label {
    color: var(--mq-color-text-muted);
  }

  /*
   * In More, which reaches the editor's edge, a popover opens to the left,
   * from its button at the panel's end, as wide as the panel's fields.
   */
  .more-panel .bar-popover {
    inset-inline-end: 0;
    inset-inline-start: auto;
    transform-origin: top right;
    width: calc(var(--_mq-panel-width) - 2 * var(--mq-space-4));
  }

  /*
   * A Column's settings are named beside them, so their buttons' words are
   * their values, which stay where the bar is short of room, and the names
   * go, as each control's own name says it.
   */
  .selection-bar[data-place="columnBar"][data-compact="words"]
    .bar-content
    > .bar-name {
    display: none;
  }

  .selection-bar[data-place="columnBar"][data-compact="words"]
    .bar-button[aria-haspopup]
    > .words {
    clip-path: none;
    height: auto;
    overflow: visible;
    position: static;
    width: auto;
  }

  /* As a Column's: a Video's Play button keeps its value, and its name goes. */
  .selection-bar[data-compact="words"] .bar-name:has(+ .bar-anchor.play) {
    display: none;
  }

  .selection-bar[data-compact="words"] .bar-anchor.play > .bar-button > .words {
    clip-path: none;
    height: auto;
    overflow: visible;
    position: static;
    width: auto;
  }

  .box .box-note {
    align-items: flex-start;
    display: flex;
    gap: var(--mq-space-2);
  }

  .box .box-note .icon {
    flex: none;
    height: 14px;
    margin-block-start: 1px;
    width: 14px;
  }

  /* No color: a line across, as a color field shows "None". */
  .swatch.none {
    background: linear-gradient(
      135deg,
      transparent calc(50% - 1px),
      var(--mq-color-danger) calc(50% - 1px),
      var(--mq-color-danger) calc(50% + 1px),
      transparent calc(50% + 1px)
    );
  }

  .words.unset {
    color: var(--mq-color-text-muted);
  }

  .more-actions {
    display: flex;
    flex-direction: column;
    padding: var(--mq-space-2) var(--mq-space-2) var(--mq-space-3);
  }

  .more-actions h3 {
    font-size: var(--mq-font-size);
    font-weight: 600;
    margin: 0 var(--mq-space-2) var(--mq-space-2);
  }

  /*
   * Where the bar is short of room, its own actions are in More instead, and
   * only there, then a switch's meaning goes, and then a button with words
   * shows its icon. Each is kept for screen readers. fitSelectionBar says
   * which.
   */
  .more-action.narrow-only {
    display: none;
  }

  .selection-bar[data-compact] .bar-actions {
    display: none;
  }

  .more-panel[data-compact] .more-action.narrow-only {
    display: grid;
  }

  .selection-bar:is([data-compact="means"], [data-compact="words"])
    .bar-switch
    > .means,
  .selection-bar[data-compact="words"] .bar-button[aria-haspopup] > .words {
    clip-path: inset(50%);
    height: 1px;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
    width: 1px;
  }

  @media (prefers-reduced-motion: no-preference) {
    .bar-popover,
    .bar-menu,
    .more-panel.floating {
      animation: bar-pop-in 140ms cubic-bezier(0.2, 0, 0, 1);
    }
  }

  @keyframes bar-pop-in {
    from {
      opacity: 0;
      transform: scale(0.97);
    }
  }

  /*
   * On a phone, the bar is docked at the bottom, over the email, as frames
   * 8-phone and p08 draw it, and its controls are as tall as a fingertip.
   * What doesn't fit scrolls along it, as at 320px.
   */
  .app[data-phone] .bar-dock {
    bottom: var(--mq-space-2);
    margin: auto var(--mq-space-2) var(--mq-space-2);
    order: 1;
    top: auto;
  }

  .app[data-phone] .selection-bar {
    border: 0;
    border-radius: var(--mq-radius-large);
    box-shadow: var(--mq-shadow);
    gap: var(--mq-space-1);
    justify-content: flex-start;
    min-height: var(--_mq-phone-bar-height);
    overflow-x: auto;
    padding: 0 var(--mq-space-2);
    scrollbar-width: none;
  }

  /*
   * As wide as the bar, so a field shrinks to fit, as frame q05a draws it,
   * and More is at the end.
   */
  .app[data-phone] .selection-bar .bar-content {
    flex: 1 1 auto;
    margin-inline: 0;
    max-width: none;
    min-width: 0;
  }

  /* Its own width while fitSelectionBar measures it, rather than the bar's. */
  .app[data-phone] .selection-bar .bar-content[data-measuring] {
    flex: none;
  }

  .app[data-phone] .selection-bar .bar-content > .bar-anchor:has(> .bar-field),
  .app[data-phone] .selection-bar .bar-content > .bar-field {
    flex: 0 1 auto;
    min-width: 0;
  }

  .app[data-phone]
    .selection-bar
    .bar-content
    > [data-action="more"]:last-child {
    margin-inline-start: auto;
  }

  /*
   * Where it still doesn't fit, as in a part of a page narrower than a phone,
   * what doesn't scrolls under More, which stays at the end, over the bar's
   * own padding there too, so nothing shows past it.
   */
  .app[data-phone] .selection-bar:has([data-action="more"]:last-child) {
    padding-inline-end: 0;
  }

  .app[data-phone] .selection-bar [data-action="more"]:last-child {
    background: var(--mq-color-surface);
    border-radius: 0;
    box-shadow: -8px 0 8px var(--mq-color-surface);
    box-sizing: content-box;
    inset-inline-end: 0;
    padding-inline-end: var(--mq-space-2);
    position: sticky;
  }

  .app[data-phone] .selection-bar :is(.icon-button, .bar-button, .bar-chip) {
    height: 44px;
    min-width: 44px;
  }

  .app[data-phone] .selection-bar .bar-field {
    height: 44px;
  }

  /* Inputs under 16px make Safari on a phone zoom the page. */
  .app[data-phone] :is(input, select, textarea) {
    font-size: max(16px, 1em);
  }

  /* What's selected is its icon, in the accent, and a Row or Column its name. */
  .app[data-phone] .bar-chip {
    padding: 0 var(--mq-space-2) 0 0;
  }

  .app[data-phone] .bar-chip .chip-icon {
    background: var(--mq-color-accent-soft);
    border-radius: var(--mq-radius-small);
    color: var(--mq-color-accent-strong);
    height: 44px;
    width: 44px;
  }

  .app[data-phone] .bar-chip .chip-icon .icon {
    height: 18px;
    width: 18px;
  }

  .app[data-phone] .bar-chip:has(.chip-name) {
    padding: 0;
  }

  .app[data-phone] .bar-chip > .icon,
  .app[data-phone] .bar-chip :is(.chip-path, .chip-name) {
    clip-path: inset(50%);
    height: 1px;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
    width: 1px;
  }

  /*
   * With nothing selected, the email's chip, which opens its settings, in the
   * accent with its name and chevron, as frame q01c draws it.
   */
  .app[data-phone] .bar-chip.email-chip {
    background: var(--mq-color-accent-soft);
    border-radius: var(--mq-radius);
    color: var(--mq-color-accent-strong);
    flex: none;
    font-weight: 600;
    gap: var(--mq-space-1);
    padding-inline-end: var(--mq-space-3);
  }

  /* One color across it, rather than an icon in a tile of its own. */
  .app[data-phone] .bar-chip.email-chip .chip-icon {
    background: none;
    padding-inline-start: var(--mq-space-3);
    width: auto;
  }

  .app[data-phone] .bar-chip.email-chip > .icon {
    clip-path: none;
    height: 16px;
    position: static;
    width: 16px;
  }

  /* With nothing selected: the email's chip, what to do, then Add. */
  .bar-hint {
    color: var(--mq-color-text-muted);
    flex: 1;
    font-size: var(--_mq-font-size-bar-title);
    line-height: 1.3;
    min-width: 0;
    overflow-wrap: anywhere;
    padding-inline: var(--mq-space-2);
    text-wrap: balance;
    /* On two lines where one doesn't fit, rather than cut off. */
    white-space: normal;
  }

  .app[data-phone] .bar-content:has(> .bar-hint) {
    width: 100%;
  }

  .app[data-phone] .bar-button.primary {
    background: var(--mq-color-accent);
    border-radius: var(--mq-radius);
    color: var(--mq-color-on-accent);
    padding-inline: var(--mq-space-3) var(--mq-space-4);
  }

  .app[data-phone] .bar-button.primary .icon {
    color: inherit;
  }

  .app[data-phone] .bar-button.primary kbd {
    display: none;
  }

  /* More and the bar's popovers, as sheets. */
  dialog.sheet.more-panel .more-body {
    margin-inline: calc(-1 * var(--mq-space-4));
  }

  /* Over the room and the place tool-fitting.ts gives a popover under its button. */
  dialog.sheet.bar-popover,
  dialog.sheet.bar-popover.wide {
    max-height: calc(
      min(100dvh, var(--_mq-visible-height, 100dvh)) - var(--_mq-top-bar-height)
    );
    max-width: none !important;
    translate: none !important;
    width: 100%;
  }

  dialog.sheet.bar-popover legend {
    clip-path: inset(50%);
    height: 1px;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
    width: 1px;
  }

  /* Room inside its edge for an item's focus ring. */
  dialog.sheet .bar-menu {
    background: none;
    box-shadow: none;
    min-width: 0;
    padding: var(--mq-space-1) 0;
    position: static;
  }

  /* On a phone, the bar's own actions, at the top of More. Frame q05a. */
  .more-tiles {
    display: grid;
    gap: var(--mq-space-2);
    grid-template-columns: repeat(4, minmax(0, 1fr));
    padding: var(--mq-space-3) var(--mq-space-4);
  }

  .more-tile {
    align-items: center;
    background: transparent;
    border: 1px solid var(--mq-color-border);
    border-radius: var(--mq-radius);
    color: var(--mq-color-text);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: var(--mq-space-1);
    justify-content: center;
    min-height: 60px;
    padding: var(--mq-space-2) var(--mq-space-1);
    text-align: center;
  }

  .more-tile.danger {
    color: var(--mq-color-danger);
  }

  .more-tile[aria-disabled="true"] {
    color: var(--mq-color-text-muted);
    cursor: default;
  }

  .more-tile:hover:not([aria-disabled="true"]) {
    background: var(--mq-color-surface-hover);
  }

  /* What's selected, marked, at the top of the chip's menu. Frame q02b. */
  dialog.sheet .bar-menu > [aria-checked="true"] {
    background: var(--mq-color-accent-soft);
    color: var(--mq-color-accent-strong);
  }

  dialog.sheet .bar-menu > button > .icon:last-child:not(:first-child) {
    justify-self: end;
  }

  dialog.sheet :is(.more-action, .bar-menu > button) {
    min-height: 44px;
  }

  /* In a sheet, a button that opens another sheet points on, not down. */
  dialog.sheet .bar-button[aria-haspopup] > .words ~ .icon:last-child {
    rotate: -90deg;
  }
`;

/** The popover, menu or panel the Selection bar has open. */
export interface BarPanelsState {
  /** The bar's popover that's open, by its button's `data-action`. */
  popover: string | undefined;
  /** Whether the chip's menu is open. */
  menuOpen: boolean;
  /** Whether More is open. It stays open as the selection changes. */
  moreOpen: boolean;
  /**
   * The Rows whose padding shows each side, as the person turned "Same on
   * every side" off, though every side is the same.
   */
  paddingBySide: ReadonlySet<string>;
}

interface BarPanelsHost {
  focus: Pick<EditorFocus, "focusWhenRendered">;
  requestUpdate: () => void;
}

export type BarPanels = ReturnType<typeof createBarPanels>;

/** Whether `element` is in what's open from the bar, or its button. */
const isInOpen = (element: Element, opened: Place, button: string) =>
  element.closest(`[data-place="${opened}"]`) !== null ||
  element.closest(`[data-action="${CSS.escape(button)}"]`) !== null;

/**
 * What the Selection bar has open. A popover and the chip's menu close when
 * the selection changes, a press lands outside them, or focus leaves them, and
 * Escape closes them back to their button. More stays open until it's closed.
 */
export const createBarPanels = ({ focus, requestUpdate }: BarPanelsHost) => {
  const paddingBySide = new Set<string>();
  const state: BarPanelsState = {
    menuOpen: false,
    moreOpen: false,
    paddingBySide,
    popover: undefined,
  };

  const closePopover = (returnFocus: boolean) => {
    const { popover } = state;
    if (popover === undefined) {
      return;
    }
    state.popover = undefined;
    requestUpdate();
    if (returnFocus) {
      focus.focusWhenRendered({
        action: popover,
        on: popover.startsWith(IN_MORE) ? "more" : "bar",
      });
    }
  };

  const closeMenu = (returnFocus: boolean) => {
    if (!state.menuOpen) {
      return;
    }
    state.menuOpen = false;
    requestUpdate();
    if (returnFocus) {
      focus.focusWhenRendered({ action: "chip", on: "bar" });
    }
  };

  return {
    closeMenu,

    closeMore: (returnFocus: boolean) => {
      if (!state.moreOpen) {
        return;
      }
      state.moreOpen = false;
      requestUpdate();
      if (returnFocus) {
        focus.focusWhenRendered({ action: "more", on: "bar" });
      }
    },

    closePopover,

    /** Focus that leaves a popover or the menu, and its button, closes it. */
    onFocusout({ relatedTarget }: FocusEvent) {
      if (!(relatedTarget instanceof Element)) {
        return;
      }
      const { popover } = state;
      if (
        popover !== undefined &&
        !isInOpen(relatedTarget, "barPopover", popover)
      ) {
        closePopover(false);
      }
      if (state.menuOpen && !isInOpen(relatedTarget, "barMenu", "chip")) {
        closeMenu(false);
      }
    },

    /** A press outside a popover or the menu, and its button, closes it. */
    onPointerdown({ target }: PointerEvent) {
      if (!(target instanceof Element)) {
        return;
      }
      const { popover } = state;
      if (popover !== undefined && !isInOpen(target, "barPopover", popover)) {
        closePopover(false);
      }
      if (state.menuOpen && !isInOpen(target, "barMenu", "chip")) {
        closeMenu(false);
      }
    },

    /** Shows a Row's padding by side, or as one value while it's the same. */
    showPaddingBySide(rowId: string, bySide: boolean) {
      if (bySide) {
        paddingBySide.add(rowId);
      } else {
        paddingBySide.delete(rowId);
      }
      requestUpdate();
    },

    /** A new selection has its own bar, with nothing of the last one's open. */
    onSelect() {
      state.popover = undefined;
      state.menuOpen = false;
    },

    state,

    /** Opens the chip's menu with focus on its first item, or closes it. */
    toggleMenu() {
      state.menuOpen = !state.menuOpen;
      state.popover = undefined;
      requestUpdate();
      if (state.menuOpen) {
        focus.focusWhenRendered({ on: "barMenu" });
      }
    },

    /** Opens More, with focus in it from the keyboard, or closes it. */
    toggleMore(fromKeyboard: boolean) {
      state.moreOpen = !state.moreOpen;
      state.popover = undefined;
      state.menuOpen = false;
      requestUpdate();
      if (state.moreOpen && fromKeyboard) {
        focus.focusWhenRendered({ on: "more" });
      }
    },

    /** Opens a popover with focus on its first field, or closes it. */
    togglePopover(id: string) {
      state.popover = state.popover === id ? undefined : id;
      state.menuOpen = false;
      requestUpdate();
      if (state.popover !== undefined) {
        focus.focusWhenRendered({ on: "barPopover" });
      }
    },
  };
};

/** What the bar and More show: the selected Block, Row, Column, or the email. */
type Target =
  | { kind: "block"; position: BlockPosition }
  | { kind: "row"; position: RowPosition }
  | { kind: "column"; position: ColumnPosition }
  | { kind: "email" };

const targetOf = ({
  selectedBlock,
  selectedColumn,
  selectedRow,
}: PanelApi): Target => {
  if (selectedBlock) {
    return { kind: "block", position: selectedBlock };
  }
  if (selectedColumn) {
    return { kind: "column", position: selectedColumn };
  }
  return selectedRow
    ? { kind: "row", position: selectedRow }
    : { kind: "email" };
};

/** MJML's corners on a Button, which the Canvas draws too, in px. */
const BUTTON_CORNERS = "3px";

/** The start of the `data-action` of a popover's button in More. */
const IN_MORE = "more-";

/** The Block section's ID, which keeps what's typed with the Block it's for. */
const BLOCK_SECTION_ID = "block";

/**
 * Where what's typed in a selected Block's field is kept, or in a list
 * field, in one of an item's fields.
 */
export const blockDraftKey = (
  blockId: string,
  fieldKey: string,
  part?: ListPart
) =>
  draftKey(
    { id: BLOCK_SECTION_ID, targetId: blockId },
    { key: fieldKey },
    part
  );

/**
 * Opens the file picker, with only the types an upload takes. The picker is
 * the button's, so it's no Tab stop of its own.
 */
const renderUpload = (
  blockId: string,
  uploadImage: (blockId: string, file: File) => void,
  label: string,
  attributes: {
    action?: string;
    className: string;
    describedBy?: string;
    icon?: TemplateResult;
  }
) => html`
  <button
    aria-describedby=${attributes.describedBy ?? nothing}
    class=${attributes.className}
    data-action=${attributes.action ?? nothing}
    tabindex=${attributes.action ? "-1" : nothing}
    type="button"
    @click=${({ currentTarget }: MouseEvent) =>
      (
        (currentTarget as Element).nextElementSibling as HTMLInputElement
      ).click()}
  >
    ${attributes.icon ?? nothing}<span>${label}</span>
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

/** The CSS a Block's prop is drawn as, where Email style can give its value. */
const SHARED_PROPS = {
  backgroundColor: "background-color",
  color: "color",
  fontSize: "font-size",
} as const;

/**
 * A Block's fields, each showing what the Canvas draws while the Block sets
 * none of its own: Email style's value, or else the built-in look.
 */
const withSharedDefaults = (block: Block, style: EmailStyle) => {
  // Its other props stay, such as a Heading's level, which its size is for.
  const others = Object.fromEntries(
    Object.entries(block.props).filter(
      ([key]) => !Object.hasOwn(SHARED_PROPS, key)
    )
  );
  const shared = blockStyles(
    { props: others, type: block.type } as Block,
    style
  );
  return blockSettingsFields(block).map((field) => {
    const property = SHARED_PROPS[field.key as keyof typeof SHARED_PROPS];
    const value = property && shared[property];
    if (value === undefined) {
      return field;
    }
    return {
      ...field,
      default: field.type === "number" ? Number(value.slice(0, -2)) : value,
    };
  });
};

/**
 * In the Phone view, `section` as a phone shows it: each field that can have
 * a Phone value shows and changes that, or the setting's own value while it
 * has none. The other fields change the setting on every device. Its fields
 * keep their draft keys, as Check's Fix and an upload find them by those.
 */
const onDevice = (
  section: SettingsSection,
  props: Record<string, unknown>,
  type: string | undefined,
  api: PanelApi
): SettingsSection => {
  if (api.device !== "phone") {
    return section;
  }
  const keys = new Set(phoneValueKeys(type));
  const set = (props.phone ?? {}) as Record<string, unknown>;
  return {
    ...section,
    command: (changes) => {
      const entries = Object.entries(changes);
      const own = entries.filter(([key]) => !keys.has(key));
      if (own.length === entries.length) {
        return section.command(changes);
      }
      // A null takes the Phone value away, as it does a setting.
      const phone = Object.entries({
        ...set,
        ...Object.fromEntries(entries.filter(([key]) => keys.has(key))),
      }).filter(([, value]) => value !== null);
      return section.command({
        ...Object.fromEntries(own),
        phone: phone.length > 0 ? Object.fromEntries(phone) : null,
      });
    },
    phone: { desktop: section.values, keys, set },
    values: { ...section.values, ...set },
  };
};

/**
 * A Button's font size, which only a Phone value sets, so its field is
 * only in the Phone view. Unset, it's the size every Block shares.
 */
const buttonFontSizeOnPhones = (style: EmailStyle): SettingsField => ({
  default: style.textFontSize ?? Number(EMAIL_LOOK.fontSize.slice(0, -2)),
  invalidMessageId: "invalid.pixelsBetween",
  key: "fontSize",
  labelId: "field.fontSize",
  max: 200,
  min: 1,
  type: "number",
  unit: "px",
});

const blockSection = (position: BlockPosition, api: PanelApi) =>
  onDevice(
    desktopBlockSection(position, api),
    position.block.props as Record<string, unknown>,
    position.block.type,
    api
  );

/**
 * Upload beside an Image's URL or a Video's thumbnail, and why its last
 * upload failed.
 */
const uploadExtra = (blockId: string, api: PanelApi) => ({
  control: api.uploadImage
    ? renderUpload(blockId, api.uploadImage, api.text("bar.uploadImage"), {
        className: "text-button",
      })
    : undefined,
  error: api.uploadErrorOf(blockId),
});

/**
 * A Video's Command from the bar: a YouTube link fills in a thumbnail it
 * doesn't have, and a new thumbnail is drawn on again where the play button
 * was on the picture.
 */
const videoCommand = (
  blockId: string,
  props: Record<string, unknown>,
  api: PanelApi
): Command => {
  if (typeof props.url === "string") {
    api.videos.fillThumbnail(blockId, props.url);
  }
  api.videos.willChange(blockId, props);
  return { blockId, props, type: "updateBlockProps" };
};

const desktopBlockSection = (
  { block }: BlockPosition,
  api: PanelApi
): SettingsSection => ({
  command: (props) =>
    block.type === "video"
      ? videoCommand(block.id, props, api)
      : { blockId: block.id, props, type: "updateBlockProps" },
  extras: {
    image: { src: uploadExtra(block.id, api) },
    video: { thumbnail: uploadExtra(block.id, api) },
  }[block.type as string],
  fields: [
    ...withSharedDefaults(block, api.email.settings.style ?? {}),
    ...(block.type === "button" && api.device === "phone"
      ? [buttonFontSizeOnPhones(api.email.settings.style ?? {})]
      : []),
  ],
  id: BLOCK_SECTION_ID,
  legend: blockTypeName(block.type, api.text),
  targetId: block.id,
  values: block.props,
});

const rowSection = (position: RowPosition, api: PanelApi) =>
  onDevice(
    desktopRowSection(position, api),
    position.row.props as Record<string, unknown>,
    undefined,
    api
  );

const desktopRowSection = (
  { row }: RowPosition,
  api: PanelApi
): SettingsSection => ({
  command: (props) => ({ props, rowId: row.id, type: "updateRowProps" }),
  fields: rowSettingsFields(row),
  id: "row",
  legend: api.text("bar.row"),
  targetId: row.id,
  // Behind a Row without its own: the email's color, or else the page's.
  unsetColor:
    api.email.settings.style?.emailBackgroundColor ??
    api.email.settings.backgroundColor,
  values: row.props,
});

/** What's behind a Column without a color of its own: its Row's, or the email's. */
const behindColumn = ({ row }: ColumnPosition, api: PanelApi) =>
  (row.props as RowProps).backgroundColor ??
  api.email.settings.style?.emailBackgroundColor ??
  api.email.settings.backgroundColor;

const columnSection = (position: ColumnPosition, api: PanelApi) =>
  onDevice(
    desktopColumnSection(position, api),
    position.column.props as Record<string, unknown>,
    undefined,
    api
  );

const desktopColumnSection = (
  position: ColumnPosition,
  api: PanelApi
): SettingsSection => ({
  command: (props) => ({
    columnId: position.column.id,
    props,
    type: "updateColumnProps",
  }),
  fields: COLUMN_SETTINGS_FIELDS,
  id: "column",
  legend: api.text("bar.column"),
  targetId: position.column.id,
  unsetColor: behindColumn(position, api),
  values: position.column.props,
});

/**
 * A Block's Box, in More: its padding, background, border and corners. Its
 * own section, so what's typed in it is kept apart from the Block's own.
 */
const boxSection = (position: BlockPosition, api: PanelApi) =>
  onDevice(
    desktopBoxSection(position, api),
    position.block.props as Record<string, unknown>,
    position.block.type,
    api
  );

const desktopBoxSection = (
  { block, column, row }: BlockPosition,
  api: PanelApi
): SettingsSection => ({
  command: (props) => ({ blockId: block.id, props, type: "updateBlockProps" }),
  // A Button's corners are its own shape's, so unset they're what it shows.
  // Behind a Box without its own color: its Column's, or what's behind that.
  unsetColor:
    (column.props as ColumnProps).backgroundColor ??
    behindColumn({ column, columnIndex: 0, row, rowIndex: 0 }, api),
  fields: blockBoxFields(block.type).map((field) =>
    field.key === "borderRadius" && block.type === "button"
      ? {
          ...field,
          default: Number(
            (
              blockStyles(block, api.email.settings.style ?? {})[
                "border-radius"
              ] ?? BUTTON_CORNERS
            ).slice(0, -"px".length)
          ),
        }
      : field
  ),
  id: "box",
  legend: api.text("more.box"),
  targetId: block.id,
  values: block.props,
});

/** The email's look, its background and font, which is set in Style. */
const STYLED_IN_STYLE = new Set(["backgroundColor", "fontFamily"]);

const emailSection = (api: PanelApi): SettingsSection => ({
  command: (settings) => ({ settings, type: "updateEmailSettings" }),
  fields: EMAIL_SETTINGS_FIELDS.filter(({ key }) => !STYLED_IN_STYLE.has(key)),
  id: "email",
  legend: api.text("bar.email"),
  targetId: "",
  values: { ...api.email.settings },
});

const sectionOf = (target: Target, api: PanelApi) => {
  switch (target.kind) {
    case "block": {
      return blockSection(target.position, api);
    }
    case "row": {
      return rowSection(target.position, api);
    }
    case "column": {
      return columnSection(target.position, api);
    }
    default: {
      return emailSection(api);
    }
  }
};

/**
 * One of the bar's settings. Its keys are the fields it shows; every field of
 * what's selected that no control shows is in More.
 */
type Control =
  /** A field typed in, wide or narrow, with its name or an icon inside. */
  | {
      kind: "text";
      key: string;
      icon?: TemplateResult;
      label?: StringId;
      placeholder?: StringId;
      /** In its place where there's an Upload button before the field. */
      placeholderAfterUpload?: StringId;
      width: number;
    }
  /**
   * A number in px, with its name before it where the field doesn't say, or
   * an icon inside it, with its name as its tooltip.
   */
  | { kind: "number"; key: string; label?: StringId; icon?: TemplateResult }
  /** A color's swatch and name, which opens its field. */
  | { kind: "color"; key: string; label: StringId }
  /** A switch with its name, and while it's on, what that means. */
  | { kind: "toggle"; key: string; whenOn?: StringId }
  /** One of a few, as a track of buttons, each its icon or a short name. */
  | {
      kind: "choice";
      key: string;
      icons?: Readonly<Record<string, TemplateResult>>;
      short?: (value: number | string) => string;
    }
  /** A button that opens fields in a popover. */
  | {
      kind: "popover";
      id: string;
      keys: readonly string[];
      icon?: TemplateResult;
      /** What the button says. Without it, it's its icon and a tooltip. */
      label?: (values: Record<string, unknown>, text: Text) => string;
      name: StringId;
      grid?: boolean;
      /** Wider than a popover of one field, for a list whose items are lines. */
      wide?: boolean;
      /**
       * While its list field, its one key, has no items, the button says
       * this and adds the first, opening the popover with it.
       */
      addFirst?: StringId;
      /** Why it can't open, which its tooltip says, as it stays reachable. */
      offWhy?: StringId;
    }
  /** A Row's layout, as its Columns. */
  | { kind: "layout" }
  /** Upload, for an Image, with the Host app's `uploadImage`. */
  | { kind: "upload" }
  /** A Video's play button: its choices, each with what it means. */
  | { kind: "play" };

/** A Column's settings each have their name before them, as frame `f02` draws. */
type NamedControl = Control & {
  /** Shown before the control, which is named for it already. */
  lead?: StringId;
  /** A color shows its value, or "None", rather than its name. */
  showValue?: boolean;
};

const PADDING_KEYS = [
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
] as const;

/**
 * Padding as few numbers as say it: one while every side is the same, two
 * while top and bottom are, and left and right are, or else all four.
 */
const paddingWords = (
  values: Record<string, unknown>,
  fallback: number,
  text: Text
) => {
  const [top, right, bottom, left] = PADDING_KEYS.map((key) =>
    String(values[key] ?? fallback)
  );
  let sides = [top, right, bottom, left];
  if (top === bottom && right === left) {
    sides = top === right ? [top] : [top, right];
  }
  return text("bar.pixels", { value: sides.join(" · ") });
};

/** A border as its width and style, such as "1px solid", or "None". */
const borderWords = (values: Record<string, unknown>, text: Text) => {
  const { borderStyle = "solid", borderWidth } = values;
  return borderWidth === undefined
    ? text("settings.none")
    : text(`bar.border.${borderStyle as "dashed" | "dotted" | "solid"}`, {
        width: String(borderWidth),
      });
};

/** The fields of a border: its width, style and color. */
const BORDER_KEYS = ["borderWidth", "borderStyle", "borderColor"] as const;

/** A Column's Blocks sit at its top, middle or bottom. */
const VERTICAL_ALIGN_ICONS = {
  bottom: ICONS.alignBottom,
  middle: ICONS.alignMiddle,
  top: ICONS.alignTop,
};

const ALIGN_ICONS = {
  center: ICONS.alignCenter,
  left: ICONS.alignLeft,
  right: ICONS.alignRight,
};

const ALIGN: Control = { icons: ALIGN_ICONS, key: "align", kind: "choice" };

/** The keys a control shows. */
const keysOf = (control: Control): readonly string[] => {
  switch (control.kind) {
    case "popover": {
      return control.keys;
    }
    case "layout":
    case "upload": {
      return [];
    }
    case "play": {
      return ["play"];
    }
    default: {
      return [control.key];
    }
  }
};

/**
 * Each Block's two to four most-used settings, and a Row's and the email's,
 * as the picked frames draw them. An Image's depend on whether it has one.
 */
const CONTROLS: Readonly<
  Record<BlockType, (values: Record<string, unknown>) => readonly Control[]>
> & {
  readonly column: readonly NamedControl[];
  readonly email: readonly Control[];
  readonly row: (columns: number) => readonly Control[];
} = {
  column: [
    {
      key: "backgroundColor",
      kind: "color",
      label: "bar.background",
      lead: "bar.background",
      showValue: true,
    },
    {
      grid: true,
      id: "popover-padding",
      keys: PADDING_KEYS,
      kind: "popover",
      label: (values, text) => paddingWords(values, 0, text),
      lead: "bar.padding",
      name: "bar.padding",
    },
    {
      icons: VERTICAL_ALIGN_ICONS,
      key: "verticalAlign",
      kind: "choice",
      lead: "bar.align",
    },
    {
      id: "popover-border",
      keys: BORDER_KEYS,
      kind: "popover",
      label: (values, text) => borderWords(values, text),
      lead: "bar.border",
      name: "bar.border",
    },
  ],
  button: () => [
    {
      icon: ICONS.link,
      key: "href",
      kind: "text",
      placeholder: "bar.addLink",
      width: 250,
    },
    { key: "backgroundColor", kind: "color", label: "bar.fill" },
    { key: "color", kind: "color", label: "bar.textColor" },
    ALIGN,
  ],
  divider: () => [
    { key: "color", kind: "color", label: "bar.color" },
    { key: "thickness", kind: "number", label: "bar.thickness" },
  ],
  email: [
    { key: "preheader", kind: "text", label: "bar.preheader", width: 300 },
    { key: "language", kind: "text", label: "bar.language", width: 130 },
    { key: "width", kind: "number", label: "bar.width" },
  ],
  heading: () => [
    {
      key: "level",
      kind: "choice",
      short: (level) => `H${level}`,
    },
    { key: "fontSize", kind: "number" },
    { key: "color", kind: "color", label: "bar.color" },
    ALIGN,
  ],
  menu: () => [
    {
      addFirst: "field.menuLinks.add",
      icon: ICONS.link,
      id: "popover-links",
      keys: ["links"],
      kind: "popover",
      label: (_values, text) => text("bar.links"),
      name: "field.menuLinks",
      wide: true,
    },
    ALIGN,
    { key: "color", kind: "color", label: "bar.textColor" },
    { key: "fontSize", kind: "number" },
    { icon: ICONS.width, key: "gap", kind: "number" },
  ],
  image: ({ decorative, src }) =>
    src === undefined
      ? [
          { kind: "upload" },
          {
            icon: ICONS.link,
            key: "src",
            kind: "text",
            placeholder: "bar.imageUrl",
            placeholderAfterUpload: "bar.pasteImageUrl",
            width: 230,
          },
          { key: "alt", kind: "text", label: "bar.alt", width: 190 },
        ]
      : [
          { kind: "upload" },
          // While it's on, what it means takes the place of the alt text,
          // which a decorative Image doesn't have, as frame `d01` draws it.
          { key: "decorative", kind: "toggle", whenOn: "bar.decorative" },
          { key: "alt", kind: "text", label: "bar.alt", width: 230 },
          {
            icon: ICONS.width,
            id: "popover-width",
            keys: ["width"],
            kind: "popover",
            label: ({ width }, text) =>
              width === undefined
                ? text("bar.widthFill")
                : text("bar.widthOf", { width: String(width) }),
            name: "field.width",
          },
          {
            icon: ICONS.link,
            id: "popover-link",
            keys: ["href"],
            kind: "popover",
            name: "field.link",
            offWhy: decorative ? "field.link.decorative" : undefined,
          },
        ],
  row: (columns) => [
    { kind: "layout" },
    {
      grid: true,
      icon: ICONS.padding,
      id: "popover-padding",
      keys: ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"],
      kind: "popover",
      label: (_values, text) => text("bar.padding"),
      name: "bar.padding",
    },
    ...(columns > 1
      ? [
          {
            icon: ICONS.phone,
            id: "popover-stack",
            keys: ["stackOnPhone"],
            kind: "popover",
            label: (_values: Record<string, unknown>, text: Text) =>
              text("bar.stackOnPhones"),
            name: "field.stackOnPhone",
          } satisfies Control,
        ]
      : []),
  ],
  social: () => [
    {
      icon: ICONS.link,
      id: "popover-links",
      keys: ["links"],
      kind: "popover",
      label: (_values, text) => text("bar.links"),
      name: "field.socialLinks",
    },
    { key: "iconStyle", kind: "choice" },
    { key: "iconSize", kind: "choice", short: String },
    ALIGN,
  ],
  spacer: () => [{ key: "height", kind: "number", label: "bar.height" }],
  text: () => [
    { key: "fontSize", kind: "number" },
    { key: "color", kind: "color", label: "bar.color" },
    ALIGN,
  ],
  // As frames k04 and k05 draw it. A thumbnail waits for the link, which a
  // YouTube one fills it in from.
  video: ({ thumbnail, url }) => [
    {
      icon: ICONS.link,
      key: "url",
      kind: "text",
      placeholder: "bar.videoUrl",
      width: 220,
    },
    {
      icon: BLOCK_VIEWS.image.icon,
      id: "popover-thumbnail",
      keys: ["thumbnail"],
      kind: "popover",
      label: (values, text) =>
        text(
          values.thumbnail === undefined ? "bar.addThumbnail" : "bar.thumbnail"
        ),
      name: "field.thumbnail",
      offWhy:
        url === undefined && thumbnail === undefined
          ? "bar.thumbnailWaits"
          : undefined,
    },
    {
      key: "alt",
      kind: "text",
      label: "bar.alt",
      placeholder: "bar.describeThumbnail",
      width: 230,
    },
    { kind: "play" },
  ],
};

/** What tells a control apart in `PHONE_BAR`: its field, its popover, or its kind. */
const controlId = (control: Control) => {
  if ("key" in control) {
    return control.key;
  }
  return "id" in control ? control.id : control.kind;
};

/**
 * On a phone, the controls a Block's bar keeps: its main one and, where it has
 * one, a color, as frame q05a draws them. The rest are in More, so the bar
 * never scrolls.
 */
const PHONE_BAR: Readonly<Record<BlockType, readonly string[]>> = {
  button: ["href", "backgroundColor"],
  divider: ["color", "thickness"],
  heading: ["level", "color"],
  image: ["upload", "src", "popover-link"],
  menu: ["popover-links", "color"],
  social: ["popover-links"],
  spacer: ["height"],
  text: ["fontSize", "color"],
  video: ["url", "popover-thumbnail"],
};

const PHONE_COLUMN_BAR: ReadonlySet<string> = new Set(["backgroundColor"]);

const blockControls = (
  { props, type }: { props: unknown; type: BlockType },
  phone: boolean
) => {
  const controls = CONTROLS[type](props as Record<string, unknown>);
  return phone
    ? controls.filter((control) => PHONE_BAR[type].includes(controlId(control)))
    : controls;
};

const controlsOf = (target: Target, phone: boolean) => {
  switch (target.kind) {
    case "block": {
      return blockControls(target.position.block, phone);
    }
    case "row": {
      return CONTROLS.row(target.position.row.columns.length);
    }
    // On a phone, its background, as a Block's bar keeps its main controls,
    // and More has the rest.
    case "column": {
      return phone
        ? CONTROLS.column.filter((control) =>
            PHONE_COLUMN_BAR.has(controlId(control))
          )
        : CONTROLS.column;
    }
    default: {
      return CONTROLS.email;
    }
  }
};

/**
 * Where the bar shows a Block's field, or the email's: in the bar itself, in
 * a popover from the button with `data-action` `id`, or in More.
 */
export const fieldShownIn = (
  of: { type: BlockType; props: Record<string, unknown> } | "email",
  key: string,
  phone: boolean
): { in: "bar" } | { in: "more" } | { in: "popover"; id: string } => {
  // On a phone, the email's bar has no room for its fields, so More has them.
  if (of === "email" && phone) {
    return { in: "more" };
  }
  const controls = of === "email" ? CONTROLS.email : blockControls(of, phone);
  const control = controls.find((each) => keysOf(each).includes(key));
  switch (control?.kind) {
    case undefined: {
      return { in: "more" };
    }
    case "popover": {
      return { id: control.id, in: "popover" };
    }
    case "color":
    case "play": {
      return { id: `popover-${key}`, in: "popover" };
    }
    default: {
      return { in: "bar" };
    }
  }
};

/** The fields of what's selected that the bar doesn't show, for More. */
const moreFieldsOf = (
  target: Target,
  section: SettingsSection,
  api: PanelApi
) => {
  // On a phone, the email's bar has no room for its settings, so More has them.
  const shown = new Set(
    api.phone && target.kind === "email"
      ? []
      : controlsOf(target, api.phone).flatMap(keysOf)
  );
  return section.fields.filter(({ key }) => !shown.has(key));
};

/** What a field shows unset: its default, or for a color, what's behind it. */
const shownValue = (section: SettingsSection, field: SettingsField) =>
  fieldText(field, section.values) || section.unsetColor || "";

const renderSeparator = () =>
  html`<span aria-hidden="true" class="bar-separator"></span>`;

/** What a field shows empty, which can point to the Upload button before it. */
const placeholderOf = (
  control: Extract<Control, { kind: "text" }>,
  api: PanelApi
) => (api.uploadImage && control.placeholderAfterUpload) || control.placeholder;

/** A field typed in, which applies on Enter or as focus leaves, as every field does. */
const renderTextControl = (
  section: SettingsSection,
  field: SettingsField,
  control: Extract<Control, { kind: "text" }>,
  api: PanelApi,
  isStop: boolean
) => {
  const { drafts, text } = api;
  const placeholder = placeholderOf(control, api);
  const id = `bar-${section.id}-${field.key}`;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const key = draftKey(section, field);
  const draft = drafts.draftOf(key);
  const refusals = draft?.refusals ?? 0;
  const tags =
    field.type === "text" && !field.disabled
      ? fieldTags(api)(id)
      : NO_FIELD_TAGS;
  const description = [
    field.descriptionId && fieldWords(field.descriptionId, text),
    tags.hint,
  ]
    .filter(Boolean)
    .join(" ");
  const describedBy = [
    description ? descriptionId : "",
    refusals ? errorId : "",
  ]
    .filter(Boolean)
    .join(" ");
  return html`
    <label
      class="bar-field"
      ?data-invalid=${refusals > 0}
      style=${styleProperties({ "--_mq-field-width": `${control.width}px` })}
    >
      ${control.icon ?? nothing}
      ${
        control.label
          ? html`<span aria-hidden="true" class="bar-label">
              ${text(control.label)}
            </span>`
          : nothing
      }
      <input
        aria-activedescendant=${tags.activeDescendant}
        aria-controls=${tags.controls}
        aria-describedby=${describedBy || nothing}
        aria-invalid=${refusals ? "true" : "false"}
        aria-label=${fieldWords(field.labelId, text)}
        autocomplete="off"
        data-action=${`field-${field.key}`}
        data-draft-key=${key}
        ?data-merge-tags=${tags.takesTags}
        data-place=${place(draft ? "settingsDraft" : "barField")}
        ?disabled=${field.disabled ?? false}
        id=${id}
        placeholder=${placeholder ? text(placeholder) : nothing}
        spellcheck="false"
        tabindex=${isStop ? "0" : "-1"}
        type="text"
        .value=${live(draft?.text ?? fieldText(field, section.values))}
        @change=${({ currentTarget }: Event) =>
          drafts.onCommit(
            section,
            field,
            typedIn(currentTarget as HTMLInputElement)
          )}
        @input=${({ currentTarget }: Event) =>
          drafts.onInput(
            section,
            field,
            typedIn(currentTarget as HTMLInputElement)
          )}
      />
      ${
        description
          ? html`<span class="visually-hidden" id=${descriptionId}>
              ${description}
            </span>`
          : nothing
      }
      ${tags.list}
      ${
        refusals
          ? keyed(
              refusals,
              html`<p class="bar-error" id=${errorId} role="alert">
                ${fieldWords(field.invalidMessageId, text)}
              </p>`
            )
          : nothing
      }
    </label>
  `;
};

/** A number of px, with its name before it where the bar shows one. */
const renderNumberControl = (
  section: SettingsSection,
  field: Extract<SettingsField, { type: "number" }>,
  control: Extract<Control, { kind: "number" }>,
  api: PanelApi
) => {
  const { drafts, text } = api;
  const id = `bar-${section.id}-${field.key}`;
  const errorId = `${id}-error`;
  const key = draftKey(section, field);
  const draft = drafts.draftOf(key);
  const refusals = draft?.refusals ?? 0;
  const unit = text(`unit.${field.unit}`);
  const mark = phoneMark(section, field, drafts, text, { id, inBar: true });
  const describedBy = [refusals ? errorId : "", mark.descriptionId]
    .filter(Boolean)
    .join(" ");
  return html`
    ${
      control.label
        ? html`<span aria-hidden="true" class="bar-name">
            ${text(control.label)}
          </span>`
        : nothing
    }
    <label
      class="bar-field number"
      ?data-invalid=${refusals > 0}
      ?data-phone-value=${mark.marked}
      data-tooltip=${mark.tooltip ?? (control.icon ? fieldWords(field.labelId, text) : nothing)}
    >
      ${control.icon ?? nothing}${mark.icon}
      <input
        aria-describedby=${describedBy || nothing}
        aria-invalid=${refusals ? "true" : "false"}
        aria-label=${`${fieldWords(field.labelId, text)} ${text("settings.unit", { unit })}`}
        autocomplete="off"
        data-action=${`field-${field.key}`}
        data-draft-key=${key}
        data-place=${place(draft ? "settingsDraft" : "barField")}
        id=${id}
        max=${field.max ?? nothing}
        min=${field.min}
        step="1"
        tabindex="-1"
        type="number"
        .value=${live(draft?.text ?? fieldText(field, section.values))}
        @change=${({ currentTarget }: Event) =>
          drafts.onCommit(
            section,
            field,
            typedIn(currentTarget as HTMLInputElement)
          )}
        @input=${({ currentTarget }: Event) =>
          drafts.onInput(
            section,
            field,
            typedIn(currentTarget as HTMLInputElement)
          )}
      />
      <span aria-hidden="true" class="unit">${unit}</span>
      ${mark.clear} ${mark.description}
      ${
        refusals
          ? keyed(
              refusals,
              html`<p class="bar-error" id=${errorId} role="alert">
                ${fieldWords(field.invalidMessageId, text, {
                  max: field.max,
                  min: field.min,
                })}
              </p>`
            )
          : nothing
      }
    </label>
  `;
};

/**
 * A switch with its name beside it, and while it's on, what that means. A
 * change that's refused stays shown, with why under it, as what's typed in a
 * field does, and is made once what it was refused for is fixed.
 */
const renderToggleControl = (
  section: SettingsSection,
  field: SettingsField,
  control: Extract<Control, { kind: "toggle" }>,
  api: PanelApi
) => {
  const { drafts, text } = api;
  const id = `bar-${section.id}-${field.key}`;
  const meansId = `${id}-means`;
  const errorId = `${id}-error`;
  const key = draftKey(section, field);
  const draft = drafts.draftOf(key);
  const refusals = draft?.refusals ?? 0;
  const on = fieldText(field, section.values) === "true";
  const means = on && control.whenOn ? text(control.whenOn) : undefined;
  const describedBy = [means ? meansId : "", refusals ? errorId : ""]
    .filter(Boolean)
    .join(" ");
  return html`
    <span class="bar-anchor bar-switch">
      <input
        aria-describedby=${describedBy || nothing}
        aria-invalid=${refusals ? "true" : "false"}
        data-action=${`field-${field.key}`}
        data-draft-key=${key}
        data-place=${draft ? place("barSwitchDraft") : nothing}
        id=${id}
        role="switch"
        tabindex="-1"
        type="checkbox"
        .checked=${live((draft?.text ?? String(on)) === "true")}
        @change=${({ currentTarget }: Event) =>
          drafts.onCommit(section, field, {
            badInput: false,
            text: String((currentTarget as HTMLInputElement).checked),
          })}
      />
      <label for=${id}>${fieldWords(field.labelId, text)}</label>
      ${means ? html`<span class="means" id=${meansId}>${means}</span>` : nothing}
      ${
        refusals
          ? keyed(
              refusals,
              html`<p class="bar-error" id=${errorId} role="alert">
                ${fieldWords(field.invalidMessageId, text)}
              </p>`
            )
          : nothing
      }
    </span>
  `;
};

/**
 * A choice of a few, each a button that's pressed while it's the value, in
 * a group named for the setting. Each is one of the bar's controls.
 */
const renderChoiceControl = (
  section: SettingsSection,
  field: Extract<SettingsField, { type: "select" }>,
  control: Extract<Control, { kind: "choice" }>,
  api: PanelApi
) => {
  const { drafts, text } = api;
  const current = fieldText(field, section.values);
  return html`
    <span
      aria-label=${fieldWords(field.labelId, text)}
      class="segments"
      role="group"
    >
      ${field.options.map(({ labelId, value }) => {
        const label = fieldWords(labelId, text);
        const icon = control.icons?.[String(value)];
        // A short name shown is the button's name, as a person who speaks
        // to their computer says what they see; its tooltip says it in full.
        const shown = icon ?? control.short?.(value) ?? label;
        return html`
          <button
            aria-label=${icon ? label : nothing}
            aria-pressed=${String(value) === current ? "true" : "false"}
            class="segment"
            data-action=${`choice-${field.key}-${value}`}
            data-tooltip=${icon || control.short ? label : nothing}
            tabindex="-1"
            type="button"
            @click=${() =>
              drafts.onCommit(section, field, {
                badInput: false,
                text: String(value),
              })}
          >
            ${shown}
          </button>
        `;
      })}
    </span>
  `;
};

/**
 * A popover from the bar, under its button, or on a phone, a sheet, with a
 * back arrow where it's from More, which is a sheet too.
 */
const renderPopoverBox = (
  api: PanelApi,
  { className, legend }: { className: string; legend: string },
  content: unknown
) => {
  if (!api.phone) {
    return html`
      <div
        aria-label=${legend}
        class=${`ui bar-popover ${className}`}
        data-place=${place("barPopover")}
        role="dialog"
        tabindex="-1"
      >
        ${content}
      </div>
    `;
  }
  const close = () => api.closePopover(true);
  return renderSheet({
    body: content,
    className: `bar-popover ${className}`,
    head: renderSheetHead(
      {
        back: api.bar.popover?.startsWith(IN_MORE) ? close : undefined,
        done: close,
        title: legend,
        titleId: "bar-popover-title",
      },
      api.text
    ),
    labelledBy: "bar-popover-title",
    onClose: close,
    sheetPlace: "barPopover",
  });
};

/** The settings in a popover, under its button, titled `legend`. */
const renderPopover = (
  section: SettingsSection,
  fields: readonly SettingsField[],
  {
    grid = false,
    legend,
    wide = false,
  }: { grid?: boolean; legend: string; wide?: boolean },
  api: PanelApi
) =>
  renderPopoverBox(
    api,
    {
      className: [grid ? "grid" : "", wide ? "wide" : ""]
        .filter(Boolean)
        .join(" "),
      legend,
    },
    renderSettingsPanel(
      { ...section, legend },
      api.drafts,
      fieldTags(api),
      api.text,
      fields
    )
  );

/** The one field a Row's padding is while it's the same on every side. */
const EVERY_SIDE = "paddingEverySide";

/**
 * A Row's padding: one field while it's the same on every side, which sets
 * all four as one step, or a field for each side once "Same on every side" is
 * off. It's on wherever every side is the same, unless the person turned it
 * off; turning it on gives every side Top's value.
 */
const renderPaddingPopover = (
  section: SettingsSection,
  sides: readonly SettingsField[],
  legend: string,
  api: PanelApi
) => {
  const { drafts, text } = api;
  const [top] = sides;
  if (!top) {
    return nothing;
  }
  const texts = sides.map((side) => fieldText(side, section.values));
  // In the Phone view, the sides are one field only while each has a Phone
  // value or none does, so the field's mark holds for all four.
  const set = section.phone?.set;
  const equal =
    texts.every((value) => value === texts[0]) &&
    (set === undefined ||
      sides.every(
        ({ key }) => (set[key] === undefined) === (set[top.key] === undefined)
      ));
  const same = equal && !api.bar.paddingBySide.has(section.targetId);
  const everySide = { ...top, key: EVERY_SIDE, labelId: "bar.everySide" };
  const everySection: SettingsSection = {
    ...section,
    command: (changes) =>
      section.command(
        Object.fromEntries(sides.map(({ key }) => [key, changes[EVERY_SIDE]]))
      ),
    fields: [everySide],
    // In the Phone view, it's every side's Phone value, as one.
    phone: section.phone && {
      desktop: {
        ...section.phone.desktop,
        [EVERY_SIDE]: section.phone.desktop[top.key],
      },
      keys: new Set([...section.phone.keys, EVERY_SIDE]),
      set: { ...section.phone.set, [EVERY_SIDE]: section.phone.set[top.key] },
    },
    values: { ...section.values, [EVERY_SIDE]: section.values[top.key] },
  };
  // A side set on its own keeps the sides apart, so the fields don't change
  // under the person once the sides happen to be the same.
  const bySideSection: SettingsSection = {
    ...section,
    command: (changes) => {
      api.showPaddingBySide(section.targetId, true);
      return section.command(changes);
    },
  };
  const switchId = `bar-${section.id}-padding-same`;
  const onSame = ({ currentTarget }: Event) => {
    const on = (currentTarget as HTMLInputElement).checked;
    // What was typed in a field it hid or hides isn't what the email has.
    drafts.drop(section, sides);
    drafts.drop(everySection, [everySide]);
    api.showPaddingBySide(section.targetId, !on);
    if (on && !equal) {
      drafts.onCommit(everySection, everySide, {
        badInput: false,
        text: texts[0] ?? "",
      });
    }
  };
  // Under the name and above the fields, so it stays where it was pressed
  // as they change.
  const sameSides = html`
    <div class="field same-sides inline">
      <label for=${switchId}>${text("bar.sameOnEverySide")}</label>
      <input
        id=${switchId}
        role="switch"
        type="checkbox"
        .checked=${live(same)}
        @change=${onSame}
      />
    </div>
  `;
  return renderPopoverBox(
    api,
    { className: "grid", legend },
    renderSettingsPanel(
      same ? { ...everySection, legend } : { ...bySideSection, legend },
      drafts,
      fieldTags(api),
      text,
      same ? [everySide] : sides,
      sameSides
    )
  );
};

/**
 * The list field of a popover that adds its first item, while it has none and
 * the popover is closed. Once open, it stays as it is, so removing the last
 * item leaves the popover and its own way to add one.
 */
const emptyListOf = (
  section: SettingsSection,
  control: Extract<NamedControl, { kind: "popover" }>,
  [field]: readonly SettingsField[],
  open: boolean
) =>
  control.addFirst &&
  !open &&
  field?.type === "list" &&
  ((section.values[field.key] as unknown[] | undefined)?.length ?? 0) === 0
    ? field
    : undefined;

/**
 * In place of a list's popover button while it has no items, the way to add
 * the first, in the accent, as frame k03 draws it. It opens the popover with
 * the new item, whose first field takes focus, as the popover's own Add does.
 */
const renderAddFirst = (
  section: SettingsSection,
  control: Extract<NamedControl, { kind: "popover" }>,
  list: Extract<SettingsField, { type: "list" }>,
  api: PanelApi,
  inMore: boolean
) => html`
  <span class="bar-anchor">
    <button
      aria-expanded="false"
      aria-haspopup="dialog"
      class="text-button primary add-first"
      data-action=${control.id}
      tabindex=${inMore ? "0" : "-1"}
      type="button"
      @click=${() => {
        api.togglePopover(control.id);
        api.drafts.changeList(section, list, { type: "add" }, true);
      }}
    >
      ${ICONS.plus}${control.addFirst ? api.text(control.addFirst) : nothing}
    </button>
  </span>
`;

/**
 * A popover's button while it can't open, which stays reachable so its tooltip
 * can say why. It's named by its words where it has them, as a button with
 * words is.
 */
const renderOffPopoverControl = (
  section: SettingsSection,
  control: Extract<NamedControl, { kind: "popover" }> & { offWhy: StringId },
  { inMore, label, name }: { inMore: boolean; label?: string; name: string },
  api: PanelApi
) => {
  const whyId = `bar-${section.id}-${control.id}-off`;
  return html`
    <span class="bar-anchor">
      <button
        aria-describedby=${whyId}
        aria-disabled="true"
        aria-label=${label ? nothing : name}
        class=${label ? "bar-button" : "icon-button"}
        data-action=${control.id}
        data-tooltip=${api.text(control.offWhy)}
        tabindex=${inMore ? "0" : "-1"}
        type="button"
      >
        ${control.icon ?? nothing}${
          label ? html`<span class="words">${label}</span>` : nothing
        }
      </button>
      <span class="visually-hidden" id=${whyId}>
        ${api.text(control.offWhy)}
      </span>
    </span>
  `;
};

const renderPopoverControl = (
  section: SettingsSection,
  control: Extract<NamedControl, { kind: "popover" }>,
  api: PanelApi,
  open: boolean,
  /** In More, where it's a stop for Tab, not one of the bar's controls. */
  inMore = false
) => {
  const fields = section.fields.filter(({ key }) => control.keys.includes(key));
  if (fields.length === 0) {
    return nothing;
  }
  const name = api.text(control.name);
  const label = control.label?.(section.values, api.text);
  // Where its name shows before it, its words are its value.
  let ariaLabel: string | typeof nothing = name;
  if (label) {
    ariaLabel =
      control.lead || inMore
        ? api.text("bar.valueOf", { label: name, value: label })
        : nothing;
  }
  if (control.offWhy) {
    return renderOffPopoverControl(
      section,
      { ...control, offWhy: control.offWhy },
      { inMore, label, name },
      api
    );
  }
  const popoverOf = () =>
    control.id.endsWith("popover-padding")
      ? renderPaddingPopover(section, fields, name, api)
      : renderPopover(
          section,
          fields,
          { grid: control.grid, legend: name, wide: control.wide },
          api
        );
  const empty = emptyListOf(section, control, fields, open);
  if (empty) {
    return renderAddFirst(section, control, empty, api, inMore);
  }
  return html`
    <span class="bar-anchor">
      <button
        aria-expanded=${open ? "true" : "false"}
        aria-haspopup="dialog"
        aria-label=${ariaLabel}
        class=${label ? "bar-button" : "icon-button"}
        data-action=${control.id}
        data-tooltip=${name}
        tabindex=${inMore ? "0" : "-1"}
        type="button"
        @click=${() => api.togglePopover(control.id)}
      >
        ${control.icon ?? nothing}
        ${
          label
            ? html`<span class="words">${label}</span>${
                  control.keys[0] === "links"
                    ? html`<span class="count">
                        ${(section.values.links as unknown[] | undefined)?.length ?? 0}
                      </span>`
                    : nothing
                }${ICONS.chevronDown}`
            : nothing
        }
      </button>
      ${open ? popoverOf() : nothing}
    </span>
  `;
};

/** A color's swatch and its short name, which opens the color's field. */
const renderColorControl = (
  section: SettingsSection,
  field: SettingsField,
  control: Extract<NamedControl, { kind: "color" }>,
  api: PanelApi,
  open: boolean
) => {
  const { text } = api;
  const id = `popover-${field.key}`;
  const name = fieldWords(field.labelId, text);
  // Shown as words, it's the setting's own value, so unset says "None".
  const value = control.showValue
    ? fieldText(field, section.values)
    : shownValue(section, field);
  return html`
    <span class="bar-anchor">
      <button
        aria-expanded=${open ? "true" : "false"}
        aria-haspopup="dialog"
        aria-label=${text("bar.valueOf", {
          label: text(control.label),
          value: value || text("settings.none"),
        })}
        class="bar-button"
        data-action=${id}
        data-tooltip=${control.lead ? text(control.lead) : name}
        tabindex="-1"
        type="button"
        @click=${() => api.togglePopover(id)}
      >
        <span
          class=${value ? "swatch" : "swatch none"}
          style=${styleProperties({ "background-color": value || undefined })}
        ></span>
        <span class=${control.showValue && !value ? "words unset" : "words"}
          >${
            control.showValue
              ? value.toUpperCase() || text("settings.none")
              : text(control.label)
          }</span
        >
      </button>
      ${open ? renderPopover(section, [field], { legend: name }, api) : nothing}
    </span>
  `;
};

/** A layout as its Column widths. */
export const renderThumbnail = (layout: RowLayout) => html`
  <span aria-hidden="true" class="thumbnail">
    ${layout
      .split("/")
      .map(
        (width) =>
          html`<span style=${styleProperties({ "flex-grow": width })}></span>`
      )}
  </span>
`;

/** On a phone, the popover of a Row's layouts. */
const LAYOUT_POPOVER = "popover-layout";

const renderLayoutControl = ({ row }: RowPosition, api: PanelApi) => {
  const { text } = api;
  const current = rowLayoutOf(row);
  const choices = html`
    <span aria-label=${text("bar.columns")} class="segments" role="group">
      ${ROW_LAYOUTS.map(
        (layout) => html`
          <button
            aria-label=${text("bar.layout", { layout })}
            aria-pressed=${layout === current ? "true" : "false"}
            class="segment layout-option"
            data-action=${`layout-${layout}`}
            ?data-start=${api.phone && layout === current}
            data-tooltip=${text("bar.layout", { layout })}
            tabindex=${api.phone ? "0" : "-1"}
            type="button"
            @click=${() => {
              api.setRowLayout(row.id, layout);
              // A sheet's done once a layout's chosen.
              if (api.phone) {
                api.closePopover(true);
              }
            }}
          >
            ${renderThumbnail(layout)}
          </button>
        `
      )}
    </span>
  `;
  if (!api.phone) {
    return html`
      <span aria-hidden="true" class="bar-name">${text("bar.columns")}</span>
      ${choices}
    `;
  }
  // On a phone, the layout it has, which opens the rest as a sheet, as frame
  // p15 draws it.
  const open = api.bar.popover === LAYOUT_POPOVER;
  return html`
    <span class="bar-anchor">
      <button
        aria-expanded=${open ? "true" : "false"}
        aria-haspopup="dialog"
        aria-label=${
          current === undefined
            ? text("bar.columns")
            : text("bar.valueOf", {
                label: text("bar.columns"),
                value: text("bar.layout", { layout: current }),
              })
        }
        class="bar-button"
        data-action=${LAYOUT_POPOVER}
        tabindex="-1"
        type="button"
        @click=${() => api.togglePopover(LAYOUT_POPOVER)}
      >
        ${current === undefined ? nothing : renderThumbnail(current)}<span
          class="words"
          >${text("bar.columns")}</span
        >
      </button>
      ${
        open
          ? renderPopoverBox(
              api,
              { className: "layouts", legend: text("bar.columns") },
              choices
            )
          : nothing
      }
    </span>
  `;
};

/** Upload, or Replace once there's an image, and why the last upload failed. */
const renderUploadControl = ({ block }: BlockPosition, api: PanelApi) => {
  const { text, uploadImage } = api;
  if (!uploadImage) {
    return nothing;
  }
  const error = api.uploadErrorOf(block.id);
  return html`
    <span class="bar-anchor">
      ${renderUpload(
        block.id,
        uploadImage,
        text(
          block.type === "image" && block.props.src !== undefined
            ? "bar.replace"
            : "bar.upload"
        ),
        {
          action: "upload",
          className: "bar-button",
          describedBy: error ? "bar-upload-error" : undefined,
          icon: ICONS.export,
        }
      )}
      ${
        error
          ? html`<p
              class="bar-error"
              data-testid="upload-error"
              id="bar-upload-error"
              role="alert"
            >
              ${error}
            </p>`
          : nothing
      }
    </span>
  `;
};

/**
 * A Video's play button: its name and choice, which opens the choices, each
 * with what it means, as frame k07 draws them. "On the picture" needs the
 * Host app's `uploadImage`, and says so without it, as frame k10 does. While
 * the play button is drawn, it shows as chosen. Why it couldn't be added stays
 * under the button, with a way to upload a thumbnail, as frame k11 draws it.
 */
const renderPlayControl = (
  target: Target,
  section: SettingsSection,
  api: PanelApi,
  open: boolean
) => {
  const field = fieldOf(section, "play");
  if (target.kind !== "block" || field?.type !== "select") {
    return nothing;
  }
  const { block } = target.position;
  const { text, uploadImage, videos } = api;
  const id = "popover-play";
  const name = text("bar.playButton");
  const chosen = videos.isAdding(block.id)
    ? "on"
    : String(section.values.play ?? field.default);
  const choice = field.options.find(({ value }) => value === chosen);
  const words = choice ? fieldWords(choice.labelId, text) : chosen;
  const failure = videos.failureOf(block.id);
  const failureId = `bar-${section.id}-play-failed`;
  const choices = renderPopoverBox(
    api,
    { className: "play-choices", legend: name },
    html`
      <fieldset>
        <legend>${name}</legend>
        ${field.options.map(({ descriptionId, labelId, value }) => {
          const optionId = `bar-play-${value}`;
          // Choosing a copy already drawn uploads nothing.
          const off =
            value === "on" &&
            !uploadImage &&
            section.values.playThumbnail === undefined;
          const meaning = off ? "play.on.noUploads" : descriptionId;
          return html`
            <label
              class=${off ? "play-choice off" : "play-choice"}
              for=${optionId}
            >
              <input
                aria-describedby=${meaning ? `${optionId}-meaning` : nothing}
                ?disabled=${off}
                id=${optionId}
                name="bar-play"
                type="radio"
                .checked=${live(value === chosen)}
                .value=${String(value)}
                @change=${() =>
                  videos.choosePlay(block.id, value as "below" | "none" | "on")}
              />
              <span aria-hidden="true" class="mark">${ICONS.check}</span>
              <span class="words">
                <span>${fieldWords(labelId, text)}</span>
                ${
                  meaning
                    ? html`<span class="meaning" id=${`${optionId}-meaning`}
                        >${fieldWords(meaning, text)}</span
                      >`
                    : nothing
                }
              </span>
            </label>
          `;
        })}
      </fieldset>
    `
  );
  // Its name shows before it, as a Column's settings' do, and is in its own.
  return html`
    <span aria-hidden="true" class="bar-name">${name}</span>
    <span class="bar-anchor play">
      <button
        aria-describedby=${failure ? failureId : nothing}
        aria-expanded=${open ? "true" : "false"}
        aria-haspopup="dialog"
        aria-label=${text("bar.valueOf", { label: name, value: words })}
        class="bar-button"
        data-action=${id}
        data-tooltip=${name}
        tabindex="-1"
        type="button"
        @click=${() => api.togglePopover(id)}
      >
        <span class="words">${words}</span>${ICONS.chevronDown}
      </button>
      ${open ? choices : nothing}
      ${
        failure && !open
          ? html`<div
              class="bar-error play-failed"
              data-testid="play-failed"
              id=${failureId}
              role="alert"
            >
              <b>${text("play.failed")}</b>
              <span>${failure}</span>
              ${
                uploadImage
                  ? renderUpload(
                      block.id,
                      (blockId, file) => {
                        // So the play button is drawn on the new one.
                        videos.wantPlay(blockId);
                        uploadImage(blockId, file);
                      },
                      text("bar.uploadThumbnail"),
                      { className: "text-button" }
                    )
                  : nothing
              }
            </div>`
          : nothing
      }
    </span>
  `;
};

/** A field by its key, if what's selected has it. */
const fieldOf = (section: SettingsSection, key: string) =>
  section.fields.find((field) => field.key === key);

const renderControl = (
  target: Target,
  section: SettingsSection,
  control: NamedControl,
  api: PanelApi,
  isStop: boolean
) => {
  const shown = renderOwnControl(target, section, control, api, isStop);
  return control.lead && shown !== nothing
    ? html`<span aria-hidden="true" class="bar-name"
          >${api.text(control.lead)}</span
        >${shown}`
    : shown;
};

const renderOwnControl = (
  target: Target,
  section: SettingsSection,
  control: NamedControl,
  api: PanelApi,
  isStop: boolean
) => {
  const open = (id: string) => api.bar.popover === id;
  switch (control.kind) {
    case "layout": {
      return target.kind === "row"
        ? renderLayoutControl(target.position, api)
        : nothing;
    }
    case "upload": {
      return target.kind === "block"
        ? renderUploadControl(target.position, api)
        : nothing;
    }
    case "play": {
      return renderPlayControl(target, section, api, open("popover-play"));
    }
    case "popover": {
      return renderPopoverControl(section, control, api, open(control.id));
    }
    default: {
      break;
    }
  }
  const field = fieldOf(section, control.key);
  if (!field) {
    return nothing;
  }
  switch (control.kind) {
    case "text": {
      return renderTextControl(section, field, control, api, isStop);
    }
    case "number": {
      return field.type === "number"
        ? renderNumberControl(section, field, control, api)
        : nothing;
    }
    case "toggle": {
      return renderToggleControl(section, field, control, api);
    }
    case "color": {
      return renderColorControl(
        section,
        field,
        control,
        api,
        open(`popover-${field.key}`)
      );
    }
    default: {
      return field.type === "select"
        ? renderChoiceControl(section, field, control, api)
        : nothing;
    }
  }
};

/** What's selected, and where: the chip, with its menu of what's around it. */
const renderChip = (target: Target, api: PanelApi) => {
  const { text } = api;
  if (target.kind === "email") {
    // On a phone, it opens the email's settings, which its bar has no room
    // for, as frame q01c draws it.
    return api.phone
      ? html`
          <button
            aria-expanded=${api.bar.moreOpen ? "true" : "false"}
            aria-haspopup="dialog"
            class="bar-chip email-chip"
            data-action="more"
            tabindex="0"
            type="button"
            @click=${({ detail }: MouseEvent) => api.toggleMore(detail === 0)}
          >
            <span class="chip-icon">${ICONS.mail}</span
            ><span>${text("bar.email")}</span>${ICONS.chevronDown}
          </button>
        `
      : html`
          <span class="bar-chip">
            <span class="chip-icon">${ICONS.mail}</span>${text("bar.email")}
          </span>
        `;
  }
  const { rowIndex } = target.position;
  const row = text("canvas.row", { row: rowIndex + 1 });
  /** A menu item's click: its menu closes, and from the keyboard, `detail` is 0. */
  const select =
    (then: (fromKeyboard: boolean) => void) =>
    ({ detail }: MouseEvent) => {
      api.closeMenu(false);
      then(detail === 0);
    };
  /**
   * The Columns the menu offers: a Block's own, or a Row's every one, so an
   * empty Column, which has no Block to start from, is reached too.
   */
  const { row: owner } = target.position;
  let offered: readonly Column[] = [];
  if (target.kind === "block") {
    offered = [target.position.column];
  } else if (target.kind === "row") {
    offered = owner.columns;
  }
  const columns = offered.map((each) => ({
    id: each.id,
    name: text("canvas.column", { column: owner.columns.indexOf(each) + 1 }),
  }));
  const menuItem = (
    icon: TemplateResult,
    words: string,
    then: (fromKeyboard: boolean) => void
  ) => html`
    <button role="menuitem" tabindex="-1" type="button" @click=${select(then)}>
      ${icon}<span>${words}</span>
    </button>
  `;
  const chipIcon = () => {
    switch (target.kind) {
      case "block": {
        return BLOCK_VIEWS[target.position.block.type].icon;
      }
      case "column": {
        return ICONS.column;
      }
      default: {
        return ICONS.rows;
      }
    }
  };
  const chipWords = () => {
    switch (target.kind) {
      case "block": {
        return html`<span class="chip-path">${text("bar.path", { row })}</span>
          <span class="chip-name"
            >${blockTypeName(target.position.block.type, text)}</span
          >`;
      }
      case "column": {
        return html`<span class="chip-path">${text("bar.path", { row })}</span>
          <span>
            ${text("canvas.column", {
              column: target.position.columnIndex + 1,
            })}
          </span>`;
      }
      default: {
        return html`<span>${row}</span>`;
      }
    }
  };
  const menuItems = () => html`
    ${
      target.kind === "row"
        ? nothing
        : menuItem(ICONS.rows, row, (fromKeyboard) =>
            api.selectRow(target.position.row.id, fromKeyboard)
          )
    }
    ${columns.map(({ id, name }) =>
      menuItem(ICONS.column, name, (fromKeyboard) =>
        api.selectColumn(id, fromKeyboard)
      )
    )}
    ${menuItem(ICONS.mail, text("bar.email"), (fromKeyboard) =>
      api.selectEmail(fromKeyboard)
    )}
  `;
  /** On a phone, an item of the chip's menu, checked where it's what's selected. */
  const radio = (
    icon: TemplateResult,
    words: string,
    then: ((fromKeyboard: boolean) => void) | undefined
  ) => html`
    <button
      aria-checked=${then ? "false" : "true"}
      role="menuitemradio"
      tabindex="-1"
      type="button"
      @click=${then ? select(then) : () => api.closeMenu(true)}
    >
      ${icon}<span>${words}</span>${then ? nothing : ICONS.check}
    </button>
  `;

  /**
   * On a phone, a sheet, as the bar it would open from scrolls sideways and
   * would cut it off. As frame q02b draws it, it starts at what's selected,
   * marked, and goes out from there: its Column, its Row, the email.
   */
  const renderPhoneChipMenu = () => {
    let current = row;
    if (target.kind === "block") {
      current = blockTypeName(target.position.block.type, text);
    } else if (target.kind === "column") {
      current = text("canvas.column", {
        column: target.position.columnIndex + 1,
      });
    }
    let subtitle: string | undefined;
    if (target.kind === "block") {
      subtitle = text("bar.aroundBlock", { block: current });
    } else if (target.kind === "column") {
      subtitle = text("bar.aroundColumn", { column: current });
    }
    return renderSheet({
      body: html`<div
        aria-label=${text("bar.around")}
        class="bar-menu"
        role="menu"
      >
        ${radio(chipIcon(), current, undefined)}
        ${
          target.kind === "block"
            ? columns.map(({ id, name }) =>
                radio(ICONS.column, name, (fromKeyboard) =>
                  api.selectColumn(id, fromKeyboard)
                )
              )
            : nothing
        }
        ${
          target.kind === "row"
            ? columns.map(({ id, name }) =>
                radio(ICONS.column, name, (fromKeyboard) =>
                  api.selectColumn(id, fromKeyboard)
                )
              )
            : radio(ICONS.rows, row, (fromKeyboard) =>
                api.selectRow(target.position.row.id, fromKeyboard)
              )
        }
        ${radio(ICONS.mail, text("bar.email"), (fromKeyboard) =>
          api.selectEmail(fromKeyboard)
        )}
      </div>`,
      className: "bar-menu-sheet",
      head: renderSheetHead(
        {
          done: () => api.closeMenu(true),
          subtitle,
          title: text("bar.around"),
          titleId: "bar-menu-title",
        },
        text
      ),
      labelledBy: "bar-menu-title",
      onClose: () => api.closeMenu(true),
      sheetPlace: "barMenu",
    });
  };
  const renderChipMenu = () =>
    api.phone
      ? renderPhoneChipMenu()
      : html`<div
          aria-label=${text("bar.around")}
          class="ui bar-menu"
          data-place=${place("barMenu")}
          role="menu"
        >
          ${menuItems()}
        </div>`;
  return html`
    <span class="bar-anchor">
      <button
        aria-expanded=${api.bar.menuOpen ? "true" : "false"}
        aria-haspopup="menu"
        class="bar-chip"
        data-action="chip"
        tabindex="0"
        type="button"
        @click=${() => api.toggleMenu()}
      >
        <span class="chip-icon">${chipIcon()}</span>
        ${chipWords()} ${ICONS.chevronDown}
      </button>
      ${api.bar.menuOpen ? renderChipMenu() : nothing}
    </span>
  `;
};

/** A button with its keys in its tooltip and `aria-keyshortcuts`. */
const renderKeyedButton = (
  {
    action,
    disabled = false,
    icon,
    keys,
    label,
    onClick,
    danger = false,
  }: {
    action: string;
    disabled?: boolean;
    icon: TemplateResult;
    keys?: { keys: string; shortcuts: string };
    label: string;
    onClick: (event: MouseEvent) => void;
    danger?: boolean;
  },
  text: Text
) => html`
  <button
    aria-keyshortcuts=${keys?.shortcuts ?? nothing}
    aria-label=${label}
    class=${danger ? "icon-button danger" : "icon-button"}
    data-action=${action}
    data-tooltip=${keys ? withKeys(label, keys.keys, text) : label}
    ?disabled=${disabled}
    tabindex="-1"
    type="button"
    @click=${onClick}
  >
    ${icon}
  </button>
`;

/**
 * With nothing selected, at the bar's end, the Add button, which opens the
 * Add panel, as `/` does.
 */
const renderAddButton = (api: PanelApi) => {
  const { text } = api;
  const keys = keyLabel("emailBar", "openAddPanel");
  return html`
    <button
      aria-expanded=${api.adding.panel ? "true" : "false"}
      aria-keyshortcuts=${keys.shortcuts}
      class=${api.phone ? "bar-button primary" : "bar-button"}
      data-action="add"
      data-tooltip=${withKeys(text("add.add"), keys.keys, text)}
      tabindex="-1"
      type="button"
      @click=${({ detail }: MouseEvent) => api.openAddPanel(detail === 0)}
    >
      ${ICONS.plus}<span>${text("add.add")}</span
      ><kbd aria-hidden="true">${keys.keys}</kbd>
    </button>
  `;
};

/** The Block's or Row's own actions, and More, at the bar's end. */
const renderActions = (target: Target, api: PanelApi) => {
  const { text } = api;
  const more = html`
    <button
      aria-expanded=${api.bar.moreOpen ? "true" : "false"}
      aria-label=${text("bar.more")}
      class="icon-button"
      data-action="more"
      data-tooltip=${text("bar.more")}
      tabindex="-1"
      type="button"
      @click=${({ detail }: MouseEvent) => api.toggleMore(detail === 0)}
    >
      ${ICONS.more}
    </button>
  `;
  // The email's settings all fit the bar, so it has no More, and on a phone
  // its chip opens them.
  if (target.kind === "email") {
    return renderAddButton(api);
  }
  // On a phone, they're at the top of More, so the bar never scrolls.
  if (api.phone) {
    return more;
  }
  const own = actionsOf(target, api);
  return html`
    <span class="bar-actions">
      ${own.map(({ disabledWhy, ...action }) =>
        renderKeyedButton({ ...action, disabled: Boolean(disabledWhy) }, text)
      )}
    </span>
    ${more}
  `;
};

interface ActionButton {
  action: string;
  danger?: boolean;
  /** Why it can't be done, if it can't. */
  disabledWhy?: string;
  icon: TemplateResult;
  keys?: { keys: string; shortcuts: string };
  label: string;
  onClick: (event: MouseEvent) => void;
}

const BLOCK_MOVES = [
  ["up", "canvas.moveBlockUp"],
  ["down", "canvas.moveBlockDown"],
] as const satisfies readonly [Direction, StringId][];

const ROW_MOVES = [
  ["up", "canvas.moveRowUp"],
  ["down", "canvas.moveRowDown"],
] as const satisfies readonly ["down" | "up", StringId][];

/** The keys for an action where the bar answers them. */
const barKeys = (
  scope: KeyScope,
  action: Action,
  direction?: Direction
): { keys: string; shortcuts: string } =>
  keyLabel(scope, action, { direction });

/**
 * Move up, move down, duplicate and delete, as the Block's and Row's toolbars
 * had them. From the keyboard, a click has a `detail` of 0.
 */
/** Why a Row can't move that way, at the top or the bottom, if it can't. */
const cantMoveRowWhy = (
  rowIndex: number,
  count: number,
  direction: "down" | "up",
  text: Text
) => {
  if (direction === "up") {
    return rowIndex === 0 ? text("more.firstRow") : undefined;
  }
  return rowIndex === count - 1 ? text("more.lastRow") : undefined;
};

const actionsOf = (
  target: Exclude<Target, { kind: "email" }>,
  api: PanelApi
): ActionButton[] => {
  const { text } = api;
  // A Column moves, copies and goes only with its Row.
  if (target.kind === "column") {
    return [];
  }
  if (target.kind === "block") {
    return [
      ...BLOCK_MOVES.map(([direction, label]) => ({
        action: `move-${direction}`,
        icon: ICONS[direction],
        keys: barKeys("blockBar", "moveBlock", direction),
        label: text(label),
        onClick: () => api.moveBlock(direction),
      })),
      {
        action: "duplicate",
        icon: ICONS.duplicate,
        keys: barKeys("blockBar", "duplicateBlock"),
        label: text("canvas.duplicateBlock"),
        onClick: ({ detail }: MouseEvent) => api.duplicateBlock(detail === 0),
      },
      {
        action: "delete",
        danger: true,
        icon: ICONS.delete,
        label: text("canvas.deleteBlock"),
        onClick: ({ detail }: MouseEvent) => api.deleteBlock(detail === 0),
      },
    ];
  }
  const { row, rowIndex } = target.position;
  const count = api.email.rows.length;
  return [
    ...ROW_MOVES.map(([direction, label]) => ({
      action: `move-${direction}`,
      disabledWhy: cantMoveRowWhy(rowIndex, count, direction, text),
      icon: ICONS[direction],
      keys: barKeys("rowBar", "moveRow", direction),
      label: text(label),
      onClick: () => api.moveRow(row.id, direction),
    })),
    {
      action: "duplicate",
      icon: ICONS.duplicate,
      keys: barKeys("rowBar", "duplicateRow"),
      label: text("canvas.duplicateRow"),
      onClick: () => api.duplicateRow(row.id),
    },
    {
      action: "delete",
      danger: true,
      icon: ICONS.delete,
      keys: barKeys("rowBar", "deleteRow"),
      label: text("canvas.deleteRow"),
      onClick: ({ detail }: MouseEvent) => api.deleteRow(row.id, detail === 0),
    },
  ];
};

/** What a screen reader calls the bar: what it's the settings of. */
const nameOf = (target: Target, text: Text) => {
  switch (target.kind) {
    case "block": {
      return blockTypeName(target.position.block.type, text);
    }
    case "column": {
      return text("canvas.column", {
        column: target.position.columnIndex + 1,
      });
    }
    case "row": {
      return text("canvas.row", { row: target.position.rowIndex + 1 });
    }
    default: {
      return text("bar.email");
    }
  }
};

const BAR_PLACE: Record<Target["kind"], Place> = {
  block: "blockBar",
  column: "columnBar",
  email: "emailBar",
  row: "rowBar",
};

/**
 * The Selection bar. One stop for Tab, at its chip, or with nothing selected
 * its first field, and the arrow keys go along its controls. More, where it
 * floats, hangs below it, in the same sticky dock, so it stays in sight as the
 * email scrolls, and isn't one of the bar's controls.
 */
export const renderSelectionBar = (api: PanelApi) => {
  const { text } = api;
  const target = targetOf(api);
  const section = sectionOf(target, api);
  const controls = controlsOf(target, api.phone);
  // Said, as the marks on the Canvas aren't read.
  const showOn =
    target.kind === "row" || target.kind === "block"
      ? (
          (target.kind === "row"
            ? target.position.row.props
            : target.position.block.props) as { showOn?: ShowOn }
        ).showOn
      : undefined;
  return html`
    <div class="bar-dock">
      <div
        aria-describedby=${showOn ? "bar-shown-on" : nothing}
        aria-label=${text("bar.of", { name: nameOf(target, text) })}
        class="ui selection-bar"
        data-place=${place(BAR_PLACE[target.kind])}
        data-testid="selection-bar"
        role="toolbar"
      >
        <div class="bar-content">
          ${
            api.phone && target.kind === "email"
              ? html`${renderChip(target, api)}
                  <span class="bar-hint">${text("canvas.tapBlock")}</span>`
              : html`
                  ${renderChip(target, api)} ${renderSeparator()}
                  ${controls.map((control, index) =>
                    renderControl(
                      target,
                      section,
                      control,
                      api,
                      target.kind === "email" && index === 0
                    )
                  )}
                  ${renderSeparator()}
                `
          }
          ${renderActions(target, api)}
        </div>
        ${
          showOn
            ? html`<span class="visually-hidden" id="bar-shown-on">
                ${text(showOn === "phone" ? "device.phonesOnly" : "device.desktopOnly")}
              </span>`
            : nothing
        }
      </div>
      ${api.bar.moreOpen && !api.bar.docked ? renderMore(api) : nothing}
    </div>
  `;
};

/** One of More's actions: a row with its name, and its keys where it has them. */
const renderMoreAction = ({
  action,
  danger = false,
  disabledWhy,
  icon,
  keys,
  label,
  narrowOnly = false,
  onClick,
}: {
  action: string;
  danger?: boolean;
  /** Why it can't be done, which its tooltip says, as it stays reachable. */
  disabledWhy?: string;
  icon: TemplateResult;
  keys?: { keys: string; shortcuts: string };
  label: string;
  narrowOnly?: boolean;
  onClick: (event: MouseEvent) => void;
}) => html`
  <button
    aria-disabled=${disabledWhy ? "true" : nothing}
    aria-keyshortcuts=${keys?.shortcuts ?? nothing}
    class=${[
      "more-action",
      danger ? "danger" : "",
      narrowOnly ? "narrow-only" : "",
    ]
      .filter(Boolean)
      .join(" ")}
    data-action=${`more-${action}`}
    data-tooltip=${disabledWhy ?? nothing}
    type="button"
    @click=${(event: MouseEvent) => {
      if (!disabledWhy) {
        onClick(event);
      }
    }}
  >
    ${icon}<span>${label}</span
    ><kbd aria-hidden="true">${keys?.keys ?? ""}</kbd>
  </button>
`;

/** On a phone, a short name for each of the bar's actions, as a tile in More. */
const TILE_LABELS: Readonly<Record<string, StringId>> = {
  delete: "more.delete",
  duplicate: "more.duplicate",
  "move-down": "more.moveDown",
  "move-up": "more.moveUp",
};

/**
 * On a phone, the bar's own actions at the top of More, as four tiles, as
 * frame q05a-button-more draws them, as the bar keeps only what it shows.
 */
const renderActionTiles = (
  target: Extract<Target, { kind: "block" | "row" }>,
  api: PanelApi
) => html`
  <div class="more-tiles">
    ${actionsOf(target, api).map(
      ({ action, danger, disabledWhy, icon, keys, label, onClick }) => html`
        <button
          aria-disabled=${disabledWhy ? "true" : nothing}
          aria-keyshortcuts=${keys?.shortcuts ?? nothing}
          class=${danger ? "more-tile danger" : "more-tile"}
          data-action=${`more-${action}`}
          data-tooltip=${disabledWhy ?? nothing}
          type="button"
          @click=${(event: MouseEvent) => {
            if (!disabledWhy) {
              onClick(event);
            }
          }}
        >
          ${icon}<span
            >${TILE_LABELS[action] ? api.text(TILE_LABELS[action]) : label}</span
          >
        </button>
      `
    )}
  </div>
`;

/** Why a Block can't move into the Column that way, if it can't. */
const cantMoveWhy = (
  { columnIndex, row }: BlockPosition,
  direction: "left" | "right",
  text: Text
) => {
  if (row.columns.length === 1) {
    return text("more.onlyColumn");
  }
  if (direction === "left" && columnIndex === 0) {
    return text("more.firstColumn");
  }
  return direction === "right" && columnIndex === row.columns.length - 1
    ? text("more.lastColumn")
    : undefined;
};

const renderMoreActions = (
  target: Exclude<Target, { kind: "email" }>,
  api: PanelApi
) => {
  const { text } = api;
  if (target.kind === "column") {
    const { row, rowIndex } = target.position;
    return html`
      <div class="more-actions">
        <h3>${text("more.actions")}</h3>
        ${renderMoreAction({
          action: "select-row",
          icon: ICONS.rows,
          label: text("more.selectRow", { row: rowIndex + 1 }),
          onClick: ({ detail }) => api.selectRow(row.id, detail === 0),
        })}
      </div>
    `;
  }
  const isBlock = target.kind === "block";
  const scope: KeyScope = isBlock ? "block" : "rowBar";
  return html`
    <div class="more-actions">
      <h3>${text("more.actions")}</h3>
      ${
        api.phone
          ? nothing
          : actionsOf(target, api).map((button) =>
              renderMoreAction({ ...button, narrowOnly: true })
            )
      }
      ${renderMoreAction({
        action: "copy",
        icon: ICONS.duplicate,
        keys: barKeys(scope, isBlock ? "copyBlock" : "copyRow"),
        label: text("more.copy"),
        onClick: () => api.copySelected(),
      })}
      ${renderMoreAction({
        action: "cut",
        icon: ICONS.cut,
        keys: barKeys(scope, isBlock ? "cutBlock" : "cutRow"),
        label: text("more.cut"),
        onClick: () => api.cutSelected(),
      })}
      ${renderMoreAction({
        action: "paste",
        icon: ICONS.down,
        keys: barKeys(scope, isBlock ? "paste" : "pasteAfterRow"),
        label: text("more.paste"),
        onClick: () => api.pasteBelow(),
      })}
      ${
        target.kind === "block"
          ? html`
              ${(
                [
                  ["left", "more.moveLeft"],
                  ["right", "more.moveRight"],
                ] as const
              ).map(([direction, label]) =>
                renderMoreAction({
                  action: `move-${direction}`,
                  disabledWhy: cantMoveWhy(target.position, direction, text),
                  icon: ICONS[direction],
                  keys: barKeys("block", "moveBlock", direction),
                  label: text(label),
                  onClick: () => api.moveBlock(direction),
                })
              )}
              ${renderMoreAction({
                action: "select-row",
                icon: ICONS.rows,
                label: text("more.selectRow", {
                  row: target.position.rowIndex + 1,
                }),
                onClick: ({ detail }) =>
                  api.selectRow(target.position.row.id, detail === 0),
              })}
            `
          : nothing
      }
    </div>
  `;
};

/** What More is titled, and what's under its title. */
const headingOf = (target: Target, text: Text) => {
  switch (target.kind) {
    case "block": {
      const { block, columnIndex, rowIndex } = target.position;
      return {
        subtitle: text("more.blockPlace", columnPlace(rowIndex, columnIndex)),
        title: blockTypeName(block.type, text),
      };
    }
    case "column": {
      const { columnIndex, rowIndex } = target.position;
      return {
        subtitle: text("more.columnOf", { row: rowIndex + 1 }),
        title: text("canvas.column", { column: columnIndex + 1 }),
      };
    }
    case "row": {
      const { row, rowIndex } = target.position;
      const count = row.columns.length;
      return {
        subtitle:
          count === 1
            ? text("more.oneColumn")
            : text("more.columns", { count }),
        title: text("canvas.row", { row: rowIndex + 1 }),
      };
    }
    default: {
      return { subtitle: undefined, title: text("bar.email") };
    }
  }
};

/**
 * Where the Selection bar is short of room for what it shows, it puts its own
 * actions in More, and then, if it's still short, leaves out what a switch
 * that's on means, and then shows its buttons' icons without their words.
 * Measured after each update and as the Canvas changes size, before the page
 * is drawn, so the bar never shows a step on the way.
 */
export const fitSelectionBar = (root: ParentNode) => {
  const bar = [
    findPlace(root, "blockBar"),
    findPlace(root, "rowBar"),
    findPlace(root, "columnBar"),
    findPlace(root, "emailBar"),
  ].find(Boolean);
  const content = bar?.firstElementChild;
  if (!(bar && content instanceof HTMLElement)) {
    return;
  }
  // The room the bar has, as wide as its content can be.
  content.style.setProperty("width", "100%");
  const room = content.getBoundingClientRect().width;
  // Fields shrink to their least, so each step measures what's left at that.
  content.style.setProperty("max-width", "none");
  content.style.setProperty("width", "min-content");
  content.dataset.measuring = "";
  let compact: string | undefined;
  delete bar.dataset.compact;
  for (const step of ["actions", "means", "words"]) {
    if (content.getBoundingClientRect().width <= room) {
      break;
    }
    compact = step;
    bar.dataset.compact = step;
  }
  delete content.dataset.measuring;
  content.style.removeProperty("max-width");
  content.style.removeProperty("width");
  findPlace(root, "morePanel")?.toggleAttribute(
    "data-compact",
    compact !== undefined
  );
  // Focus on an action the bar now leaves to More goes to More's button, so
  // it stays in the editor.
  const focused = (bar.getRootNode() as ShadowRoot).activeElement;
  if (
    focused &&
    bar.contains(focused) &&
    focused.getClientRects().length === 0
  ) {
    bar.querySelector<HTMLElement>('[data-action="more"]')?.focus();
  }
};

/**
 * A Block's Box, in More: padding and its border each from a button that
 * opens their fields, as the bar's settings do, and its background and
 * corners as fields.
 */
/**
 * On a phone, a Column's padding, alignment and border in More, which its bar
 * has no room for, as a Block's Box has them there: padding and border each
 * open their own sheet.
 */
const renderColumnMore = (
  target: Extract<Target, { kind: "column" }>,
  api: PanelApi
) => {
  const { text } = api;
  const section = sectionOf(target, api);
  const opener = (
    control: Extract<NamedControl, { kind: "popover" }>,
    label: string
  ) => html`
    <div class="field inline" data-place=${place("boxOpener")}>
      <span aria-hidden="true" class="box-label">${label}</span>
      ${renderPopoverControl(
        section,
        control,
        api,
        api.bar.popover === control.id,
        true
      )}
    </div>
  `;
  return html`
    <div class="settings box" data-place=${place("settings")}>
      <div class="section">
        <fieldset>
          <legend>${section.legend}</legend>
          ${opener(
            {
              grid: true,
              id: `${IN_MORE}popover-padding`,
              keys: PADDING_KEYS,
              kind: "popover",
              label: (values) => paddingWords(values, 0, text),
              name: "bar.padding",
            },
            text("bar.padding")
          )}
          ${section.fields
            .filter(({ key }) => key === "verticalAlign")
            .map((each) =>
              renderField(section, each, api.drafts, fieldTags(api), text)
            )}
          ${opener(
            {
              id: `${IN_MORE}popover-border`,
              keys: BORDER_KEYS,
              kind: "popover",
              label: (values) => borderWords(values, text),
              name: "bar.border",
            },
            text("bar.border")
          )}
        </fieldset>
      </div>
    </div>
  `;
};

const renderBox = (position: BlockPosition, api: PanelApi) => {
  const { text } = api;
  const section = boxSection(position, api);
  const field = (key: string) =>
    section.fields.filter((each) => each.key === key);
  const opener = (
    control: Extract<NamedControl, { kind: "popover" }>,
    label: string
  ) => html`
    <div class="field inline" data-place=${place("boxOpener")}>
      <span aria-hidden="true" class="box-label">${label}</span>
      ${renderPopoverControl(
        section,
        control,
        api,
        api.bar.popover === control.id,
        true
      )}
    </div>
  `;
  const fallback = Number(field("paddingTop")[0]?.default ?? 0);
  return html`
    <div class="settings box" data-place=${place("settings")}>
      <div class="section">
        <fieldset>
          <legend>${section.legend}</legend>
          ${opener(
            {
              grid: true,
              id: `${IN_MORE}popover-padding`,
              keys: PADDING_KEYS,
              kind: "popover",
              label: (values) => paddingWords(values, fallback, text),
              name: "bar.padding",
            },
            text("bar.padding")
          )}
          ${field("boxBackgroundColor").map((each) =>
            renderField(section, each, api.drafts, fieldTags(api), text)
          )}
          ${opener(
            {
              id: `${IN_MORE}popover-border`,
              keys: BORDER_KEYS,
              kind: "popover",
              label: (values) => borderWords(values, text),
              name: "bar.border",
            },
            text("bar.border")
          )}
          ${field("borderRadius").map((each) =>
            renderField(section, each, api.drafts, fieldTags(api), text)
          )}
          <p class="description box-note">
            ${ICONS.info}${text("more.squareInOutlook")}
          </p>
        </fieldset>
      </div>
    </div>
  `;
};

/** The devices a Block or Row can show on, as More offers them. Unset is all. */
const SHOW_ON_FIELD = {
  default: "",
  invalidMessageId: "invalid.showOn",
  key: "showOn",
  labelId: "more.showOn",
  options: [
    { labelId: "showOn.all", value: "" },
    { labelId: "device.desktopOnly", value: "desktop" },
    { labelId: "device.phonesOnly", value: "phone" },
  ],
  type: "select",
} as const satisfies SettingsField;

/**
 * Where a Block or Row shows, in More: a choice of all devices, desktop only
 * or phones only, each a button that's pressed while it's the choice.
 */
const renderShowOn = (
  target: Extract<Target, { kind: "block" | "row" }>,
  api: PanelApi
) => {
  const { drafts, text } = api;
  const section =
    target.kind === "block"
      ? blockSection(target.position, api)
      : rowSection(target.position, api);
  const current = fieldText(SHOW_ON_FIELD, section.values);
  const legend = text("more.showOn");
  return html`
    <div class="settings show-on" data-place=${place("settings")}>
      <div class="section">
        <fieldset>
          <legend>${legend}</legend>
          <span aria-label=${legend} class="segments" role="group">
            ${SHOW_ON_FIELD.options.map(
              ({ labelId, value }) => html`
                <button
                  aria-pressed=${value === current ? "true" : "false"}
                  class="segment"
                  data-action=${`show-on-${value || "all"}`}
                  type="button"
                  @click=${() =>
                    drafts.onCommit(section, SHOW_ON_FIELD, {
                      badInput: false,
                      text: value,
                    })}
                >
                  ${text(labelId)}
                </button>
              `
            )}
          </span>
        </fieldset>
      </div>
    </div>
  `;
};

/** More where it docks beside the email: a column as tall as the editor. */
export const renderMoreDock = (api: PanelApi) =>
  html`<div class="more-dock">${renderMore(api)}</div>`;

/**
 * More: the settings of what's selected that the bar doesn't show, then its
 * less common actions. It shows whatever is selected while it's open.
 */
const renderMore = (api: PanelApi) => {
  const { text } = api;
  const target = targetOf(api);
  const section = sectionOf(target, api);
  const fields = moreFieldsOf(target, section, api);
  const { subtitle, title } = headingOf(target, text);
  const body = html`
    ${
      api.phone && (target.kind === "block" || target.kind === "row")
        ? renderActionTiles(target, api)
        : nothing
    }
    ${
      api.phone && target.kind === "column"
        ? renderColumnMore(target, api)
        : nothing
    }
    ${
      fields.length > 0 && !(api.phone && target.kind === "column")
        ? renderSettingsPanel(section, api.drafts, fieldTags(api), text, fields)
        : nothing
    }
    ${target.kind === "block" ? renderBox(target.position, api) : nothing}
    ${
      target.kind === "block" || target.kind === "row"
        ? renderShowOn(target, api)
        : nothing
    }
    ${target.kind === "email" ? nothing : renderMoreActions(target, api)}
  `;
  if (api.phone) {
    return renderSheet({
      body: html`<div class="more-body">${body}</div>`,
      className: "more-panel",
      head: renderSheetHead(
        {
          done: () => api.closeMore(true),
          subtitle,
          title,
          titleId: "more-title",
        },
        text
      ),
      labelledBy: "more-title",
      onClose: () => api.closeMore(true),
      sheetPlace: "morePanel",
      testId: "more-panel",
    });
  }
  return html`
    <section
      aria-label=${title}
      class=${api.bar.docked ? "ui more-panel docked" : "ui more-panel floating"}
      data-place=${place("morePanel")}
      data-testid="more-panel"
    >
      <div class="more-head">
        <div>
          <h2 class="more-title">${title}</h2>
          ${subtitle ? html`<p class="more-subtitle">${subtitle}</p>` : nothing}
        </div>
        <button
          aria-label=${text("bar.close")}
          class="icon-button"
          data-action="close-more"
          data-tooltip=${text("bar.close")}
          type="button"
          @click=${() => api.closeMore(true)}
        >
          ${ICONS.close}
        </button>
      </div>
      <div class="more-body thin-scrollbar">${body}</div>
    </section>
  `;
};
