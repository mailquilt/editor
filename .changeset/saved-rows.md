---
"@mailquilt/editor": minor
"@mailquilt/react": minor
---

Saved Rows. `<mail-quilt>` and `<mail-quilt-shell>` take `savedRows`, and both React components a `savedRows` prop: a list of `{ name, row, version }`, such as your footer. Adding a Row offers them after the empty layouts, in the Rows list's +, the Add panel and the phone's Add sheet, each as a card with a picture of its top and its name. Picking one adds a copy, with new IDs, where an empty Row would go, in one undo step, with one `mq-change`, selects it and says "Footer added, position 2 of 3." In the Add panel, one can also be dragged onto the email, between two Rows, and the search finds one by its name.

What changes for a host:

- Each `row` is checked as a paste is, and brought up to date from its `version`. One the editor can't take, with no `version`, or with no `name`, isn't offered, and the console says why.
- A Saved Row whose Column widths aren't a layout's gets even Columns, as a pasted Row does.
- `SavedRow`, from `@mailquilt/editor` and `@mailquilt/react`, is the type of each, and `HostAppProperties` gains `savedRows`. An object typed `HostAppProperties` still compiles.
- The Rows list's + opens its popover level with the +, moved up as far as it needs to fit, and it scrolls where the window is too short. On the collapsed list it used to open upwards from the +.
- No theme token is added or changed.
