import { describe, expect, it } from "vitest";

import { htmlLines } from "../src/html-lines.js";

/** Each line as it reads, its parts' kinds in brackets where they're colored. */
const read = (html: string) =>
  htmlLines(html).map((parts) =>
    parts
      .map(({ kind, text }) => (kind === "text" ? text : `[${kind}:${text}]`))
      .join("")
  );

describe(htmlLines, () => {
  it("puts each tag on a line of its own, indented inside its parent, with a text and its closing tag on the opening tag's line", () => {
    expect(
      read(
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Hi &amp; bye</title></head><body style="margin:0;"><p>One</p><br/></body></html>'
      )
    ).toStrictEqual([
      "<[name:!doctype] html>",
      '<[name:html] lang=[value:"en"]>',
      "  <[name:head]>",
      '    <[name:meta] charset=[value:"utf-8"]>',
      "    <[name:title]>Hi &amp; bye</[name:title]>",
      "  </[name:head]>",
      '  <[name:body] style=[value:"margin:0;"]>',
      "    <[name:p]>One</[name:p]>",
      "    <[name:br]/>",
      "  </[name:body]>",
      "</[name:html]>",
    ]);
  });

  it("keeps a comment out of the indent of the tags around it", () => {
    expect(
      read(
        '<div><!--[if mso | IE]><table role="presentation"><tr><td><![endif]--><p>Hi</p><!--[if !mso]><!--></div>'
      )
    ).toStrictEqual([
      "<[name:div]>",
      "  [comment:<!--[if mso | IE]>]",
      '    [comment:<table role="presentation">]',
      "    [comment:<tr>]",
      "    [comment:<td>]",
      "  [comment:<![endif]-->]",
      "  <[name:p]>Hi</[name:p]>",
      "  [comment:<!--[if !mso]><!-->]",
      "</[name:div]>",
    ]);
  });

  it("breaks a tag longer than 80 characters before an attribute, onto a line indented further", () => {
    expect(
      read(
        '<div><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;"><tr></tr></table></div>'
      )
    ).toStrictEqual([
      "<[name:div]>",
      '  <[name:table] align=[value:"center"] border=[value:"0"] cellpadding=[value:"0"] cellspacing=[value:"0"]',
      '      role=[value:"presentation"] style=[value:"width:100%;"]>',
      "    <[name:tr]></[name:tr]>",
      "  </[name:table]>",
      "</[name:div]>",
    ]);
  });

  it("puts each CSS rule in a style on a line of its own, indented inside @media", () => {
    expect(
      read(
        '<style type="text/css"> #outlook a { padding:0; } @media only screen and (min-width:480px) { .col {  width:100% !important; } } </style>'
      )
    ).toStrictEqual([
      '<[name:style] type=[value:"text/css"]>',
      "  #outlook a { padding:0; }",
      "  @media only screen and (min-width:480px) {",
      "    .col { width:100% !important; }",
      "  }",
      "</[name:style]>",
    ]);
  });

  it("puts each tag in an Outlook comment on a line of its own", () => {
    expect(
      read('<!--[if mso | IE]><table role="presentation"><tr><td><![endif]-->')
    ).toStrictEqual([
      "[comment:<!--[if mso | IE]>]",
      '  [comment:<table role="presentation">]',
      "  [comment:<tr>]",
      "  [comment:<td>]",
      "[comment:<![endif]-->]",
    ]);
  });

  it("keeps an empty element on one line", () => {
    expect(read("<head><title>\n</title></head>")).toStrictEqual([
      "<[name:head]>",
      "  <[name:title]></[name:title]>",
      "</[name:head]>",
    ]);
  });

  it("leaves out the spaces between tags, and keeps a text's own", () => {
    expect(read("<a href=x> Shop </a> <b>")).toStrictEqual([
      "<[name:a] href=[value:x]> Shop </[name:a]>",
      "<[name:b]>",
    ]);
  });

  it("keeps an @import, which has no braces, on a line of its own before the rules", () => {
    expect(
      read(
        "<style>@import url(https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap);@media (min-width:480px){.a{width:1px;}}</style>"
      )
    ).toStrictEqual([
      "<[name:style]>",
      "  @import url(https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap);",
      "  @media (min-width:480px){",
      "    .a{width:1px;}",
      "  }",
      "</[name:style]>",
    ]);
  });
});
