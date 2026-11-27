# Declare what belongs to the text being edited

Which places belong to the text being edited is declared once, as a trait of the place in `editor-places.ts`, and every check in the selection module reads it (#218).

Before, the format bar and the link field were named in four lists in the selection module: what focus is on, where focus goes back when they close, when the text stops being edited, and which presses in a Block leave the Side panel as it is. A new popup beside the text, such as the Merge Tag picker, would have had to join each list, and one it missed would quietly behave differently, such as closing the format bar when it takes focus.

## How

- A place in `editor-places.ts` can be `ofText`. The format bar and the link field are. `isOfText()` says whether an element is in one.
- Focus in a place that's `ofText` is on the text, so when the place closes, focus goes back to the text, with no mapping after the fact.
- The text goes on being edited while focus is in the text or in a place that's `ofText`. Until 0.4.0 it did in the Preview too, which opened over the text; Check, which replaced it, hides the Canvas, so no text is being edited there (#320).
- A press in a place that's `ofText`, or on the Block's toolbar, leaves the Side panel as it is.
- Whether focus is outside the text asks only for the text itself, as the link field is outside it.

## Alternatives

- **A list of names exported beside the places.** It would be a second declaration to keep in step with the places, which is what the traits beside each place avoid, as `press` already does.
- **One element around everything that belongs to the text.** A popup would have to be rendered inside it, wherever its layout wants it, and the element would exist only to carry a rule about focus.

## Consequences

- A new popup beside the text is one place with `ofText`, and `place()` on its element.
- What focus, selection and the Side panel do doesn't change.
