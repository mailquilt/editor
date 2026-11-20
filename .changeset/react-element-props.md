---
"@mailquilt/react": minor
---

**Breaking:** `MailQuilt` and `MailQuiltShell` take only the props that mean something on their element. Besides their own, those are `aria-*` attributes, React's events such as `onKeyDown`, and `className`, `hidden`, `id`, `inert`, `lang`, `role`, `slot`, `style`, `suppressHydrationWarning` and `title`. Before, they took every prop of an HTML element, such as a form field's `defaultValue`, and `dir`, though the editor is left to right on any page, and `translate`, which React set as a property, so `translate="no"` turned translation on. Those are now type errors.
