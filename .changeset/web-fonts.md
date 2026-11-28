---
"@mailquilt/core": minor
"@mailquilt/renderer": minor
"@mailquilt/editor": minor
"@mailquilt/react": minor
---

Breaking: web fonts from the Host app's list. `<mail-quilt>` and `<mail-quilt-shell>` take `fonts`, and both React components a `fonts` prop: a list of `{ name, url, fallback }`, where `url` is an `https:` stylesheet that declares the font, such as Google Fonts', and `fallback` is the fonts a reader sees where it doesn't load. Style's Headings and Body lists offer them as "Your fonts", above the system fonts, each with "Falls back to" its first fallback. A font picked is stored in the email, in the settings' new optional `fonts`, as its `name` and `url`, and the email's font names it first, followed by its fallback, as in `'Fraunces', Georgia, serif`. The export loads only the fonts the email uses. The Canvas and the lists draw in each font once it loads, and a setting says when its font is loading, or couldn't be loaded and the email shows its fallback.

What changes for a host:

- The settings gain optional `fonts`, part of format version 4, and the `WebFont` type describes each. Core refuses a `url` that isn't `https:`, or holds a quote, bracket, space or backslash, and two fonts with the same name. After every `updateEmailSettings` and `updateEmailStyle`, it drops a font neither the body nor the heading font names, so picking another font takes its URL out in the same undo step.
- The renderer writes each stored font as an `mj-font`, so the exported HTML links its stylesheet where the email uses it. An email with no `fonts` exports as before.
- The editor adds each font's stylesheet to your page's `<head>`. A Content Security Policy needs `style-src` to allow the stylesheets and `font-src` the font files, such as `https://fonts.googleapis.com` and `https://fonts.gstatic.com`.
- A font in `fonts` whose name, URL or fallback the editor can't use, or whose name an earlier one has, is left out, and said on the console.
- `HostFont`, from `@mailquilt/editor`, is the type of each font in the list, and `HostAppProperties` gains `fonts`.
- No theme token is added or changed.
