---
"@mailquilt/editor": minor
---

A Row's padding in the Selection bar is one field while every side is the same, with "Same on every side" on. Turning it off, or setting a side on its own, shows a field for each side, even while the sides are the same, until the editor reloads. Turning it on again gives every side the top's value, as one step for undo. The editor's `strings` gain `bar.everySide` and `bar.sameOnEverySide`.
