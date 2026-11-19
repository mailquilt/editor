---
"@mailquilt/renderer": patch
---

A URL or email address written as text links to exactly what's written. An address with letters outside ASCII, such as `müller@example.com` or `info@müller.de`, links whole, and one that runs straight into a character it can't hold, such as `a@b.c_d`, isn't linked. Japanese or Chinese written straight before or after an address isn't linked as part of it. A URL or address whose formatting changes partway, such as a bold letter in it, links whole, and one that runs into a link isn't linked. No-break spaces at the ends of a Button's label are kept. A long run of tabs or spaces no longer stalls the export, which took time that grew with the square of the run.
