---
"@mailquilt/editor": patch
---

With `save-key`, a host that sets its starter email again no longer replaces what the person typed on their first visit, as it already didn't once a saved email had opened. A different email still opens. And when a saved email that can't be opened can't be copied to `<save-key>:unopened` either, the Shell no longer saves over it, and says it can't save.
