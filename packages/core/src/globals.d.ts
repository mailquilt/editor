// The only globals core uses beyond the language, which browsers and Node both
// have. Declared here rather than by loading Node's or the DOM's types, so that
// core's source can't use what only one of them has.
/* oxlint-disable no-implicit-globals -- Declaring these is the point. */

declare function structuredClone<T>(value: T): T;

declare const crypto: {
  getRandomValues: <T extends ArrayBufferView>(array: T) => T;
};
