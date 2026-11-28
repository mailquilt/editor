---
"@mailquilt/core": patch
---

Small fixes on rare input. A Row's Phone values or a Menu link given as a list are refused instead of loading as `{}`, and a Command whose `props`, `settings` or `style` is a Date or a Map is refused as `invalidCommand` rather than "unchanged". A copy from a newer version that adds a field of its own, or a Row copied as `null`, is named for what it is. A version 3 Row with both `hideOnPhone: true` and its own `showOn` keeps that `showOn`. Clearing a Video's thumbnail when it has none no longer changes its play button, and a decorative Image given a link is refused as decorative. `blockLabel`, `SHOW_ON` and `PastedResult` are no longer exported from `@mailquilt/core/internal`.
