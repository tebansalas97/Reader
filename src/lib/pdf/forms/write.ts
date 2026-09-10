import type { PDFDocument } from 'pdf-lib';
import { changedNames, UNCHECKED, type FieldValues, type FormField } from './model';

export async function applyFields(
  document: PDFDocument,
  fields: FormField[],
  values: FieldValues,
  saved: FieldValues,
): Promise<void> {
  const names = changedNames(values, saved);
  if (names.length === 0 || fields.length === 0) return;

  const lib = await import('pdf-lib');
  const form = document.getForm();
  const byName = new Map(fields.map((field) => [field.name, field]));

  for (const name of names) {
    const field = byName.get(name);
    if (!field || field.readOnly) continue;
    const value = values[name] ?? '';

    try {
      if (field.kind === 'text') {
        form.getTextField(name).setText(value);
      } else if (field.kind === 'checkbox') {
        const box = form.getCheckBox(name);
        if (value === '' || value === UNCHECKED) box.uncheck();
        else box.check();
      } else if (field.kind === 'radio') {
        const group = form.getRadioGroup(name);
        if (value === '' || value === UNCHECKED) {
          group.clear();
        } else {
          const states = group.acroField
            .getOnValues()
            .map((state) => state.asString().replace(/^\//, ''));
          const labels = group.getOptions();
          const index = states.indexOf(value);
          group.select(index >= 0 ? (labels[index] ?? value) : value);
        }
      } else if (field.kind === 'choice') {
        const dropdown = form.getFields().find((entry) => entry.getName() === name);
        if (dropdown instanceof lib.PDFDropdown) {
          if (value === '') dropdown.clear();
          else dropdown.select(value);
        } else if (dropdown instanceof lib.PDFOptionList) {
          if (value === '') dropdown.clear();
          else dropdown.select(value);
        }
      }
    } catch {
      continue;
    }
  }

  try {
    const font = await document.embedFont(lib.StandardFonts.Helvetica);
    form.updateFieldAppearances(font);
  } catch {
    return;
  }
}
