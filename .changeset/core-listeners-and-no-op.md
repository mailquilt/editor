---
"@mailquilt/core": minor
---

**Breaking:** a Command that would change nothing no longer has `unchanged: true` in its result. It's refused with `code: "unchanged"`, as before, and that's now the only way it says so. If your code checks `result.unchanged`, check `result.code === "unchanged"` instead.

- A listener that applies a Command with the same `mergeKey` no longer changes what later listeners hear of the change before it. Each listener hears exactly the Operations of each change.
- Property changes under one `mergeKey` that end where they started leave no undo step, even when changes to several Blocks or Rows take turns. Before, changing a Block, then a Row, then putting both back left a step that changed nothing, and `canUndo()` was true.
- A saved email with props that are a Date, a Map or another object JSON can't hold is refused. Before, they loaded as `{}`.
- A language code with a one-letter subtag, such as `en-x-pirate`, is accepted.
- `isSameDocument()` tells apart an object with a key named `__proto__` from one without.
- A refused color's reason shows how to write one, such as `rgba(255, 0, 0, 0.5)` rather than `.5`. A saved Block with props it can't have is refused with the path to them, such as `rows.0.columns.0.blocks.0.props.colour`, as other parts of the email are.
- The docs now say that an error from hearing of a Command a listener applies is thrown from the call that made the first change, which is what has always happened.
