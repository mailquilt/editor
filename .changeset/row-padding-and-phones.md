---
"@mailquilt/core": minor
"@mailquilt/renderer": minor
"@mailquilt/editor": minor
---

Breaking: a Row has padding on each side, can be hidden on phones, and can keep its Columns side by side on phones. Its props in format version 3 can hold `paddingTop`, `paddingRight`, `paddingBottom` and `paddingLeft`, whole pixels from 0 to 200 that default to 0, `hideOnPhone`, which defaults to `false`, and `stackOnPhone`, which defaults to `true`. An email without them exports as before. The export gives the Row its padding, and each Column's desktop width is its share of the email's width less the Row's left and right padding. A Row hidden on phones is hidden on screens under 480px wide, though a client that drops the email's styles on a phone, such as the Gmail app with an account that isn't Google's, still shows it. A Row that doesn't stack puts its Columns in MJML's `mj-group`, with their widths inline, so they stay side by side in every client. The Row's settings get the four paddings and a switch for each choice, with Stack Columns on phones only for a Row with more than one Column. The canvas shows the padding, and a Row hidden on phones has a "Hidden on phones" mark in its toolbar.
