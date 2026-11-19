---
"@mailquilt/editor": patch
---

- While a Block or Row is being dragged, Alt+← and Alt+→ no longer go back or forward a page with focus on a Block, in its text or in a toolbar, as they already didn't there at other times.
- A shortcut acts only with the modifiers it's named with. Before, some also acted with another held, such as Ctrl and ⌘ together on a Mac. Escape, Tab in a toolbar, and Enter on a Block still act with any.
- A key an input method used, such as while typing Japanese, does nothing in the editor anywhere. Before, some places still acted on it. The link field still takes every key.
- On a layout such as Dvorak, Ctrl/⌘ with the key that types `;` no longer undoes because QWERTY has Z there. A shortcut's letter is read from the key's place only on a layout without Latin letters.
