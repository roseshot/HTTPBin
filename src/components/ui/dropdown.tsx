import { Select } from "@base-ui/react/select";

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  ariaLabel: string;
  value: T;
  options: readonly DropdownOption<T>[];
  onChange: (value: T) => void;
  variant?: "method" | "field" | "language";
}

/** CSS-rendered select, backed by Base UI for keyboard and touch accessibility. */
export function Dropdown<T extends string>({ ariaLabel, value, options, onChange, variant = "field" }: Props<T>) {
  return (
    <Select.Root
      items={options}
      value={value}
      onValueChange={(next) => {
        const selected = options.find((option) => option.value === next);
        if (selected) onChange(selected.value);
      }}
      modal={false}
    >
      <Select.Trigger aria-label={ariaLabel} className={`ui-dropdown-trigger ui-dropdown-trigger--${variant}`}>
        <Select.Value className="ui-dropdown-value" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className="ui-dropdown-positioner" alignItemWithTrigger={false} side="bottom" align="start" sideOffset={6}>
          <Select.Popup className="ui-dropdown-popup">
            <Select.List className="ui-dropdown-list">
              {options.map((option) => (
                <Select.Item key={option.value} value={option.value} className="ui-dropdown-option">
                  <Select.ItemText className="ui-dropdown-option-text">{option.label}</Select.ItemText>
                  <Select.ItemIndicator className="ui-dropdown-indicator"><span aria-hidden="true" /></Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
