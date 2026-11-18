---
"@mailquilt/core": minor
"@mailquilt/editor": patch
---

Core's editor has `canUndo()` and `canRedo()`, and the editor's Undo and Redo buttons are disabled when there's nothing to undo or redo. A refused Command's result has a `code`, such as `noSuchBlock` or `invalidProps`, beside its `reason`, so code can tell one refusal from another. The docs list the codes.

**Breaking:** the same function subscribed twice is now called twice, until each subscription ends, where before the second `subscribe()` added nothing. The function that ends a subscription now returns nothing. A listener that throws no longer stops later listeners hearing of a change, and its error is still thrown once they all have.
