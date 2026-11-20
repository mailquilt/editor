# Domain docs

How agents use this repo's domain docs. It has one context: one `GLOSSARY.md` and one `docs/adr/`, both at the repo root.

## Before exploring, read these

- **`GLOSSARY.md`**, for the words the code and docs use.
- **`docs/adr/`**: the ADRs that touch the area you're about to work in. `docs/agents/decisions.md` lists which ADRs own which modules.

The `domain-modeling` skill adds a term to the glossary or records an ADR when one is settled, and `grill-with-docs` reaches it.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR 0007 (find the editor's places by name), but worth reopening because…_
