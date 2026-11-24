# Serve the Social icons from the renderer's package, as each brand draws them

The Social Block's icons are PNGs committed in `@mailquilt/renderer`, and an email links to them on jsDelivr at the renderer's exact version, such as `https://cdn.jsdelivr.net/npm/@mailquilt/renderer@<version>/icons/facebook-color.png`. A Host app can serve them itself with `socialIconsUrl`. Each icon is the brand's own mark, with no circle of ours, in two styles: color and white.

An email can't carry its icons inline: Gmail and Outlook drop SVG and `data:` images, so each icon has to be a PNG at a public URL. MJML's social element loads its icons from Mailjet by default, which would tie every sent email to a service we don't control. Mail Quilt runs no hosted service, so the icons can't come from a server of ours either.

## How

- **Where they're served.** A URL pinned to the renderer's exact version always names the same file, so a later release can't change an email that was already sent. Neither npm nor jsDelivr promises to serve a file forever, so a Host app that needs that sets the override. Neither GitHub's raw links nor the docs site's domain are used.
- **The override.** `socialIconsUrl`, an option of `renderEmail` and a property of `<mail-quilt>`, replaces the base URL. A Host app copies the icon folder to its own storage, so sent emails load nothing from a third party.
- **The Canvas** uses the same URLs as the export.
- **Sources:**
  - Simple Icons, pinned to 16.38.0 (CC0), for Facebook, Instagram, X, YouTube, TikTok, Pinterest, Threads and Bluesky.
  - Lucide's `globe` (ISC) for Website.
  - Font Awesome Free's LinkedIn icon (CC BY 4.0), credited in the package's notices. Simple Icons removed LinkedIn in its 14.0.0 because of LinkedIn's terms. LinkedIn's own files aren't used, because downloading them means accepting LinkedIn's agreements on the project's behalf.
- **The committed PNGs are the source of truth.** Nothing is fetched from those projects at build time or later, so a brand removed upstream changes nothing here. A script that makes the PNGs again from the pinned sources may live in the repo.
- **No circle of ours.** Facebook asks for its whole circle logo as supplied, not the "f" in a container of our own. LinkedIn asks that its logo not be combined with other designs, and Bluesky that its logo not be combined with other icons or design elements. Pinterest's mark is already a circle. So each icon is the brand's own shape, and a row of them is less uniform than a row of circles would be.
- **Except where dark mode would hide a mark.** In color, X, Threads and TikTok are white on a black rounded square, and the website icon white on dark grey. Drawn black on their own, they disappeared in the 0.3.0 Email on Acid run wherever dark mode turned a white Row near-black: Outlook on Windows and Mac, Outlook.com, Yahoo and the Gmail app on iPhone. X's quick guidelines ask for its logo white on black or black on white. A test fails if a color icon has no part that reads on white and on near-black.
- **Two styles, color and white.** Facebook allows its logo only in blue or in white, so a dark style can't be done for every network, and every brand that states a rule allows white. In color, X, Threads and TikTok are black, as their own color is, on their tile. The color PNGs bake in the parts a brand requires to be white, such as Facebook's "f", YouTube's triangle and Pinterest's "P", so they stay right on any background.
- **Sizes and spacing.** The sizes are 32, 40 and 48px, as Instagram's minimum is 29px. The gap between icons is half the icon's size. That meets Instagram's and Facebook's clear space, but not Bluesky's, which is the logo's own size. It also doesn't meet YouTube's stated 100px minimum height, if that's meant for the icon as well as the logo.

## Alternatives

- **Each brand's own asset pack.** Facebook and Threads ask for their own files only. Their packs come with terms that someone has to accept, and nothing confirms they may be redistributed in an MIT package. Simple Icons can be redistributed, so their rule is knowingly not met to the letter.
- **Icons on a circle of one color per style.** A uniform row, but against the rules of Facebook, LinkedIn and Bluesky.
- **Serving the icons from the docs site.** It would be a hosted service of Mail Quilt's own.
- **Requiring a Host app to supply the icons.** Every Host app would have to host files before the Social Block worked.

## Consequences

- Sent emails load the icons from jsDelivr, a third party, unless the Host app sets `socialIconsUrl`. The docs say so, and that a Host app with an image content security policy has to allow jsDelivr or set the override.
- The docs and the notices say that the logos are their owners' trademarks, that Mail Quilt isn't affiliated with them, and that a brand's icon is removed from the next release on its owner's request. That changes emails rendered after it. Emails already sent keep loading the icon from their pinned URL. The docs link each network's brand guidelines and say that the person sending the email follows them.
- A test fails the build if an icon the renderer can name is missing from the package's files.
- White icons can't be seen where dark mode makes their dark Row light, in classic Outlook for Windows and the Gmail app on iPhone, or turns them dark, in the Gmail app on Android. Outlining them would fix it, but Facebook and Pinterest forbid outlines. The Side panel and the docs say so, and that color icons show on light and dark backgrounds. On a Row in a brand's own color, that brand's color icon can blend in, which the docs say too.
