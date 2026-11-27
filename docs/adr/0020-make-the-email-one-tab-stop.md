# Make the email one Tab stop

Of the email's Blocks, only one is a stop for Tab: the selected Block, or with nothing selected the first. Its text is a stop only while it's selected. The arrow keys reach the other Blocks, as they already did. With a Row selected, no Block is a stop, and Escape in a Row's toolbar goes back to the Blocks.

Until now every Block and every Block's text was a stop, and focus on either selects its Block. So Tab from the selected Block's toolbar selected the next Block, and each Tab after that selected another. The side panel shows what's selected, so by the time Tab reached it, it showed the email's last Block. From the keyboard, the only Block whose settings could be changed was the last one, and a Row's settings couldn't be reached at all: Tab from Select Row went into the Row's first Block and selected it. In an email of 8 Rows, Tab took 71 presses to get from the first Block to the side panel. The hand check before `0.3.0` found this. Every 0.3 setting is in the side panel: Row padding and phone settings, the Social Block's links, Upload image and the Merge Tag list in a field.

## How

- `renderRows` names the one Block that's a stop, and every other Block gets `tabindex="-1"`. With a Row selected, none is.
- Each Block's text sets its own `tabIndex`, outside ProseMirror's attributes, as nothing updates a Block's view when another Block is selected. The element sets it on every update, as it sets the email's language.
- The Row toolbars and an empty Column's toolbar stay stops. Focus on them selects nothing, and a Row of empty Columns has no Block for the arrow keys to reach.
- In a Row's toolbar while a Row is selected, Escape focuses the first Block of that toolbar's Row, which selects it. With no Block in the Row, it selects nothing. With no Row selected, Escape still reaches the host page.

## Alternatives

- **A Settings button in the Block's and Row's toolbars**, moving focus to the side panel. It would add a way to the settings, but Tab would still select each Block on its way through the email.
- **Only the selected Row's toolbar as a stop.** Fewer stops, but a Row of empty Columns would have no way in from the keyboard.
- **No Tab stop in the text.** Enter already goes into it, but the keyboard page says Tab does too, and a screen reader's forms mode expects to Tab to a text box.

## Consequences

- From the selected Block, Tab reaches the Selection bar after its text and any empty Column's toolbar after it, as the Block and Row toolbars are gone ([ADR 0021](./0021-three-modes-and-a-selection-bar.md)). The bar is one stop, with arrow keys between its controls, and its settings are there, so Tab's path through the email ends at the bar, then the button that opens Check. Until 0.4.0 it ended at the side panel's settings, after the Block's toolbar, the later Rows' toolbars and Preview.
- With a Row selected, the Blocks need Escape, or a click, to reach. Escape in the Selection bar does that, as it did in a Row's toolbar.
- A Row is selected by its tag, or from the keyboard by the bar's chip, whose menu names the Row and the email. A Row of empty Columns has no Block to start from, so its Columns' toolbars stay stops, and focus in one selects that Row, which "Focus on them selects nothing" above no longer says of them.
