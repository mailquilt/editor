---
"@mailquilt/core": minor
---

`BlockType` is exported: one of the Block types, as in `BLOCK_TYPES`, whose `type` is now a `BlockType`. A `Block` is typed by its type, so its `props` are that type's, and an email written in TypeScript as a `BlocksDocument` is checked against them. **Breaking:** a Block written without that type, whose `type` is then a `string`, no longer type-checks as a `Block`. Nothing changes when the code runs.
