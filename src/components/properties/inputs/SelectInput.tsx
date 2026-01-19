interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectInputProps {
  label: string;
  value: string | number | 'mixed';
  options: SelectOption[];
  onChange: (value: string | number) => void;
  disabled?: boolean;
}

export function SelectInput({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: SelectInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOption = options.find(opt => String(opt.value) === e.target.value);
    if (selectedOption) {
      onChange(selectedOption.value);
    }
  };

  return (
    <div className="select-input">
      <label className="select-input-label">{label}</label>
      <select
        className={`select-input-field ${value === 'mixed' ? 'mixed' : ''}`}
        value={value === 'mixed' ? '' : String(value)}
        onChange={handleChange}
        disabled={disabled}
      >
        {value === 'mixed' && (
          <option value="" disabled>Mixed</option>
        )}
        {options.map((option) => (
          <option key={option.value} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
