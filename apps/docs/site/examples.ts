// The emails on the Examples page. Each is a document the editor opens, written
// by hand here so the page can offer the JSON and render the HTML from it. Each
// has its own page too, a file under pages/examples/ named for its slug.
//
// They share one look, which is this site's: white, ink and grey, with an
// orange button. A sender's own data comes in through Merge Tags, pictures included,
// and `sample` is what the page fills them with to show the email as a reader
// would get it.

import type {
  Block,
  BlocksDocument,
  BlockType,
  RichTextDocument,
  RichTextHardBreak,
  Row,
} from "@mailquilt/core";

import { art, INK, ORANGE, PAPER, SOFT, WASH } from "./example-art";
import { paragraph, runs } from "./rich-text";

/** A Block of any type, before it has an ID. */
type NewBlock = {
  [Type in BlockType]: Omit<Extract<Block, { type: Type }>, "id">;
}[BlockType];

type TextProps = Extract<Block, { type: "text" }>["props"];

const BODY = "#3f3f46";
const GREY = "#71717a";

type Runs = ReturnType<typeof runs>;

const plain = (text: string): Runs => runs(text);
const strong = (text: string): Runs => runs(text, [{ type: "bold" }]);
const BREAK: RichTextHardBreak = { type: "hardBreak" };

/** One paragraph whose lines are parts joined by line breaks. */
const lines = (...parts: Runs[]): RichTextDocument => ({
  content: [
    {
      content: parts.flatMap((part, index) =>
        index === 0 ? part : [BREAK, ...part]
      ),
      type: "paragraph",
    },
  ],
  type: "doc",
});

/** A line of small print ending in a link, such as an unsubscribe link. */
const withLink = (
  text: string,
  linkText: string,
  href: string
): RichTextDocument => ({
  content: [
    {
      content: [
        ...plain(text),
        ...runs(linkText, [{ attrs: { href }, type: "link" }]),
        ...plain("."),
      ],
      type: "paragraph",
    },
  ],
  type: "doc",
});

/** Gives each Row, Column and Block of one email an ID of its own. */
const emailBuilder = (slug: string) => {
  let count = 0;
  const nextId = (kind: string) => {
    count += 1;
    return `${slug}-${kind}-${count}`;
  };
  const block = (newBlock: NewBlock): Block => ({
    id: nextId(newBlock.type),
    ...newBlock,
  });
  const text = (
    content: RichTextDocument | string,
    props: Omit<TextProps, "content"> = {}
  ) =>
    block({
      props: {
        color: BODY,
        content: typeof content === "string" ? paragraph(content) : content,
        ...props,
      },
      type: "text",
    });
  return {
    button: (label: string, href: string) =>
      block({
        props: { backgroundColor: ORANGE, color: PAPER, href, label },
        type: "button",
      }),
    divider: () => block({ props: { color: SOFT }, type: "divider" }),
    /** The sender's name on the left, and a note about this email on the right. */
    header: (sender: string, note: string) => [
      [text(lines(strong(sender)), { color: INK, fontSize: 17 })],
      [text(note, { align: "right", color: GREY, fontSize: 14 })],
    ],
    image: (tag: string, alt: string, width: number) =>
      block({ props: { alt, src: `{{${tag}}}`, width }, type: "image" }),
    row: (
      widths: number[],
      columns: Block[][],
      backgroundColor = PAPER
    ): Row => ({
      columns: columns.map((blocks, index) => ({
        blocks,
        id: nextId("column"),
        props: {},
        width: widths[index] ?? 100,
      })),
      id: nextId("row"),
      props: { backgroundColor },
    }),
    spacer: (height: number) => block({ props: { height }, type: "spacer" }),
    text,
    title: (words: string) =>
      block({
        props: {
          color: INK,
          content: paragraph(words),
          fontSize: 34,
          level: 1,
        },
        type: "heading",
      }),
  };
};

const settings = (preheader: string): BlocksDocument["settings"] => ({
  backgroundColor: PAPER,
  fontFamily: "Arial, Helvetica, sans-serif",
  language: "en",
  preheader,
  width: 600,
});

const THIRDS = [33.33, 33.33, 33.34];

const welcome = (): BlocksDocument => {
  const { button, divider, header, image, row, spacer, text, title } =
    emailBuilder("welcome");
  const step = (name: string, detail: string) => [
    text(lines(strong(name), plain(detail)), { fontSize: 14 }),
  ];
  return {
    kind: "blocks",
    rows: [
      row([50, 50], header("Fernway", "Welcome")),
      row(
        [100],
        [
          [
            spacer(8),
            title("You're in, {{first_name}}."),
            text(
              "Your workspace is ready. Setting it up takes about two minutes, and you can change any of it later."
            ),
            button("Set up your workspace", "{{setup_url}}"),
            spacer(8),
            image(
              "workspace_image_url",
              "A new Fernway workspace, with three panels and room for a fourth.",
              568
            ),
          ],
        ]
      ),
      row(THIRDS, [
        step("Add your team", "Invite the people you work with."),
        step("Connect your data", "Bring in what you already have."),
        step("Send a test", "See it arrive before anyone else does."),
      ]),
      row(
        [100],
        [
          [
            divider(),
            text(
              withLink(
                "You're getting this because you signed up for Fernway. You can ",
                "unsubscribe",
                "{{unsubscribe_url}}"
              ),
              { color: GREY, fontSize: 13 }
            ),
          ],
        ]
      ),
    ],
    settings: settings("Your workspace is ready to set up"),
    version: 4,
  };
};

