import React, { useState, useEffect } from 'react';

export default function NumberSliderInput({
  id,
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  prefix = '',
  helperText = '',
  quickPresets = []
}) {
  const [inputStr, setInputStr] = useState(String(value ?? ''));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setInputStr(String(value ?? 0));
    }
  }, [value, isFocused]);

  const handleTextChange = (e) => {
    const raw = e.target.value;
    if (raw === '') {
      setInputStr('');
      onChange(0);
      return;
    }
    const cleaned = raw.replace(/^0+(?=\d)/, '');
    setInputStr(cleaned);
    const parsed = Number(cleaned);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (inputStr === '' || isNaN(Number(inputStr))) {
      setInputStr(String(min));
      onChange(min);
    } else {
      const num = Number(inputStr);
      setInputStr(String(num));
      onChange(num);
    }
  };

  const clampedVal = Math.min(max, Math.max(min, Number(value) || 0));
  const progressPct = max > min ? ((clampedVal - min) / (max - min)) * 100 : 0;

  return (
    <div className="py-3 first:pt-0 last:pb-0 border-b border-[#EFE3DC] last:border-b-0 min-w-0">
      <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
        <div className="min-w-0">
          <label
            htmlFor={id}
            className="text-xs font-bold text-[#4B3227] tracking-wide leading-snug block truncate"
          >
            {label}
          </label>
          {helperText && (
            <span className="text-[11px] font-semibold text-[#B54B2E] block truncate mt-0.5">
              {helperText}
            </span>
          )}
        </div>

        <div className="flex items-center bg-[#FBF6F2] border border-[#E5D2C7] focus-within:border-[#D95D39] focus-within:ring-2 focus-within:ring-[#D95D39]/15 rounded-xl px-2.5 py-1.5 shrink-0 transition-all">
          {prefix && (
            <span className="text-[11px] font-bold text-[#8B6B5C] mr-1 whitespace-nowrap">
              {prefix}
            </span>
          )}
          <input
            id={id}
            type="text"
            inputMode="decimal"
            value={isFocused ? inputStr : String(value ?? 0)}
            onFocus={() => {
              setIsFocused(true);
              setInputStr(String(value ?? ''));
            }}
            onChange={handleTextChange}
            onBlur={handleBlur}
            placeholder="0"
            className="w-20 sm:w-24 text-right font-extrabold text-sm text-[#2C1A12] bg-transparent focus:outline-none tabular-nums"
          />
          {unit && (
            <span className="text-[11px] font-semibold text-[#8B6B5C] ml-1 whitespace-nowrap">
              {unit}
            </span>
          )}
        </div>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={clampedVal}
        aria-label={label}
        onChange={(e) => {
          const num = Number(e.target.value);
          setInputStr(String(num));
          onChange(num);
        }}
        style={{
          background: `linear-gradient(to right, #D95D39 0%, #D95D39 ${progressPct}%, #EBDCD3 ${progressPct}%, #EBDCD3 100%)`
        }}
        className="warm-slider w-full block"
      />

      {quickPresets.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {quickPresets.map((preset) => {
            const isSelected = Number(value) === preset.value;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => onChange(preset.value)}
                className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-[#2C1A12] text-[#FFFDFB]'
                    : 'bg-[#F4EAE3] text-[#6D4E40] hover:bg-[#EAD9CF] hover:text-[#2C1A12]'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
