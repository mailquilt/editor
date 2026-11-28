---
"@mailquilt/editor": minor
---

Keyboard and screen reader fixes:

- With a Row selected, the Selection bar's Move Row up on the first Row and Move Row down on the last are off with `aria-disabled` instead of `disabled`, so the arrow keys still reach them, and their tooltip and description say why, as More's copies of them do. A Move Row button that becomes off as the Row reaches the end keeps focus.
- With a Column selected, no Block is a stop for Tab, as with a Row selected, so Shift+Tab from the Selection bar no longer selects the email's first Block.
- In the Shell, Down or Up on the button of a menu that's open goes to its first or last item, instead of closing it.
- A paste with nothing in it the editor can use, such as only spaces, is refused and announced, from the keyboard and the browser's Edit menu as from More's Paste below, which now says "Can't paste. Nothing in what's copied can go in the email." rather than that it isn't a Block or a Row.
- A refused switch in More, such as Decorative on a phone, is marked `aria-invalid`, as the bar's switches and every field are.
- The font lists group their fonts as "Your fonts" and "System fonts" for screen readers too, as a web font and a system font can have the same name.
- The keyboard page says that a Column selected pastes nothing, and that a Block moved into a Row the view folds or hides leaves what the email shows.

Breaking: `STRINGS`, `StringId` and `MailQuiltStrings` gain `paste.nothing`, as with any new text:

- Still compiles: a partial translation typed `MailQuiltStrings`, and a full one spread from `STRINGS`.
- Stops compiling: a full translation typed `Record<StringId, string>` and written out ID by ID. Add the new ID to it.
