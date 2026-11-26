---
"@mailquilt/editor": minor
"@mailquilt/react": minor
---

The editor has a built-in dark theme. Turn it on with `theme`: `light`, the default, `dark`, or `auto`, which follows the person's system. It's an attribute and a property of `<mail-quilt>` and `<mail-quilt-shell>`, which passes it to the editor inside, and a prop of both React components, and the Vue and Svelte types know it. `MailQuiltTheme`, from both packages, is the type of its value. A theme token you set on the element still wins over either theme, so give the dark theme its own accent with `mail-quilt[theme="dark"] { … }`. The email keeps its own colors. Without `theme`, nothing changes. If you set every color token for a dark theme yourself, that still works, and `theme="dark"` can replace it. The theme tokens page lists each token's dark value.
