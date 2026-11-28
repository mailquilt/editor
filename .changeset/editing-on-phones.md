---
"@mailquilt/editor": minor
---

Breaking: the editor works on phones. Below 640 pixels wide, such as on a phone or at 400% zoom, it's laid out for one instead of showing a notice: the email takes the width, in the Phone view until someone picks Desktop, and the Selection bar is docked at the bottom. The Add panel, More, the Selection bar's popovers, Style's popovers and the link field open as sheets from the bottom of the window, as modal dialogs that keep focus until Done, Escape or a press on the dimmed email closes them. The top bar keeps Undo and the Modes, and its ⋯ menu has Redo, the view, the Rows list, with buttons to move each Row, and in the Shell, its name and status, how what's not on this device shows, Export and Import. Style's panel and Check's Problems are at the bottom, under the email. So the editor now meets WCAG 2.2 AA, 1.4.10 Reflow included.

What changes for a host:

- Below 640 pixels, the editor is at least 600 pixels tall, as on a laptop, where it was only as tall as its top bar and the notice. Give it a height that fits the window, or let your page scroll with no scrolling box of its own around it, so the Selection bar at its bottom stays in sight.
- A sheet opens over your whole page, as any modal dialog does, and your page is inert while it's open.
- Two theme tokens are new: `--mq-color-scrim`, what dims the page behind a sheet, and `--mq-radius-large`, the corners of the sheets and the Selection bar on a phone.
