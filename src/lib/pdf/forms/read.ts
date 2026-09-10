import { rectOf, refKeyOf } from '../annotations/read';
import type { PdfHandle } from '../document';
import type { FieldKind, FieldOption, FormField } from './model';

interface RawWidget {
  annotationType?: unknown;
  id?: unknown;
  fieldName?: unknown;
  fieldType?: unknown;
  fieldValue?: unknown;
  defaultFieldValue?: unknown;
  exportValue?: unknown;
  buttonValue?: unknown;
  options?: unknown;
  checkBox?: unknown;
  radioButton?: unknown;
  pushButton?: unknown;
  readOnly?: unknown;
  required?: unknown;
  hidden?: unknown;
  multiLine?: unknown;
  maxLen?: unknown;
  textAlignment?: unknown;
  defaultAppearanceData?: { fontSize?: unknown };
  rect?: unknown;
}

export function kindOfField(raw: RawWidget): FieldKind | null {
  if (raw.pushButton === true) return null;
  if (raw.checkBox === true) return 'checkbox';
  if (raw.radioButton === true) return 'radio';
  const type = typeof raw.fieldType === 'string' ? raw.fieldType : '';
  if (type === 'Tx') return 'text';
  if (type === 'Ch') return 'choice';
  if (type === 'Sig') return 'signature';
  return null;
}

export function valueOfField(raw: RawWidget): string {
  const value = raw.fieldValue ?? raw.defaultFieldValue;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    const first = value.find((entry) => typeof entry === 'string');
    return typeof first === 'string' ? first : '';
  }
  return '';
}

export function optionsOfField(raw: RawWidget): FieldOption[] {
  if (!Array.isArray(raw.options)) return [];
  const options: FieldOption[] = [];
  for (const entry of raw.options) {
    const option = entry as { exportValue?: unknown; displayValue?: unknown };
    const value = typeof option.exportValue === 'string' ? option.exportValue : '';
    const label = typeof option.displayValue === 'string' ? option.displayValue : value;
    if (value !== '' || label !== '') options.push({ value, label });
  }
  return options;
}

export function fieldFrom(raw: RawWidget, page: number): FormField | null {
  if (raw.annotationType !== 20) return null;
  const kind = kindOfField(raw);
  if (!kind) return null;

  const id = refKeyOf(raw.id);
  const name = typeof raw.fieldName === 'string' ? raw.fieldName : '';
  const rect = rectOf(raw.rect);
  if (!id || name === '' || !rect) return null;

  const exportValue =
    typeof raw.exportValue === 'string'
      ? raw.exportValue
      : typeof raw.buttonValue === 'string'
        ? raw.buttonValue
        : '';

  const size = raw.defaultAppearanceData?.fontSize;

  return {
    id,
    name,
    kind,
    page,
    rect,
    value: valueOfField(raw),
    exportValue,
    options: optionsOfField(raw),
    readOnly: raw.readOnly === true,
    required: raw.required === true,
    hidden: raw.hidden === true,
    multiline: raw.multiLine === true,
    maxLength: typeof raw.maxLen === 'number' && raw.maxLen > 0 ? raw.maxLen : 0,
    fontSize: typeof size === 'number' && size > 0 ? size : 0,
    alignment: typeof raw.textAlignment === 'number' ? raw.textAlignment : 0,
  };
}

export async function readFields(handle: PdfHandle): Promise<FormField[]> {
  const fields: FormField[] = [];
  for (let number = 1; number <= handle.pageCount; number += 1) {
    const page = await handle.page(number);
    const raw = (await page.getAnnotations({ intent: 'display' }).catch(() => [])) as
      | RawWidget[]
      | null;
    for (const entry of raw ?? []) {
      const field = fieldFrom(entry, number);
      if (field) fields.push(field);
    }
  }
  return fields;
}
