---
"@mailquilt/core": minor
---

**Breaking:** a saved email no longer loads if it holds a link or image URL that starts with `httpſ:` in place of `https:`, or a color with anything but a plain space after a comma, such as `rgb(0,\n0,0)` or a no-break space. Neither is a link or a color the docs describe. The same values, and a new language code with `ſ` or the Kelvin sign `K` in place of s or k, are refused when set. A saved language still loads whatever it is.
