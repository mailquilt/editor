// No page shows this. Angular's build type-checks its template, so the types
// Angular gives the element are read here as an app's templates read them.
import { Component, CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import type {
  MailQuilt,
  MailQuiltChangeEvent,
  MailQuiltErrorEvent,
} from "@mailquilt/editor";

/**
 * Takes only a value of type `Expected`. Angular has no expected-error comment
 * for templates, and a type that fell back to `any` would pass any check, so
 * this refuses `any` itself, and the build fails.
 */
type Typed<Value, Expected> = 0 extends 1 & Value
  ? never
  : Value extends Expected
    ? Value
    : never;

const editorOnly = <Value>(editor: Value & Typed<Value, MailQuilt>) => editor;
const changeOnly = <Value>(event: Value & Typed<Value, MailQuiltChangeEvent>) =>
  event;
const errorOnly = <Value>(event: Value & Typed<Value, MailQuiltErrorEvent>) =>
  event;

@Component({
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  selector: "app-element-types",
  template: `
    <mail-quilt
      #editor
      (click)="element(editor)"
      (mq-change)="changed($event)"
      (mq-error)="refused($event)"
    ></mail-quilt>
  `,
})
export class ElementTypes {
  protected readonly element = editorOnly;
  protected readonly changed = changeOnly;
  protected readonly refused = errorOnly;
}
