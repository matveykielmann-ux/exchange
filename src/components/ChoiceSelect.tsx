import type { ReactNode } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { FieldRenderProps } from './Field';
import { tNode } from '@/i18n';

export interface Choice<T extends string> {
  value: T;
  label: ReactNode;
  /** Secondary line shown in the open list only. */
  detail?: ReactNode;
  disabled?: boolean;
}

/**
 * Field-compatible dropdown (shadcn Select on Radix). Takes the props from `<Field>` so the
 * label, hint and error stay wired to the trigger, and keeps the `.select` look of our inputs.
 */
export function ChoiceSelect<T extends string>({
  field,
  value,
  onChange,
  choices,
}: {
  field: FieldRenderProps;
  value: T;
  onChange: (value: T) => void;
  choices: ReadonlyArray<Choice<T>>;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger className="select" {...field}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" className="choice-select__content">
        {choices.map((c) => (
          <SelectItem key={c.value} value={c.value} disabled={c.disabled} className="choice-select__item">
            <span className="choice-select__label">{tNode(c.label)}</span>
            {c.detail ? <span className="choice-select__detail">{tNode(c.detail)}</span> : null}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
