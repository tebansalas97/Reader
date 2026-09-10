import type { Rect } from '../annotations/model';

export type FieldKind = 'text' | 'checkbox' | 'radio' | 'choice' | 'signature';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FormField {
  id: string;
  name: string;
  kind: FieldKind;
  page: number;
  rect: Rect;
  value: string;
  exportValue: string;
  options: FieldOption[];
  readOnly: boolean;
  required: boolean;
  hidden: boolean;
  multiline: boolean;
  maxLength: number;
  fontSize: number;
  alignment: number;
}

export type FieldValues = Record<string, string>;

export const UNCHECKED = 'Off';

export function valuesOf(fields: FormField[]): FieldValues {
  const values: FieldValues = {};
  for (const field of fields) {
    if (field.kind === 'checkbox' || field.kind === 'radio') {
      const on = field.value !== '' && field.value !== UNCHECKED;
      if (on || values[field.name] === undefined) {
        values[field.name] = on ? field.value : UNCHECKED;
      }
      continue;
    }
    values[field.name] = field.value;
  }
  return values;
}

export function sameValues(a: FieldValues, b: FieldValues): boolean {
  const names = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const name of names) {
    if ((a[name] ?? '') !== (b[name] ?? '')) return false;
  }
  return true;
}

export function changedNames(a: FieldValues, b: FieldValues): string[] {
  const names = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...names].filter((name) => (a[name] ?? '') !== (b[name] ?? '')).sort();
}

export function valueFor(values: FieldValues, field: FormField): string {
  return values[field.name] ?? '';
}

export function isChecked(values: FieldValues, field: FormField): boolean {
  const value = valueFor(values, field);
  if (field.kind === 'radio') return value === field.exportValue;
  return value !== '' && value !== UNCHECKED;
}

export function withValue(values: FieldValues, name: string, value: string): FieldValues {
  return { ...values, [name]: value };
}

export function toggledCheck(values: FieldValues, field: FormField): FieldValues {
  const on = isChecked(values, field);
  const next = on ? UNCHECKED : field.exportValue || 'Yes';
  return withValue(values, field.name, next);
}

export function fieldsOnPage(fields: FormField[], page: number): FormField[] {
  return fields.filter((field) => field.page === page && !field.hidden);
}

export function filledCount(fields: FormField[], values: FieldValues): number {
  const names = new Set<string>();
  for (const field of fields) {
    const value = valueFor(values, field);
    if (value !== '' && value !== UNCHECKED) names.add(field.name);
  }
  return names.size;
}
