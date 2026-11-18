---
"@mailquilt/renderer": patch
---

A URL or email address written as text links correctly in the export. A URL with brackets in it, such as `https://en.wikipedia.org/wiki/Mercury_(planet)`, links whole, and one in brackets still links without the closing bracket. An email address links as `mailto:`, and a URL starting with `www.` or with its scheme in capitals, such as `HTTPS://`, links as other URLs do. A URL or address inside a Merge Tag, such as its default value, stays part of the tag. A word of 19 characters with an `&`, `<` or `>` in it no longer gets break points, and a line break in a link or image address no longer becomes a space.
