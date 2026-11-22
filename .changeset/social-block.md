---
"@mailquilt/core": minor
"@mailquilt/renderer": minor
"@mailquilt/editor": minor
"@mailquilt/react": minor
---

Breaking: a Social Block, in format version 3, shows linked icons for Facebook, Instagram, LinkedIn, X, YouTube, TikTok, Pinterest, Threads, Bluesky and a website. Its props are `links`, a list of `{ network, url }` in the order the icons show, with each network at most once, `iconStyle`, `"color"` or `"white"`, `iconSize`, 32, 40 or 48, and `align`. Each URL is checked as a link, so it can hold a Merge Tag. A link without a URL stays in the list, faded on the canvas, and is left out of the export, and a Social Block with no URL at all is left out, as an Image without one is. A new Social Block has no links, and the Side panel sets its links, style, size and alignment. There, a person adds a network not yet in the list, types its URL, and moves it up or down or removes it with buttons. Each link's buttons are one toolbar, one stop for Tab with the arrow keys across it, focus stays with a link that moves, and each change is announced.

The export writes the icons with MJML's social element, each one's image given, so nothing loads from Mailjet, with the network's name as its alt text and a gap of half the icon's size. The icons are PNGs in the renderer's `icons` folder, and emails load them from jsDelivr at the renderer's exact version. `renderEmail` takes a `socialIconsUrl` option, and `<mail-quilt>`, `<mail-quilt-shell>` and both React components take a `socialIconsUrl` property, so a Host app can serve the icons from its own storage. The canvas and Preview load the same URLs as the export, and an empty `socialIconsUrl` counts as none. On the canvas, a faded icon's name says it has no URL yet. A Social Block copied into another app gives its linked networks' names. The logos are their owners' trademarks, and `icons/NOTICE.md` credits each source and its licence.
