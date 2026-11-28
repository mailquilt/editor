---
"@mailquilt/react": patch
---

`HostFont`, the type of one of `fonts`, is now exported from `@mailquilt/react` as well, like `SavedRow` and `StarterEmail`. On a React 18 server, in development, the components no longer log React's "useLayoutEffect does nothing on the server" warning. The rendered empty element is the same.
