<script lang="ts">
  import { toScreenRect } from '$lib/pdf/annotations/geometry';
  import type { PageSize } from '$lib/pdf/document';
  import {
    isChecked,
    toggledCheck,
    UNCHECKED,
    valueFor,
    type FieldValues,
    type FormField,
  } from '$lib/pdf/forms/model';

  interface Props {
    size: PageSize;
    scale: number;
    rotation: number;
    fields: FormField[];
    values: FieldValues;
    onvalue: (name: string, value: string) => void;
  }

  const { size, scale, rotation, fields, values, onvalue }: Props = $props();

  const placed = $derived(
    fields.map((field) => ({ field, box: toScreenRect(field.rect, size, scale, rotation) })),
  );

  function fontSize(field: FormField, height: number): number {
    if (field.fontSize > 0) return field.fontSize * scale;
    return Math.min(15 * scale, Math.max(8, height * 0.62));
  }

  function align(field: FormField): string {
    if (field.alignment === 1) return 'center';
    if (field.alignment === 2) return 'right';
    return 'left';
  }
</script>

<div class="forms">
  {#each placed as entry (entry.field.id)}
    {@const field = entry.field}
    {@const box = entry.box}
    {@const style = `left: ${box.x}px; top: ${box.y}px; width: ${box.width}px; height: ${box.height}px`}

    {#if field.kind === 'text'}
      {#if field.multiline}
        <textarea
          class="field"
          style="{style}; font-size: {fontSize(field, box.height)}px; text-align: {align(field)}"
          readonly={field.readOnly}
          maxlength={field.maxLength > 0 ? field.maxLength : null}
          aria-label={field.name}
          value={valueFor(values, field)}
          oninput={(event) => onvalue(field.name, event.currentTarget.value)}
        ></textarea>
      {:else}
        <input
          class="field"
          type="text"
          style="{style}; font-size: {fontSize(field, box.height)}px; text-align: {align(field)}"
          readonly={field.readOnly}
          maxlength={field.maxLength > 0 ? field.maxLength : null}
          aria-label={field.name}
          value={valueFor(values, field)}
          oninput={(event) => onvalue(field.name, event.currentTarget.value)}
        />
      {/if}
    {:else if field.kind === 'checkbox' || field.kind === 'radio'}
      <button
        class="tick"
        class:round={field.kind === 'radio'}
        style={style}
        disabled={field.readOnly}
        role={field.kind === 'radio' ? 'radio' : 'checkbox'}
        aria-checked={isChecked(values, field)}
        aria-label={field.name}
        onclick={() => {
          if (field.kind === 'radio') onvalue(field.name, field.exportValue || UNCHECKED);
          else onvalue(field.name, toggledCheck(values, field)[field.name] ?? UNCHECKED);
        }}
      >
        {#if isChecked(values, field)}
          <svg viewBox="0 0 16 16" aria-hidden="true">
            {#if field.kind === 'radio'}
              <circle cx="8" cy="8" r="4" />
            {:else}
              <path d="M3.5 8.5l3 3 6-7" />
            {/if}
          </svg>
        {/if}
      </button>
    {:else if field.kind === 'choice'}
      <select
        class="field"
        style="{style}; font-size: {fontSize(field, box.height)}px"
        disabled={field.readOnly}
        aria-label={field.name}
        value={valueFor(values, field)}
        onchange={(event) => onvalue(field.name, event.currentTarget.value)}
      >
        <option value=""></option>
        {#each field.options as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    {:else}
      <div class="signature" style={style} title={field.name}></div>
    {/if}
  {/each}
</div>

<style>
  .forms {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .field,
  .tick,
  .signature {
    position: absolute;
    pointer-events: auto;
    box-sizing: border-box;
    margin: 0;
    border: 1px solid rgba(64, 120, 240, 0.55);
    background: rgba(64, 120, 240, 0.09);
    border-radius: 2px;
    color: #111111;
    font-family: inherit;
    outline: none;
  }

  .field:focus,
  .tick:focus-visible {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-soft);
  }

  input.field,
  select.field {
    padding: 0 3px;
    line-height: 1;
  }

  textarea.field {
    padding: 2px 3px;
    resize: none;
    line-height: 1.2;
  }

  .field[readonly],
  .field:disabled {
    background: rgba(120, 120, 120, 0.12);
    border-style: dashed;
  }

  .tick {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    cursor: pointer;
  }

  .tick.round {
    border-radius: 50%;
  }

  .tick svg {
    width: 78%;
    height: 78%;
    fill: #16408f;
    stroke: #16408f;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .tick svg path {
    fill: none;
  }

  .signature {
    border-style: dashed;
    pointer-events: none;
  }
</style>
