---
"@mailquilt/editor": patch
---

On the notice shown when the editor has no room to edit, pressing Preview email gives that button focus, so focus goes back to it when the Preview closes. Before, in Safari and in Firefox on a Mac, where a click doesn't focus a button, closing the Preview left nothing focused.
