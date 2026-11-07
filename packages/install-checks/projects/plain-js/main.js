import "@mailquilt/editor";

const starterEmail = {
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

const editor = document.querySelector("mail-quilt");
const saved = localStorage.getItem("email");

editor.addEventListener("mq-change", (event) => {
  localStorage.setItem("email", JSON.stringify(event.detail.document));
});
editor.value = saved ? JSON.parse(saved) : starterEmail;

document.querySelector("#export").addEventListener("click", async () => {
  document.querySelector("output").textContent = await editor.exportHtml();
});
