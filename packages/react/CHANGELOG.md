# @mailquilt/react

## 0.1.0

### Minor Changes

- 72b0977: First release of the React components.
  
  - `<MailQuilt>` and `<MailQuiltShell>` wrap the editor, with `value`, `onChange` and `onError`.
  - `className`, `style`, `id` and `aria-*` pass through to the element.
  - Works in Next.js, including Server Components, which render an empty element that the editor fills in the browser.

### Patch Changes

- Updated dependencies [72b0977]
  - @mailquilt/editor@0.1.0
