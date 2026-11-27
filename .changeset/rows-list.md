---
"@mailquilt/editor": minor
---

Breaking: the Rows list sits before the email in Edit. It shows each Row as a small picture, or collapsed, as its number. A click or Enter selects a Row, scrolls the email to it and shows its settings in the Selection bar. Dragging a Row's picture moves it, and so do Alt+↑ and Alt+↓. Each move is one step for undo, and it's announced. The list's + adds an empty Row with the layout picked, below the current Row. An email with no Rows says "Start with a Row" on the email, with the layouts.

What changes for a host:

- The list takes room at the editor's start: 232px expanded, 52px collapsed. Until the person expands or collapses it, it's expanded where the editor is at least the email's width plus 632px, 1232px for the usual 600px email, and collapsed below. More docks from 1232px with the list expanded, 1052px with it collapsed, or 1288px with the Add panel docked, which takes the list's place. More docked from 1000px before.
- The list comes before the email for Tab: its collapse button, its Rows as one stop, then its +. A test of your own that tabbed from the top bar straight to a Block now passes these three first.
- The list's current Row has `aria-current="true"`, as the selected Block or Row does on the email, and the expanded list has a level-2 heading, "Rows". A test that found `[aria-current="true"]` or a level-2 heading anywhere in the editor now finds two. Look inside the email, or use the Shell's `heading` part.
- `/` on the list's Rows opens the Add panel, so it no longer reaches your page from there.
- `STRINGS`, `StringId` and `MailQuiltStrings` gain `rows.list`, `rows.item`, `rows.noBlocks`, `rows.moveKeys`, `rows.collapse`, `rows.expand`, `rows.add`, `rows.emptyRow`, `rows.addsBelow`, `rows.addsAtEnd`, `rows.none`, `rows.noneHint`, `canvas.startTitle` and `canvas.startText`. Measured with `tsc`:
  - Still compiles: a partial translation typed `MailQuiltStrings`, and a full one spread from `STRINGS`.
  - Stops compiling: a full translation typed `Record<StringId, string>` and written out ID by ID. Add the new IDs to it.
- No theme token is added or changed.
