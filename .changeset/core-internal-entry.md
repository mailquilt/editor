---
"@mailquilt/core": minor
---

**Breaking:** the helpers Mail Quilt's own packages share have moved from `@mailquilt/core` to `@mailquilt/core/internal`, so the main entry exports only what the docs describe. If you imported any of them from `@mailquilt/core`, import them from `@mailquilt/core/internal` instead. They're undocumented, and can still change in any release.

The helpers that moved are `blockLabel`, `blockSettingsFields`, `blockStyles`, `EMAIL_LOOK`, `EMAIL_SETTINGS_FIELDS`, `findBlockPosition`, `hexColor`, `INVALID_LINK`, `isAllowedLinkHref`, `MERGE_TAG`, `ROW_SETTINGS_FIELDS`, `rowLayoutOf`, `rowStyles` and the `SettingsField` type.
