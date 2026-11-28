# Move focus after an update in one place

What happens to focus after a change, and what it scrolls into view, is done by the update itself, from what the change named. No editing action waits for the update to finish (#214).

Before, two mechanisms both ran. The update put focus back where it was, or where a change had named, and then five methods of the selection module awaited `updateComplete` and focused, or scrolled, a second time. That was the only reason adding, deleting, moving and dropping Blocks and Rows were `async`, and each `await` was a point where another change could run in between. Selecting what was already selected also told the element the selection had changed, and the link field stayed open only because it took focus in the text before it opened.

## How

- A change names where focus goes, or what to scroll into view, and asks for an update. When the update has rendered, the selection module focuses what was named, or else puts focus back where it was, and then scrolls what was named into view.
- Asking for an update makes sure one runs, so nothing waits to see whether one was due.
- What focus asks for on its way, such as a Block that takes focus scrolling into view once its toolbar shows, waits for the next update, which is the one that renders it.
- Selecting what's already selected, with the Side panel already showing it, changes nothing and tells nobody. Focus moving between a Block and its text asks for an update itself, as the format bar shows only in the text.
- Focus in a Block or its text closes the link field, as a rule of its own rather than through a change of selection.
- Whether focus was on a disabled control is asked with `:disabled`, which holds for any element.

## Alternatives

- **Keep awaiting `updateComplete`, and drop the update's own focus.** When an update removes the element with focus, focus would stop on the floating toolbar on its way to where the change named.
- **Focus straight away, before the update.** What's named, such as a new Block's text, isn't rendered yet.

## Consequences

- A new editing action is synchronous. To move focus or scroll after its change, it names the target, and the update does the rest.
- An update can run where none ran before, such as when a Block that already has focus is selected again. That renders the editor once more, which is quick at email sizes.
- What each key, press and drop does with focus doesn't change.

## Amendment, 2026-11-28

The Side panel is gone ([ADR 0021](./0021-three-modes-and-a-selection-bar.md)), so "with the Side panel already showing it" now means with the Selection bar already showing it. The rule stands: selecting what's already selected changes nothing.
