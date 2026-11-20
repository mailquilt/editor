/**
 * A host may set `value` on `<mail-quilt>` or the Shell before the element is
 * defined, which leaves an own property in front of the class's setter. From
 * the constructor, this passes it to the setter.
 */
export const takeValueSetEarly = (element: { value: unknown }) => {
  if (Object.hasOwn(element, "value")) {
    const { value } = element;
    Reflect.deleteProperty(element, "value");
    element.value = value;
  }
};
