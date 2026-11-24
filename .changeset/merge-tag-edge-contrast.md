---
"@mailquilt/editor": patch
---

The highlighted tag in the Merge Tag list, and a Merge Tag in text, have an edge at 3:1 or more. Before, the edge was at about 2:1, so a person with low vision couldn't easily tell which tag <kbd>Enter</kbd> would put in, or a tag from typed words. The highlighted tag's edge uses `--mq-color-accent-strong`, as a pressed button's does. A Merge Tag's edge in text is in the text's own color, so it stands out from the email as the text does, whatever the editor's theme.
