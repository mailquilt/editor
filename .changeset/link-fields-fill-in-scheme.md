---
"@mailquilt/editor": minor
---

The editor's link fields fill in the scheme: an address typed without one, such as `example.com/shop`, is saved with `https://`, and an email address with `mailto:`. As it's typed, the field shows the link that will be saved under it, such as "Links to https://example.com/shop". This covers the link field in text and every setting that holds a link: a Button's, an Image's and a Video's link, and a Menu's and a Social Block's URLs. Core's rule for links is unchanged, so a document set through `value` or an Operation still needs the scheme written out. On a phone, a Selection bar field's error, the link it will save and its Merge Tags show above the bar, where its scrolling no longer cuts them off. A refused link now says "That isn’t a web address. Try one like example.com/shop, an email address, or a Merge Tag such as {{cta_url}}."
