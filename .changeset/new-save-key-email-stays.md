---
"@mailquilt/editor": patch
---

When the Shell's `save-key` changes and a saved email opens under the new key, a host that sets its starting email again, as React does when it renders again, no longer replaces it, and the next change no longer saves over it. A saved email that opened when the Shell started already stayed this way.
