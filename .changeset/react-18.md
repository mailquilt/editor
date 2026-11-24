---
"@mailquilt/react": minor
---

Breaking: `MailQuilt` and `MailQuiltShell` are now made with `forwardRef`, so `@mailquilt/react` works with React 18 as well as 19. React 18 gives a function component no `ref` prop.

What changes for an app:

- JSX, `ref`, `createElement(MailQuilt, props)`, `ComponentProps<typeof MailQuilt>`, `ComponentType<MailQuiltProps>` and `FC<MailQuiltProps>` work as before.
- Calling a component as a function, such as `MailQuilt(props)`, now throws "MailQuilt is not a function". TypeScript doesn't catch it. Render it with JSX or `createElement` instead.
- A variable typed as a plain function, such as `(props: MailQuiltProps) => ReactElement`, no longer accepts a component. Type it as `ComponentType<MailQuiltProps>`.
- With React 19, the element's HTML is the same as before.

What React 18 apps get, besides `ref`: `className` reaches the element as its `class`, and `hidden={false}` or `inert={false}` leaves the attribute off. Before, React 18 would write a `classname` attribute, or the text "false", which still hides the editor or makes it inert. `MailQuiltProps` and `MailQuiltShellProps` declare `inert` themselves, as React 18's types don't have it.
