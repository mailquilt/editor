---
"@mailquilt/editor": minor
"@mailquilt/react": minor
---

Starter emails. `<mail-quilt>` and `<mail-quilt-shell>` take `starterEmails`, and both React components a `starterEmails` prop: a list of `{ name, description, email }`. While the email has no Rows and the person hasn't started it, a start screen in Edit offers Blank and then each one as a card with a picture of its top. Picking one makes the email a copy of it, settings and Rows with new IDs, in one undo step, with one `mq-change`, and says "Started from" its name. Blank shows the empty email, with focus on its first layout. Once the email has had a Row, or Blank is picked, the start screen doesn't come back until a new `value` is set.

What changes for a host:

- Each `email` is checked as `value` is, and brought up to date from an older version. One the editor can't open, or with no `name`, isn't offered, and the console says why.
- A Starter email's Row whose Column widths aren't a layout's gets even Columns, as a pasted Row does.
- `createEmail()` gives an email with one Row, so the start screen needs one with `rows: []`.
- `StarterEmail`, from `@mailquilt/editor` and `@mailquilt/react`, is the type of each, and `HostAppProperties` gains `starterEmails`.
- `STRINGS`, `StringId` and `MailQuiltStrings` gain `start.title`, `start.text`, `start.blank`, `start.blankText` and `said.started`. A full translation typed `Record<StringId, string>` stops compiling until it adds them; a partial one typed `MailQuiltStrings`, or one spread from `STRINGS`, still compiles.
- No theme token is added or changed.
