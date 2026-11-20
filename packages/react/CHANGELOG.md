# @mailquilt/react

## 0.2.0

### Minor Changes

- 7c1e04c: A link or image URL that starts with `httpſ:` in place of `https:`, or a color with anything but a plain space after a comma, such as `rgb(0,\n0,0)` or a no-break space, is refused when set. Neither is a link or a color the docs describe. The same goes for a new language code with `ſ` or the Kelvin sign `K` in place of s or k. A saved language still loads whatever it is.
  
  An email saved with 0.1.0 that holds one of these still opens. **Breaking:** emails are now saved as version 2 of the format, and a version 1 email is upgraded as it loads: such a color gets a plain space after each comma, and such a URL starts with `https:`. Mail Quilt 0.1.0 refuses a version 2 email as newer, so update every package that reads your emails, such as a renderer on your server, at the same time.
- 83b7114: **Breaking:** `MailQuilt` and `MailQuiltShell` take only the props that mean something on their element. Besides their own, those are `aria-*` attributes, React's events such as `onKeyDown`, and `className`, `hidden`, `id`, `inert`, `lang`, `role`, `slot`, `style`, `suppressHydrationWarning` and `title`. Before, they took every prop of an HTML element, such as a form field's `defaultValue`, and `dir`, though the editor is left to right on any page, and `translate`, which React set as a property, so `translate="no"` turned translation on. Those are now type errors.

### Patch Changes

- 739ee11: When the editor's code can't load, such as when its file fails to download, `onError` is called with the reason, starting "The editor couldn't load:". Before, the component stayed empty and nothing was called. Without `onError`, the failure is an unhandled rejection, as before, and only one under StrictMode, which mounts the component twice. A component removed before its load fails reports nothing, with or without `onError`.
- Updated dependencies [4154f21]
- Updated dependencies [f4c0806]
- Updated dependencies [7c1e04c]
- Updated dependencies [3eb84b6]
- Updated dependencies [146b517]
- Updated dependencies [07ac505]
- Updated dependencies [362d8c5]
- Updated dependencies [18a5e61]
- Updated dependencies [7c1e04c]
- Updated dependencies [87a4e62]
- Updated dependencies [5cbbfdc]
- Updated dependencies [27d37bf]
- Updated dependencies [27d37bf]
- Updated dependencies [2ed9203]
- Updated dependencies [4d6cd17]
- Updated dependencies [91086d5]
- Updated dependencies [5bf5d47]
- Updated dependencies [38882f8]
- Updated dependencies [5911f8e]
- Updated dependencies [e878b73]
- Updated dependencies [593d67f]
- Updated dependencies [abea3ec]
- Updated dependencies [5533e5a]
  - @mailquilt/editor@0.2.0

## 0.1.0

### Minor Changes

- 72b0977: First release of the React components.
  
  - `<MailQuilt>` and `<MailQuiltShell>` wrap the editor, with `value`, `onChange` and `onError`.
  - `className`, `style`, `id` and `aria-*` pass through to the element.
  - Works in Next.js, including Server Components, which render an empty element that the editor fills in the browser.

### Patch Changes

- Updated dependencies [72b0977]
  - @mailquilt/editor@0.1.0
