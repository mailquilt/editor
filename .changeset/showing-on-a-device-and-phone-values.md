---
"@mailquilt/core": minor
"@mailquilt/renderer": minor
"@mailquilt/editor": minor
---

A Block or Row shows on all devices, desktop only or phones only, in its optional `showOn` prop, `"desktop"` or `"phone"`. A Block, Row or Column's optional `phone` prop holds Phone values: padding for each, a font size for Text, Heading and Button, and an Image's width. Any other key in `phone` is refused. Both are part of format version 4.

The renderer writes both as rules in the email's phone media query, under 480px. What only phones show is hidden in the HTML and left out of Outlook on Windows.

In the editor, More has Show on for a Block or Row. In the Phone view, the Canvas draws Phone values and stacks Columns as a phone does, and a font size, padding or Image width changes its Phone value, marked in its field with a way back to the desktop value. What isn't on the device being viewed folds to a strip, and the Shell's More menu can fade or hide it instead.

Breaking: a Row's `hideOnPhone` is gone from format version 4. An email saved by 0.3.0 still opens and exports the same HTML: `hideOnPhone: true` loads as `showOn: "desktop"`, and `false` as neither. Code that writes `hideOnPhone` into a version 4 email has it refused, so write `showOn: "desktop"` instead.

`STRINGS`, `StringId` and `MailQuiltStrings` gain `canvas.notHere`, `canvas.blockShownOn`, `rows.itemShownOn`, `more.showOn`, `showOn.all`, `device.desktopOnly`, `device.phonesOnly`, `phone.title`, `phone.values`, `phone.useDesktop`, `phone.fillsColumn`, `phone.everyDevice`, `invalid.showOn`, `shell.notOnDevice`, `shell.fold`, `shell.foldHelp`, `shell.fade`, `shell.fadeHelp`, `shell.hide` and `shell.hideHelp`, and lose `canvas.hiddenOnPhones`, `field.hideOnPhone` and `field.hideOnPhone.description`, which no release has had. A full translation typed `Record<StringId, string>` needs the new IDs.

The Shell's More menu now always shows, as it holds Not on this device, so `actions=""` shows More alone. With `save-key`, the Shell keeps that choice in `localStorage` under `mail-quilt:not-on-device`. Without one, it stores nothing.
