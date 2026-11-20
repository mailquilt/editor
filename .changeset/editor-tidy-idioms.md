---
"@mailquilt/editor": patch
---

- Every shadow the editor draws is now a theme token's. A theme's `--mq-shadow` reaches the email card, and `--mq-shadow-small` the selected side panel tab, the tiles and the settings fields, which kept the light theme's own shadows before. With no theme set, those shadows change slightly to the tokens' defaults.
- Each file of the CDN build starts with a comment saying the licenses of the packages bundled in it are in `THIRD-PARTY-LICENSES.txt`, beside it.
