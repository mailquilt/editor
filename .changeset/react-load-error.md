---
"@mailquilt/react": patch
---

When the editor's code can't load, such as when its file fails to download, `onError` is called with the reason, starting "The editor couldn't load:". Before, the component stayed empty and nothing was called. Without `onError`, the failure is an unhandled rejection, as before, and only one under StrictMode, which mounts the component twice. A component removed before its load fails reports nothing, with or without `onError`.
