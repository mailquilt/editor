# Check every package against one list of Block types

Core's list of Block types is a type, `BlockType`, and a `Block` is typed by its type, so its `props` are that type's. The renderer and the editor are checked against it, so a type core adds and either of them doesn't handle fails to compile (#216).

Before, a Block's `type` was any string and its `props` any object. The renderer's `switch` repeated core's list, cast each Block's props to its type's, and threw for a type it didn't know, so a missing type showed only when an email exported. The editor's part of a Block type was in five places: whether it has text, what it draws, its icon, its text schema and whether it can be bold, and a CSS selector listing the types that get a Block's padding. A type it didn't know drew nothing on the canvas, where the renderer threw. The editor also cast a Block's text, and an Image's props, because it didn't use core's props type.

## How

- Core's `BLOCKS` is the one list. `BlockType` is its types, and `Block` has one shape for each, with that type's props, as its schema checks them. Both are exported, and `BLOCK_TYPES` gives each `type` as a `BlockType`.
- Core casts where it checks: when an email loads, as the variant schema doesn't tie each Block's props to its type, and when a Command inserts a Block with its type's defaults.
- The renderer's `switch` takes each Block's props as its type's, with no cast. Its `default` gives the Block to a `never`, so a type left out fails to compile, and still throws, though core's check means it's never reached.
- The editor's part of each type is the table `BLOCK_VIEWS` in `block-types.ts`, typed by `BlockType`: its icon, and either how its text is edited, with its own text schema and whether it can be bold, or what it draws on the canvas. Whether a Block has text comes from the table. A Block's padding is the class `padded-block`, which what it draws gives itself.
- A `Command` still takes `blockType` as a string, as a host can send anything, and core refuses an unknown one with `unknownBlockType`.

## Alternatives

- **Keep `Block` loose, and give the editor and renderer a typed Block of their own.** Hosts would see no change, but each package would cast every Block it reads, and a host's starter email would still not be checked.
- **A table in the renderer too.** TypeScript can't call one entry of a table for a Block of any type without a cast or a helper that hides one. A `switch` on the type narrows the Block itself.

## Consequences

- A new Block type is added to core's `BLOCKS`, and the compiler then names each place in the renderer and the editor that needs it.
- A host's email written in TypeScript as a `BlocksDocument` is checked against each type's props. One written without that type, whose `type` is then a `string`, no longer type-checks as a `Block`.
- What the editor shows and the exported HTML don't change.
