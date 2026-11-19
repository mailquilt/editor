// @ts-check
/**
 * The email each fresh project opens when nothing is saved, copied in beside
 * its quick start. The React projects read the type.
 *
 * @type {import("@mailquilt/editor").BlocksDocument}
 */
export const starterEmail = {
  kind: "blocks",
  rows: [
    {
      columns: [
        {
          blocks: [
            {
              id: "block-1",
              props: {
                content: {
                  content: [
                    {
                      content: [{ text: "Hello", type: "text" }],
                      type: "paragraph",
                    },
                  ],
                  type: "doc",
                },
              },
              type: "text",
            },
          ],
          id: "column-1",
          props: {},
          width: 100,
        },
      ],
      id: "row-1",
      props: {},
    },
  ],
  settings: {
    backgroundColor: "#ffffff",
    fontFamily: "Arial, Helvetica, sans-serif",
    width: 600,
  },
  version: 1,
};
