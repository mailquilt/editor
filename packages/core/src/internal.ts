// Helpers for Mail Quilt's own packages, as `@mailquilt/core/internal`. They're
// not documented, and not yet a promise to hosts, so they can change in any
// release.
export {
  blockBoxFields,
  blockBoxStyles,
  blockLabel,
  blockPaddingCss,
  blockSettingsFields,
  blockStyles,
  EMAIL_LOOK,
  linkColor,
  phoneValueKeys,
  SOCIAL_NETWORKS,
  socialIcons,
} from "./blocks.js";
export { isHiddenOn, onPhone, SHOW_ON } from "./device-settings.js";
export type { ShowOn } from "./device-settings.js";
export { NEW_EMAIL_WIDTH } from "./create-email.js";
export { rowLayoutOf } from "./row-layouts.js";
export { findBlockPosition } from "./operations.js";
export { isAllowedLinkHref, MERGE_TAG } from "./rich-text.js";
export { EMAIL_SETTINGS_FIELDS } from "./email-settings.js";
export { rowSettingsFields, rowStyles } from "./row-settings.js";
export { COLUMN_SETTINGS_FIELDS, columnStyles } from "./column-settings.js";
export type { ColumnProps } from "./column-settings.js";
export { hexColor } from "./value-schemas.js";
export type { BlockProps } from "./blocks.js";
export type { RowProps } from "./row-settings.js";
export type { SettingsField } from "./settings-fields.js";
export { editorOfLoaded } from "./editor.js";
export { copiedJson, loadCopied } from "./copied.js";
export type { PastedResult, PasteRefusalCode } from "./copied.js";
// What the build turns into the format's JSON Schema.
export { DOCUMENT_VERSION } from "./document.js";
export { documentSchema } from "./load-document.js";
