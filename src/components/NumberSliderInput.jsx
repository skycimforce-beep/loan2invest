import React, { useState, useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';

const roundToStepPrecision = (num, step) => {
  const stepStr = String(step);
  const decimals = stepStr.includes('.') ? stepStr.split('.')[1].length : 0;
  return decimals > 0 ? Number(num.toFixed(decimals)) : Math.round(num);
};

const formatDisplayNumber = (val, step) => {
  const num = Number(val);
  if (isNaN(num)) return '0';
  const stepStr = String(step);
  const decimals = stepStr.includes('.') ? stepStr.split('.')[1].length : 0;
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.max(decimals, 2)
  });
};

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
  quickPresets = [],
  strictMax = false
}) {
  const [inputStr, setInputStr] = useState(String(value ?? 0));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setInputStr(String(value ?? 0));
    }
  }, [value, isFocused]);

  const commitClamped = (rawNum) => {
    let next = isNaN(rawNum) ? min : rawNum;
    next = Math.max(min, next);
    if (strictMax) {
      next = Math.min(max, next);
    }
    const clean = roundToStepPrecision(next, step);
    setInputStr(String(clean));
    onChange(clean);
  };

  const handleTextChange = (e) => {
    const raw = e.target.value;
    if (raw === '') {
      setInputStr('');
      return;
    }
    // 僅允許數字與單一小數點，避免輸入字母或多個小數點產生 NaN
    const stripped = raw.replace(/[^\d.]/g, '');
    const parts = stripped.split('.');
    const normalized =
      parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : stripped;
    const cleaned = normalized.replace(/^0+(?=\d)/, '');
    setInputStr(cleaned);

    if (cleaned !== '' && cleaned !== '.') {
      const parsed = Number(cleaned);
      if (!isNaN(parsed)) {
        const clamped = strictMax ? Math.min(max, parsed) : parsed;
        onChange(clamped);
      }
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (inputStr === '' || inputStr === '.' || isNaN(Number(inputStr))) {
      commitClamped(min);
    } else {
      commitClamped(Number(inputStr));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      stepBy(1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      stepBy(-1);
    } else if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const stepBy = (dir) => {
    const current = Number(value) || 0;
    const next = roundToStepPrecision(current + dir * step, step);
    const bounded = Math.max(min, strictMax ? Math.min(max, next) : Math.min(Math.max(max, current), next));
    setInputStr(String(bounded));
    onChange(bounded);
  };

  const numericVal = Number(value) || 0;
  const clampedVal = Math.min(max, Math.max(min, numericVal));
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

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => stepBy(-1)}
            disabled={numericVal <= min}
            aria-label={`減少 ${label}`}
            className="w-7 h-8 flex items-center justify-center rounded-lg bg-[#F4EAE3] hover:bg-[#EAD9CF] active:scale-95 text-[#4B3227] disabled:opacity-35 disabled:pointer-events-none transition-all"
          >
            <Minus className="w-3 h-3" />
          </button>

          <div className="flex items-center bg-[#FBF6F2] border border-[#E5D2C7] focus-within:border-[#D95D39] focus-within:ring-2 focus-within:ring-[#D95D39]/15 rounded-xl px-2 py-1.5 transition-all">
            {prefix && (
              <span className="text-[11px] font-bold text-[#8B6B5C] mr-1 whitespace-nowrap">
                {prefix}
              </span>
            )}
            <input
              id={id}
              type="text"
              inputMode="decimal"
              value={isFocused ? inputStr : formatDisplayNumber(value ?? 0, step)}
              onFocus={(e) => {
                setIsFocused(true);
                setInputStr(String(value ?? 0));
                const target = e.target;
                requestAnimationFrame(() => target.select());
              }}
              onChange={handleTextChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder="0"
              className="w-20 sm:w-22 text-right font-extrabold text-sm text-[#2C1A12] bg-transparent focus:outline-none tabular-nums"
            />
            {unit && (
              <span className="text-[11px] font-semibold text-[#8B6B5C] ml-1 whitespace-nowrap">
                {unit}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => stepBy(1)}
            disabled={strictMax && numericVal >= max}
            aria-label={`增加 ${label}`}
            className="w-7 h-8 flex items-center justify-center rounded-lg bg-[#F4EAE3] hover:bg-[#EAD9CF] active:scale-95 text-[#4B3227] disabled:opacity-35 disabled:pointer-events-none transition-all"
          >
            <Plus className="w-3 h-3" />
          </button>
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
          const num = roundToStepPrecision(Number(e.target.value), step);
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
                className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold whitespace-nowrap active:scale-95 transition-all ${
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
