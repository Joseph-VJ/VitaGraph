import React from "react";

export type DeltaType = "improving" | "decrease" | "increase" | "new";

interface DeltaChipProps {
  type?: DeltaType;
  label?: string;
  className?: string;
}

export const DeltaChip: React.FC<DeltaChipProps> = ({
  type = "improving",
  label,
  className = "",
}) => {
  const styles: Record<DeltaType, { bg: string; text: string; border: string; defaultLabel: string }> = {
    improving: {
      bg: "bg-[rgba(121,184,166,0.12)]",
      text: "text-[var(--verdigris)]",
      border: "border-[rgba(121,184,166,0.25)]",
      defaultLabel: "+0.1 improving",
    },
    decrease: {
      bg: "bg-[rgba(217,164,65,0.12)]",
      text: "text-[var(--ochre)]",
      border: "border-[rgba(217,164,65,0.25)]",
      defaultLabel: "−6 slight decrease",
    },
    increase: {
      bg: "bg-[rgba(217,128,141,0.12)]",
      text: "text-[var(--madder)]",
      border: "border-[rgba(217,128,141,0.25)]",
      defaultLabel: "+0.3 increase",
    },
    new: {
      bg: "bg-[rgba(134,169,217,0.12)]",
      text: "text-[var(--cornflower)]",
      border: "border-[rgba(134,169,217,0.25)]",
      defaultLabel: "new result",
    },
  };

  const current = styles[type];

  return (
    <span
      className={`inline-flex items-center rounded-[var(--r-4)] px-2 py-0.5 type-mono-sm border ${current.bg} ${current.text} ${current.border} ${className}`}
    >
      {label || current.defaultLabel}
    </span>
  );
};
