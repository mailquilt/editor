// The colors of code on the site: ink and greys, with the logo's orange for
// values, which are the strings and numbers. Shiki reads these as VS Code themes.

interface Palette {
  background: string;
  comment: string;
  keyword: string;
  property: string;
  strong: string;
  text: string;
  value: string;
}

const codeTheme = (
  name: string,
  type: "dark" | "light",
  { background, comment, keyword, property, strong, text, value }: Palette
) => ({
  colors: { "editor.background": background, "editor.foreground": text },
  name,
  tokenColors: [
    { settings: { background, foreground: text } },
    {
      scope: ["comment", "punctuation.definition.comment", "string.comment"],
      settings: { foreground: comment },
    },
    {
      scope: [
        "string",
        "punctuation.definition.string",
        "constant.numeric",
        "constant.language",
        "constant.character",
        "constant.other.color",
        "constant.other.symbol",
        "support.constant",
        "keyword.other.unit",
        "markup.inline.raw",
      ],
      settings: { foreground: value },
    },
    {
      scope: [
        "keyword",
        "storage",
        "storage.type",
        "storage.modifier",
        "punctuation.definition.keyword",
      ],
      settings: { foreground: keyword },
    },
    {
      scope: [
        "entity.name.tag",
        "entity.name.function",
        "entity.name.type",
        "entity.name.class",
        "support.function",
        "support.class",
        "support.type",
        "meta.selector",
      ],
      settings: { foreground: strong },
    },
    {
      scope: [
        "entity.other.attribute-name",
        "support.type.property-name",
        "meta.object-literal.key",
        "meta.property-name",
        "variable.css",
      ],
      settings: { foreground: property },
    },
    {
      scope: ["punctuation", "meta.brace", "keyword.operator"],
      settings: { foreground: comment },
    },
    {
      scope: ["variable", "variable.other", "variable.parameter"],
      settings: { foreground: text },
    },
  ],
  type,
});

export const codeLight = codeTheme("mailquilt-light", "light", {
  background: "#fafafa",
  comment: "#6b6b75",
  keyword: "#71717a",
  property: "#52525b",
  strong: "#111113",
  text: "#27272a",
  value: "#d4380f",
});

export const codeDark = codeTheme("mailquilt-dark", "dark", {
  background: "#131316",
  comment: "#7c7c87",
  keyword: "#a1a1aa",
  property: "#c4c4cc",
  strong: "#fafafa",
  text: "#e4e4e7",
  value: "#ff8a6b",
});
