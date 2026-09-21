import React, { useState } from "react";
import { governor, isReducedMotion } from "../../motion";
import { playDetent } from "../../motion/audio";
import { Sequence } from "../../motion/sequence";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  shortcut?: string;
}

export const Input: React.FC<InputProps> = ({
  icon,
  shortcut,
  disabled = false,
  className = "",
  ...props
}) => {
  return (
    <div className={`relative flex items-center w-full ${className}`}>
      {icon && (
        <span className="absolute left-3 text-[var(--dim)] pointer-events-none flex items-center justify-center">
          {icon}
        </span>
      )}
      <input
        disabled={disabled}
        className={`w-full h-10 bg-[var(--ink-800)] border border-[var(--line-strong)] text-[var(--bone)] placeholder-[var(--faint)] rounded-[var(--r-8)] type-body pl-3 pr-3 transition-colors duration-[120ms] ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--verdigris)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ink-900)] disabled:opacity-40 disabled:cursor-not-allowed ${
          icon ? "pl-9" : ""
        } ${shortcut ? "pr-12" : ""} ${className}`}
        {...props}
      />
      {shortcut && (
        <span className="absolute right-3 type-mono text-xs text-[var(--faint)] pointer-events-none border border-[var(--line-faint)] rounded px-1.5 py-0.5 bg-[var(--ink-700)]">
          {shortcut}
        </span>
      )}
    </div>
  );
};

// Select Dropdown
interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  compactPaper?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  options,
  compactPaper = false,
  disabled = false,
  className = "",
  onChange,
  ...props
}) => {
  const [popping, setPopping] = useState(false);
  const isT0 = governor.getState().tier === "T0" || isReducedMotion();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    playDetent();
    if (!isT0) {
      setPopping(true);
      new Sequence().wait(180).addAction(() => setPopping(false)).play();
    }
    onChange?.(e);
  };

  return (
    <div
      className={`relative inline-flex items-center transition-transform duration-[80ms] active:scale-[0.99] ${
        compactPaper ? "w-[84px]" : "w-auto"
      } ${popping && !isT0 ? "animate-chip-pop" : ""}`}
    >
      <select
        disabled={disabled}
        onChange={handleChange}
        className={`appearance-none h-9 w-full bg-[var(--ink-800)] border border-[var(--line-strong)] text-[var(--bone)] rounded-[var(--r-6)] pl-3 pr-7 type-body transition-all duration-[120ms] ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--verdigris)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ink-900)] focus-visible:border-[var(--verdigris)] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[var(--dim)] cursor-pointer ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[var(--ink-800)] text-[var(--bone)]">
            {opt.label}
          </option>
        ))}
      </select>
      <div className="absolute right-2.5 pointer-events-none text-[var(--dim)]">
        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    </div>
  );
};
