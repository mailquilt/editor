// Helpers for Mail Quilt's own packages, as `@mailquilt/core/internal`. They're
// not documented, and not yet a promise to hosts, so they can change in any
// release.
export {
  blockLabel,
  blockSettingsFields,
  blockStyles,
  EMAIL_LOOK,
  linkColor,
  SOCIAL_NETWORKS,
  socialIcons,
} from "./blocks.js";
export { NEW_EMAIL_WIDTH } from "./create-email.js";
export { rowLayoutOf } from "./row-layouts.js";
export { findBlockPosition } from "./operations.js";
export { isAllowedLinkHref, MERGE_TAG } from "./rich-text.js";
export { EMAIL_SETTINGS_FIELDS } from "./email-settings.js";
export { rowSettingsFields, rowStyles } from "./row-settings.js";
export { hexColor } from "./value-schemas.js";
export type { BlockProps } from "./blocks.js";
export type { RowProps } from "./row-settings.js";
export type { SettingsField } from "./settings-fields.js";
export { editorOfLoaded } from "./editor.js";
export { copiedJson, loadCopied } from "./copied.js";
export type { PastedResult, PasteRefusalCode } from "./copied.js";
