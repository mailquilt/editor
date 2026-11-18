// Helpers for Mail Quilt's own packages, as `@mailquilt/core/internal`. They're
// not documented, and not yet a promise to hosts, so they can change in any
// release.
export {
  blockLabel,
  blockSettingsFields,
  blockStyles,
  EMAIL_LOOK,
} from "./blocks.js";
export { rowLayoutOf } from "./row-layouts.js";
export { findBlockPosition } from "./operations.js";
export { INVALID_LINK, isAllowedLinkHref, MERGE_TAG } from "./rich-text.js";
export {
  EMAIL_SETTINGS_FIELDS,
  hexColor,
  ROW_SETTINGS_FIELDS,
  rowStyles,
} from "./settings.js";
export type { BlockProps } from "./blocks.js";
export type { SettingsField } from "./settings.js";
