---
"@mailquilt/editor": patch
---

The email is one stop for Tab, so a Block's or a Row's settings can be reached from the keyboard. Before, every Block and its text was a stop, and Tab selected each Block it passed, so the side panel showed the email's last Block by the time Tab got there, and a Row's settings couldn't be reached at all. Now only the selected Block is a stop, or with nothing selected the first, and the arrow keys go to the others as before. Tab goes from the selected Block to its text and toolbar, then past the toolbars of the Rows and empty Columns after it, to Preview and that Block's settings. While a Row is selected no Block is a stop, so Tab from Select Row goes the same way to the Row's settings, and Escape in a Row's toolbar unselects the Row and selects that toolbar's Row's first Block.
