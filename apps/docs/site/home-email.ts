import type { BlocksDocument } from "@mailquilt/core";

import { paragraph } from "./rich-text";

/**
 * The email the landing page's editor opens. It says what the editor can do, so
 * a visitor learns it by reading the thing they are about to change.
 */
export const homeEmail: BlocksDocument = {
  kind: "blocks",
  rows: [
    {
      columns: [
        {
          blocks: [
            {
              id: "home-heading",
              props: { content: paragraph("Welcome aboard"), level: 1 },
              type: "heading",
            },
            {
              id: "home-text",
              props: {
                content: paragraph(
                  "Hi {{first_name}}, this editor is live. Type here, drag a Block in from the right, or press Tab and do all of it from the keyboard."
                ),
              },
              type: "text",
            },
            {
              id: "home-button",
              props: {
                backgroundColor: "#111113",
                color: "#ffffff",
                href: "{{confirm_url}}",
                label: "Confirm your address",
              },
              type: "button",
            },
          ],
          id: "home-welcome-column",
          props: {},
          width: 100,
        },
      ],
      id: "home-welcome",
      props: {},
    },
    {
      columns: [
        {
          blocks: [
            {
              id: "home-rows",
              props: {
                content: paragraph("A Row holds one to four Columns."),
                fontSize: 14,
              },
              type: "text",
            },
          ],
          id: "home-facts-narrow",
          props: {},
          width: 33,
        },
        {
          blocks: [
            {
              id: "home-columns",
              props: {
                content: paragraph(
                  "Each Column holds Blocks: Text, Heading, Image, Button, Divider and Spacer."
                ),
                fontSize: 14,
              },
              type: "text",
            },
          ],
          id: "home-facts-wide",
          props: {},
          width: 67,
        },
      ],
      id: "home-facts",
      props: { backgroundColor: "#f4f4f5" },
    },
  ],
  settings: {
    backgroundColor: "#ffffff",
    fontFamily: "Arial, Helvetica, sans-serif",
    language: "en",
    preheader: "Confirm your address to get started",
    width: 600,
  },
  version: 2,
};
