---
"@mailquilt/core": minor
"@mailquilt/renderer": minor
"@mailquilt/editor": minor
---

An Image takes an optional `decorative`, part of format version 4. A decorative Image can have neither `alt` nor `href`, so marking an Image that has either is refused with `invalidProps`, as is adding either to a decorative one. It exports with `alt=""`, so screen readers skip it, and `checkEmail` doesn't report it as `image-without-alt`.

In the editor, an Image with an image has a Decorative switch in the Selection bar. While it's on, "Screen readers skip it." takes the alt text field's place, and the Link button is off, with why in its tooltip. Turned on while the Image has alt text or a link, it says to remove them first, and takes effect once they're gone. Check's passed list says "Every Image has alt text or is decorative".
