---
"@mailquilt/editor": minor
---

Breaking: the Style Mode sets the email's Email style. Beside the email, its panel has the page and email colors, the text, Button and link colors, the Headings and body fonts, the sizes of Heading 1 to 3 and body text, and Button corners. The email changes as each is set, each change is one step for undo, and each Email style value can be cleared back to the built-in look. Hovering or focusing a setting marks on the email what it changes, and what keeps its own value. A Block selected there says each value it keeps as its own, with a button to make it match the rest and one to give every Block like it the same value. The Canvas now draws the Email style as the export does.

What changes for a host:

- The email's background and font have left the Selection bar's More, with nothing selected, for Style's Page and Body. With nothing selected the bar has no More, and More closes when nothing is selected. A test of your own that set them in More now opens Style.
- Style is off while the email has no Rows, as before, so an empty email's page color and font are set once it has a Row.
- In Edit, a Block's color, size or Button fill that it doesn't set shows the value the Canvas draws, Email style's or else the built-in one, and a Row's unset background shows the email's color.
- In Style the email is shown beside a 320px panel, which docks where the editor is at least the email's width plus 400px, 1000px for the usual email, and otherwise opens over the workspace's end. The email there is `inert`, so a test that found a Block by its role while Style shows finds none.
- `STRINGS`, `StringId` and `MailQuiltStrings` gain `style.title`, `style.lead`, `style.colors`, `style.page`, `style.email`, `style.text`, `style.buttons`, `style.links`, `style.type`, `style.headings`, `style.body`, `style.heading1`, `style.heading2`, `style.heading3`, `style.bodyText`, `style.corners`, `style.square`, `style.rounded`, `style.pill`, `style.default`, `style.sameAsPage`, `style.sameAsText`, `style.sameAsBody`, `style.bodyFont`, `style.useDefault`, `style.pixels`, `style.size`, `style.defaultIs`, `style.hex`, `style.inThisEmail`, `style.shade`, `style.shadeValue`, `style.hue`, `style.searchFonts`, `style.systemFonts`, `style.noFont`, `style.reaches`, `style.keepsOwn`, and the `style.own.` texts for a Block's own values. A full translation typed `Record<StringId, string>` stops compiling until it adds them; a partial one typed `MailQuiltStrings`, or one spread from `STRINGS`, still compiles.
- No theme token is added or changed.
