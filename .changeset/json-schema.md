---
"@mailquilt/core": minor
---

A JSON Schema for the saved format, as `@mailquilt/core/schema.json`, and on the site at `https://editor.mailquilt.com/schema/v4.json`. Each version of the format from 4 on has an address of its own, which stays when a newer version comes. The build makes it from the checks `loadDocument` runs, so a version 4 email it refuses, `loadDocument` refuses too. It's JSON Schema draft 2020-12, whose patterns are JavaScript regular expressions. Seven rules compare one value with another, which JSON Schema can't express, so only `loadDocument` checks them: different IDs, Column widths that add up to 100, each mark at most once on a piece of text, each network once in a Social Block, alt text on a linked Image, neither alt text nor a link on a decorative Image, and each web font once.

A Button's or the Email style's button color that isn't a solid color is now refused with one reason, "Must be a solid color written as #rgb, #rrggbb or rgb(255, 0, 0), not rgba(), with at most one space after each comma", where an `rgba()` color had a reason of its own. Which colors are accepted hasn't changed.
