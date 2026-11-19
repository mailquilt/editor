import * as v from "valibot";

/** A whole number of pixels, 1 or more. */
export const wholePixelsSchema = v.pipe(
  v.number(),
  v.safeInteger(),
  v.minValue(1)
);

export const pixelSchema = (max: number) =>
  v.pipe(wholePixelsSchema, v.maxValue(max));

/**
 * The colors MJML's strict check takes, which the export runs, so that an email
 * that loads can also be exported. So an alpha is written as 0.5, not .5, and a
 * channel can be up to 999, which CSS reads as 255.
 */
export const colorSchema = v.pipe(
  v.string(),
  v.regex(
    /^(?:#[\da-f]{3}(?:[\da-f]{3})?|rgb\(\d{1,3}, ?\d{1,3}, ?\d{1,3}\)|rgba\(\d{1,3}, ?\d{1,3}, ?\d{1,3}, ?\d(?:\.\d{1,3})?\))$/iu,
    "Must be a color written as #rgb, #rrggbb, rgb(255, 0, 0) or rgba(255, 0, 0, 0.5), with at most one space after each comma"
  )
);

/**
 * A color as #rrggbb, which a color input takes, from one in a format above.
 * Its alpha is dropped. Nothing for text that isn't a color the schema accepts.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const hexColor = (color: string) => {
  if (!v.is(colorSchema, color)) {
    return;
  }
  if (/^#[\da-f]{3}$/iu.test(color)) {
    return color.replaceAll(/[\da-f]/giu, "$&$&").toLowerCase();
  }
  if (color.startsWith("#")) {
    return color.toLowerCase();
  }
  const channels = color.match(/\d{1,3}/gu)?.slice(0, 3);
  return (
    channels &&
    `#${channels
      .map((channel) =>
        Math.min(Number(channel), 255).toString(16).padStart(2, "0")
      )
      .join("")}`
  );
};

/**
 * For a color MJML paints in two layers, as on both parts of a button, where a
 * see-through one would come out darker than it should.
 */
export const solidColorSchema = v.pipe(
  colorSchema,
  v.check(
    (color) => !/^rgba/iu.test(color),
    "Must be a solid color, not rgba()"
  )
);
