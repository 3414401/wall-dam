interface ScoreSliderProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
}

export function ScoreSlider({ label, value, onChange }: ScoreSliderProps) {
  return (
    <div className="slider-block">
      <div className="slider-header">
        <span className="slider-name">{label}</span>
        <span className="slider-value">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${label} 점수`}
      />
    </div>
  );
}
