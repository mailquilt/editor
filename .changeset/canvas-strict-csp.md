---
"@mailquilt/editor": patch
---

The editor works on a page whose Content Security Policy has no `'unsafe-inline'` in `style-src`, such as `style-src 'self'`. The canvas shows the email's width, background and font, and each Row's, Column's and Block's settings, where before it lost them. Only Preview still needs `'unsafe-inline'`, because the email relies on inline styles.
