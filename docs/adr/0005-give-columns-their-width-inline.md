# Give Columns their desktop width inline

When Columns share a Row, the renderer gives each one its desktop width inline, as a `max-width` in pixels, and a phone media query lifts it so the Columns still stack on phones. MJML gives a Column its desktop width only through a class inside `@media only screen and (min-width:480px)`, with `width:100%` inline. GMX, Web.de, T-Online and Libero drop that media query, so their readers saw every multi-column Row stacked, on a desktop too (#92, Email on Acid test `6afaa47b5be29c84f6fe8e90`).

## How

- `to-mjml.ts` marks each Column that shares its Row with `css-class="mq-column"`, and adds one `<mj-style>`: below 480px, `.mq-column { max-width:100% !important; }`. An email with no such Row gets neither, so its HTML doesn't change.
- After MJML renders, `limitColumnWidths` adds `max-width:<px>` after the `width:100%` of each marked Column. It reads the percentage from MJML's own class, such as `mj-column-per-33-33`, and takes it of the email's width, rounded down to the hundredth of a pixel. Rounding down keeps the Columns from adding up to more than the email, which would wrap the last one.
- Outlook for Windows is unchanged. It uses MJML's conditional tables, which already have pixel widths.
- A Row with padding takes it off first: each Column's pixel width is its share of the email's width less the Row's left and right padding.
- A Row set not to stack on phones puts its Columns in `mj-group` instead. MJML gives grouped Columns their width inline as a percentage, so they stay side by side without a media query, in clients that drop `<style>` too. They don't get `mq-column`.

## Alternatives

- **`mj-group`.** MJML's own way to put widths inline, but its Columns never stack, so 3 and 4 Columns would be cramped on every phone. That's what a Row set not to stack asks for, so such a Row uses it.
- **A `max-width` in percent.** It needs no pixel sum, but in a client with no media queries a phone would get the desktop layout shrunk, rather than Columns wrapping at a readable width.
- **Fab Four widths.** `min-width` in pixels with `width:calc((480px - 100%) * 480)` would also fill a phone in clients that drop `<style>`. In Email on Acid test `6afadc9bcf62b7761e853fc2`, Outlook.com, Outlook for Mac and Web.de in Firefox stacked those Columns on a desktop, where the inline `max-width` keeps them side by side.
- **Documenting the limit.** No code, but GMX and Web.de are Germany's largest webmail clients.

## Consequences

- The renderer changes MJML's HTML after it renders, which until now it didn't. The pattern depends on MJML's class names and attribute order. The saved-HTML tests fail if an MJML update changes them.
- In a client that drops `<style>` on a phone, Columns wrap at their desktop width instead of filling it. A 3-column Row shows one Column per line at a third of the email's width. The Gmail app with a non-Google account is one such client.
- Clients that keep media queries look as they did. Any Column shrinks with a window narrower than the email, as before, since the class's percentage width still applies.
