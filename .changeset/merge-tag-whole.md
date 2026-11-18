---
"@mailquilt/renderer": patch
---

A Merge Tag with spaces inside its braces, such as `{{ customer.preferred_name }}`, is exported as typed, so a sending service can fill it. A long one no longer gets invisible break points, two spaces in one no longer become a no-break space, and a URL written as text that holds one is linked whole, not to the address up to its first space.
