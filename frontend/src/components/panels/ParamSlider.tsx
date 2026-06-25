/**
 * ParamSlider — labelled range input with mono-font value display.
 *
 * Ported from DTM_Demo.html `.param-slider`.  The value is shown to
 * the right of the label in a tabular monospace style.
 *
 *   <ParamSlider
 *     label="Reserve"
 *     min={0}
 *     max={100}
 *     step={1}
 *     value={42}
 *     onChange={setR}
 *     suffix=" WETH"
 *     precision={0}
 *     id="reserve-slider"
 *   />
 */

export interface ParamSliderProps {
  label: string;
  min: number;
  max: number;
  /** Step size (default 1). */
  step?: number;
  value: number;
  onChange: (v: number) => void;
  /** Suffix shown after the value (e.g. "%", " WETH"). */
  suffix?: string;
  /** Decimal places (default 0). */
  precision?: number;
  /** Native id passthrough. */
  id?: string;
  /** Disable interaction. */
  disabled?: boolean;
  /** Test hook. */
  testId?: string;
}

export function ParamSlider({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  suffix = '',
  precision = 0,
  id,
  disabled,
  testId,
}: ParamSliderProps) {
  const formatted = value.toFixed(precision);
  return (
    <div className="dtm-form-group" data-testid={testId}>
      <div className="dtm-form-label">
        <span>{label}</span>
        <span className="dtm-form-value">
          {formatted}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        id={id}
        disabled={disabled}
        className="dtm-param-slider"
      />
    </div>
  );
}
