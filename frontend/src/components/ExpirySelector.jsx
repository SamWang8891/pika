const PRESETS = [
  { value: '1h', label: '1 Hour' },
  { value: '12h', label: '12 Hours' },
  { value: '1d', label: '1 Day' },
  { value: '7d', label: '7 Days' },
  { value: 'never', label: 'Never' },
];

export default function ExpirySelector({ value, onChange }) {
  return (
    <div>
      <label className="input-label">Link expires in</label>
      <div className="pill-group">
        {PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            className={`pill ${value === preset.value ? 'active' : ''}`}
            onClick={() => onChange(preset.value)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
