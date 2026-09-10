import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { makeFormPdf, makePdf } from '../../../test/pdf-fixtures';
import { loadForWriting, saveWritten } from '../annotations/write';
import { openPdfDocument, type PdfHandle } from '../document';
import { loadPdfjs } from '../load';
import {
  changedNames,
  fieldsOnPage,
  filledCount,
  isChecked,
  sameValues,
  toggledCheck,
  UNCHECKED,
  valuesOf,
  withValue,
  type FieldValues,
  type FormField,
} from './model';
import { fieldFrom, kindOfField, optionsOfField, readFields, valueOfField } from './read';
import { applyFields } from './write';

const open: PdfHandle[] = [];

function field(kind: FormField['kind'], extra: Partial<FormField> = {}): FormField {
  return {
    id: '1R',
    name: 'campo',
    kind,
    page: 1,
    rect: { x: 0, y: 0, width: 100, height: 20 },
    value: '',
    exportValue: '',
    options: [],
    readOnly: false,
    required: false,
    hidden: false,
    multiline: false,
    maxLength: 0,
    fontSize: 0,
    alignment: 0,
    ...extra,
  };
}

async function reopen(bytes: Uint8Array): Promise<PdfHandle> {
  const handle = await openPdfDocument(bytes);
  open.push(handle);
  return handle;
}

async function fill(bytes: Uint8Array, values: FieldValues): Promise<PdfHandle> {
  const fields = await readFields(await reopen(bytes));
  const document = await loadForWriting(bytes);
  await applyFields(document, fields, values, valuesOf(fields));
  return reopen(await saveWritten(document));
}

describe('the shape of a field', () => {
  it('reads a text field', () => {
    expect(kindOfField({ fieldType: 'Tx' })).toBe('text');
  });

  it('reads a checkbox', () => {
    expect(kindOfField({ fieldType: 'Btn', checkBox: true })).toBe('checkbox');
  });

  it('reads a radio button', () => {
    expect(kindOfField({ fieldType: 'Btn', radioButton: true })).toBe('radio');
  });

  it('leaves a push button alone, because it runs an action', () => {
    expect(kindOfField({ fieldType: 'Btn', pushButton: true })).toBeNull();
  });

  it('reads a list', () => {
    expect(kindOfField({ fieldType: 'Ch' })).toBe('choice');
  });

  it('reads a signature field', () => {
    expect(kindOfField({ fieldType: 'Sig' })).toBe('signature');
  });

  it('ignores something that is not a field', () => {
    expect(kindOfField({ fieldType: 'Zz' })).toBeNull();
  });
});

describe('valueOfField', () => {
  it('takes the value as it comes', () => {
    expect(valueOfField({ fieldValue: 'hola' })).toBe('hola');
  });

  it('falls back to the default value', () => {
    expect(valueOfField({ defaultFieldValue: 'por defecto' })).toBe('por defecto');
  });

  it('takes the first of a list of values', () => {
    expect(valueOfField({ fieldValue: ['uno', 'dos'] })).toBe('uno');
  });

  it('gives nothing for a field with no value', () => {
    expect(valueOfField({})).toBe('');
  });
});

describe('optionsOfField', () => {
  it('reads the options with their labels', () => {
    const options = optionsOfField({
      options: [{ exportValue: 'BOG', displayValue: 'Bogota' }],
    });
    expect(options).toEqual([{ value: 'BOG', label: 'Bogota' }]);
  });

  it('uses the value as the label when there is none', () => {
    expect(optionsOfField({ options: [{ exportValue: 'BOG' }] })[0]?.label).toBe('BOG');
  });

  it('gives nothing for a field with no options', () => {
    expect(optionsOfField({})).toEqual([]);
  });
});