const receipt = (): BlocksDocument => {
  const { button, divider, header, image, row, spacer, text, title } =
    emailBuilder("receipt");
  const item = (
    tag: string,
    alt: string,
    name: string,
    detail: string,
    price: string
  ) =>
    row(
      [33, 67],
      [
        [image(tag, alt, 152)],
        [spacer(16), text(lines(strong(name), plain(detail), plain(price)))],
      ]
    );
  return {
    kind: "blocks",
    rows: [
      row([50, 50], header("Kiln & Co.", "Order {{order_id}}")),
      row(
        [100],
        [
          [
            spacer(8),
            title("Your order is packed, {{first_name}}."),
            text(
              "It leaves our studio tomorrow. We'll email you a tracking link as soon as it's with the courier."
            ),
            divider(),
          ],
        ]
      ),
      item(
        "item_1_image_url",
        "A canvas tote bag.",
        "Canvas tote bag",
        "Black, one size",
        "{{item_1_price}}"
      ),
      item(
        "item_2_image_url",
        "Three enamel pins.",
        "Enamel pins",
        "Set of three",
        "{{item_2_price}}"
      ),
      row([100], [[spacer(8)]]),
      // The three lines of the total share a Block each side, so they sit close.
      row(
        [67, 33],
        [
          [text(lines(plain("Subtotal"), plain("Shipping"), strong("Total")))],
          [
            text(
              lines(
                plain("{{subtotal}}"),
                plain("{{shipping}}"),
                strong("{{total}}")
              ),
              { align: "right" }
            ),
          ],
        ],
        WASH
      ),
      row(
        [100],
        [
          [
            spacer(8),
            button("Track your order", "{{order_url}}"),
            text(
              withLink(
                "Something not right? Reply to this email, or read our ",
                "returns policy",
                "{{returns_url}}"
              ),
              { color: GREY, fontSize: 13 }
            ),
          ],
        ]
      ),
    ],
    settings: settings("Your order is packed and leaves tomorrow"),
    version: 4,
  };
};

const update = (): BlocksDocument => {
  const { button, divider, header, image, row, spacer, text, title } =
    emailBuilder("update");
  const story = (tag: string, alt: string, name: string, detail: string) => [
    image(tag, alt, 268),
    text(lines(strong(name), plain(detail)), { fontSize: 14 }),
  ];
  return {
    kind: "blocks",
    rows: [
      row([50, 50], header("Northwind", "Issue 12, March")),
      row(
        [100],
        [
          [
            spacer(8),
            title("Three things we shipped this month"),
            text(
              "Hi {{first_name}}, here's what changed since the last issue, and what each change is for."
            ),
            spacer(8),
            image(
              "folders_image_url",
              "A pile of folders, with one lifted off the top.",
              568
            ),
            text(
              lines(
                strong("Shared folders"),
                plain(
                  "Keep a project's files in one place the whole team can reach. Anyone you invite sees the same folders you do."
                )
              )
            ),
            button("Read about shared folders", "{{folders_url}}"),
            divider(),
          ],
        ]
      ),
      row(
        [50, 50],
        [
          story(
            "search_image_url",
            "A search box with three results under it.",
            "Faster search",
            "Results now appear as you type, even in large workspaces."
          ),
          story(
            "table_image_url",
            "A table with one of its columns picked out.",
            "Export to CSV",
            "Any table can be exported, with the filters you've set applied."
          ),
        ]
      ),
      row(
        [100],
        [
          [
            divider(),
            text(
              withLink(
                "You get these because you asked for product updates. You can ",
                "change that",
                "{{preferences_url}}"
              ),
              { color: GREY, fontSize: 13 }
            ),
          ],
        ]
      ),
    ],
    settings: settings("Shared folders, faster search and CSV export"),
    version: 4,
  };
};

export const examples = [
  {
    document: welcome(),
    name: "Welcome",
    sample: {
      first_name: "Ada",
      setup_url: "#",
      unsubscribe_url: "#",
      workspace_image_url: art.workspace,
    },
    slug: "welcome",
    /** What the email is, for its page's description. */
    summary: "a first email after sign-up",
    text: "A first email after sign-up: a greeting, one button, a picture of what's waiting, and a Row of three Columns that sets out what to do next.",
  },
  {
    document: receipt(),
    name: "Receipt",
    sample: {
      first_name: "Ada",
      item_1_image_url: art.tote,
      item_1_price: "$38.00",
      item_2_image_url: art.pins,
      item_2_price: "$14.00",
      order_id: "#10482",
      order_url: "#",
      returns_url: "#",
      shipping: "$6.00",
      subtotal: "$52.00",
      total: "$58.00",
    },
    slug: "receipt",
    summary: "an order confirmation",
    text: "An order confirmation. Each thing bought is a Row split 33 / 67, with its picture beside its name and price, and the total is a tinted Row split 67 / 33.",
  },
  {
    document: update(),
    name: "Product update",
    sample: {
      first_name: "Ada",
      folders_image_url: art.folders,
      folders_url: "#",
      preferences_url: "#",
      search_image_url: art.search,
      table_image_url: art.table,
    },
    slug: "product-update",
    summary: "a monthly newsletter",
    text: "A monthly newsletter. The lead story gets a Row to itself, and two shorter ones share a Row split 50 / 50, each under its own picture.",
  },
];
