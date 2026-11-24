---
"@mailquilt/editor": minor
---

Vue and Svelte apps can type `<mail-quilt>` and `<mail-quilt-shell>` in their templates. Add `/// <reference types="@mailquilt/editor/vue" />`, or `@mailquilt/editor/svelte`, to a `.d.ts` file in the app, and `vue-tsc` or `svelte-check` checks each element's properties, such as `value`, `mq-change` and `mq-error` with their `detail`, and the element a template ref gives you. Both entries hold only types. `vue` and `svelte` are optional peer dependencies of any version, so the entries find the app's own copy even where a package sees only what it depends on, as under pnpm's global virtual store, and an app with neither, or with Vue 2 or Svelte 4, installs as before. Angular needs nothing added: with `strictTemplates`, it already types the events and a template's reference to the element. The Vue, Angular and Svelte examples are now built, type-checked and run against the packed packages.
