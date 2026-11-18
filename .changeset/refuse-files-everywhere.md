---
"@mailquilt/editor": patch
---

A file dragged over the open Preview, its email included, over the narrow notice, or over the Shell's header is refused, as it already was over the rest of the editor, so the browser no longer opens it in place of the page. Safari still opens a file dropped on the email in the Preview. The Preview's email now has the host page's origin, so the editor can refuse a file there. It still runs no scripts.