describe('fieldFrom', () => {
  const raw = {
    annotationType: 20,
    id: '12R',
    fieldName: 'persona.nombre',
    fieldType: 'Tx',
    fieldValue: 'Esteban',
    rect: [60, 700, 300, 722],
    multiLine: false,
    maxLen: 40,
  };

  it('keeps what identifies the field', () => {
    const made = fieldFrom(raw, 2)!;
    expect(made.id).toBe('12R');
    expect(made.name).toBe('persona.nombre');
    expect(made.page).toBe(2);
    expect(made.value).toBe('Esteban');
    expect(made.maxLength).toBe(40);
    expect(made.rect).toEqual({ x: 60, y: 700, width: 240, height: 22 });
  });

  it('leaves out anything that is not a form field', () => {
    expect(fieldFrom({ ...raw, annotationType: 9 }, 1)).toBeNull();
  });

  it('leaves out a field with no name', () => {
    expect(fieldFrom({ ...raw, fieldName: '' }, 1)).toBeNull();
  });
});

describe('values', () => {
  it('takes the value of every field by name', () => {
    const fields = [
      field('text', { name: 'nombre', value: 'Esteban' }),
      field('checkbox', { name: 'acepta', value: 'Yes', exportValue: 'Yes' }),
    ];
    expect(valuesOf(fields)).toEqual({ nombre: 'Esteban', acepta: 'Yes' });
  });

  it('keeps the option that is on in a group of radio buttons', () => {
    const fields = [
      field('radio', { name: 'turno', value: 'Off', exportValue: 'manana' }),
      field('radio', { name: 'turno', value: 'tarde', exportValue: 'tarde' }),
    ];
    expect(valuesOf(fields)).toEqual({ turno: 'tarde' });
  });

  it('leaves a group with nothing chosen as off', () => {
    const fields = [
      field('radio', { name: 'turno', value: 'Off', exportValue: 'manana' }),
      field('radio', { name: 'turno', value: 'Off', exportValue: 'tarde' }),
    ];
    expect(valuesOf(fields)).toEqual({ turno: UNCHECKED });
  });

  it('knows when nothing changed', () => {
    expect(sameValues({ a: '1' }, { a: '1' })).toBe(true);
  });

  it('sees a value that changed', () => {
    expect(sameValues({ a: '1' }, { a: '2' })).toBe(false);
  });

  it('treats a missing value as empty', () => {
    expect(sameValues({ a: '' }, {})).toBe(true);
  });

  it('lists what changed', () => {
    expect(changedNames({ a: '1', b: '2' }, { a: '1', b: '3' })).toEqual(['b']);
  });

  it('ticks a checkbox that was off', () => {
    const box = field('checkbox', { name: 'acepta', exportValue: 'Si' });
    expect(toggledCheck({ acepta: UNCHECKED }, box)).toEqual({ acepta: 'Si' });
  });

  it('unticks one that was on', () => {
    const box = field('checkbox', { name: 'acepta', exportValue: 'Si' });
    expect(toggledCheck({ acepta: 'Si' }, box)).toEqual({ acepta: UNCHECKED });
  });

  it('knows which radio button of the group is on', () => {
    const morning = field('radio', { name: 'turno', exportValue: 'manana' });
    const evening = field('radio', { name: 'turno', exportValue: 'tarde' });
    expect(isChecked({ turno: 'tarde' }, morning)).toBe(false);
    expect(isChecked({ turno: 'tarde' }, evening)).toBe(true);
  });

  it('counts the fields that have something in them', () => {
    const fields = [
      field('text', { name: 'a', value: 'x' }),
      field('text', { name: 'b' }),
      field('checkbox', { name: 'c', exportValue: 'Si' }),
    ];
    expect(filledCount(fields, { a: 'x', b: '', c: UNCHECKED })).toBe(1);
  });

  it('keeps the fields of one page', () => {
    const fields = [field('text', { page: 1 }), field('text', { page: 2 })];
    expect(fieldsOnPage(fields, 2)).toHaveLength(1);
  });

  it('leaves out a field the file hides', () => {
    expect(fieldsOnPage([field('text', { hidden: true })], 1)).toHaveLength(0);
  });

  it('changes one value without touching the others', () => {
    expect(withValue({ a: '1', b: '2' }, 'b', '3')).toEqual({ a: '1', b: '3' });
  });
});

