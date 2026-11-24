---
"@mailquilt/react": minor
---

`@mailquilt/react` works with React 18 as well as 19. Both components take `ref` through `forwardRef`, as React 18 gives a function component no `ref` prop. `className` reaches the element as its `class`, and `hidden={false}` or `inert={false}` leaves the attribute off, where React 18 would write `classname`, or the text "false", which still hides the editor or makes it inert. `MailQuiltProps` and `MailQuiltShellProps` declare `inert` themselves, as React 18's types don't have it.
