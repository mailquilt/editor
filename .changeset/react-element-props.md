---
"@mailquilt/react": minor
---

**Breaking:** `MailQuilt` and `MailQuiltShell` take only the props that mean something on their element. Besides their own, those are `aria-*` attributes, React's events such as `onKeyDown`, and `className`, `hidden`, `id`, `inert`, `lang`, `role`, `slot`, `style`, `suppressHydrationWarning`, `title` and `translate`. Before, they took every prop of an HTML element, such as a form field's `defaultValue`, and `dir`, though the editor is left to right on any page. Those are now type errors.
