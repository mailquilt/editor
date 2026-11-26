---
"@mailquilt/editor": minor
---

Breaking: a Row's padding in the Selection bar is one field while every side is the same, with "Same on every side" on. Turning it off, or setting a side on its own, shows a field for each side, even while the sides are the same, until it's turned on again or the editor reloads. Turning it on gives every side the top's value, as one step for undo.

`STRINGS`, `StringId` and `MailQuiltStrings` gain the IDs `bar.everySide` and `bar.sameOnEverySide`. Measured with `tsc`:

- Still compiles: a partial translation typed `MailQuiltStrings`, and a full one spread from `STRINGS`.
- Stops compiling: a full translation typed `Record<StringId, string>` and written out ID by ID. Add the two IDs to it.