describe('against a real form', () => {
  beforeAll(async () => {
    const pdfjs = await loadPdfjs();
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
      join(process.cwd(), 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs'),
    ).href;
  });

  afterEach(async () => {
    while (open.length > 0) await open.pop()?.destroy().catch(() => undefined);
  });

  it('finds every field of the document', async () => {
    const fields = await readFields(await reopen(await makeFormPdf()));
    const names = [...new Set(fields.map((f) => f.name))].sort();
    expect(names).toEqual([
      'persona.acepta',
      'persona.ciudad',
      'persona.nombre',
      'persona.notas',
      'persona.turno',
    ]);
  });

  it('reads the kind of each one', async () => {
    const fields = await readFields(await reopen(await makeFormPdf()));
    const byName = new Map(fields.map((f) => [f.name, f.kind]));
    expect(byName.get('persona.nombre')).toBe('text');
    expect(byName.get('persona.acepta')).toBe('checkbox');
    expect(byName.get('persona.turno')).toBe('radio');
    expect(byName.get('persona.ciudad')).toBe('choice');
  });

  it('reads a text field as more than one line when it is', async () => {
    const fields = await readFields(await reopen(await makeFormPdf()));
    expect(fields.find((f) => f.name === 'persona.notas')?.multiline).toBe(true);
  });

  it('gives a radio group one widget per option', async () => {
    const fields = await readFields(await reopen(await makeFormPdf()));
    const turno = fields.filter((f) => f.name === 'persona.turno');
    expect(turno).toHaveLength(2);
    expect(turno.map((f) => f.exportValue).filter(Boolean)).toHaveLength(2);
  });

  it('reads the options of a list', async () => {
    const fields = await readFields(await reopen(await makeFormPdf()));
    const ciudad = fields.find((f) => f.name === 'persona.ciudad');
    expect(ciudad?.options.map((o) => o.value)).toEqual(['Bogota', 'Medellin', 'Cali']);
  });

  it('writes a text field into the file', async () => {
    const handle = await fill(await makeFormPdf(), { 'persona.nombre': 'Esteban' });
    const fields = await readFields(handle);
    expect(fields.find((f) => f.name === 'persona.nombre')?.value).toBe('Esteban');
  });

  it('writes several lines into a field that takes them', async () => {
    const handle = await fill(await makeFormPdf(), { 'persona.notas': 'uno\ndos' });
    const fields = await readFields(handle);
    expect(fields.find((f) => f.name === 'persona.notas')?.value).toBe('uno\ndos');
  });

  it('ticks a checkbox', async () => {
    const handle = await fill(await makeFormPdf(), { 'persona.acepta': 'Yes' });
    const fields = await readFields(handle);
    const acepta = fields.find((f) => f.name === 'persona.acepta')!;
    expect(isChecked(valuesOf([acepta]), acepta)).toBe(true);
  });

  it('chooses one of the radio buttons', async () => {
    const before = await readFields(await reopen(await makeFormPdf()));
    const evening = before.filter((f) => f.name === 'persona.turno')[1]!;
    const handle = await fill(await makeFormPdf(), { 'persona.turno': evening.exportValue });
    const fields = await readFields(handle);
    expect(valuesOf(fields)['persona.turno']).toBe(evening.exportValue);
  });

  it('chooses from a list', async () => {
    const handle = await fill(await makeFormPdf(), { 'persona.ciudad': 'Medellin' });
    const fields = await readFields(handle);
    expect(fields.find((f) => f.name === 'persona.ciudad')?.value).toBe('Medellin');
  });

  it('leaves the fields nobody touched as they were', async () => {
    const handle = await fill(await makeFormPdf(), { 'persona.nombre': 'Esteban' });
    const fields = await readFields(handle);
    expect(fields.find((f) => f.name === 'persona.notas')?.value).toBe('');
  });

  it('gives what it wrote an appearance, so it shows in any reader', async () => {
    const handle = await fill(await makeFormPdf(), { 'persona.nombre': 'Esteban' });
    const raw = (await (await handle.page(1)).getAnnotations({ intent: 'display' })) as Array<{
      fieldName?: string;
      hasAppearance?: boolean;
    }>;
    expect(raw.find((entry) => entry.fieldName === 'persona.nombre')?.hasAppearance).toBe(true);
  });

  it('finds nothing in a document without a form', async () => {
    expect(await readFields(await reopen(await makePdf([{ text: 'a' }])))).toEqual([]);
  });
});
