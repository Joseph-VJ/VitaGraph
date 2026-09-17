import React from "react";

export type DeltaType = "improving" | "decrease" | "increase" | "new" | "stable";

interface DeltaChipProps {
  type?: DeltaType;
  label?: string;
  className?: string;
  pop?: boolean;
}

export const DeltaChip: React.FC<DeltaChipProps> = ({
  type = "improving",
  label,
  className = "",
  pop = true,
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
    stable: {
      bg: "bg-[var(--ink-700)]",
      text: "text-[var(--dim)]",
      border: "border-[var(--line-strong)]",
      defaultLabel: "0.0 stable",
    },
  };

  const current = styles[type];
  const popClass = pop ? "animate-chip-pop" : "";
  const flashClass = type === "new" ? "animate-cornflower-flash" : "";

  const renderContent = () => {
    const text = label || current.defaultLabel;
    if (type === "improving" && !text.includes("↑")) {
      return (
        <>
          <span className="animate-arrow-nudge-up mr-1 inline-block">↑</span>
          {text}
        </>
      );
    }
    if ((type === "decrease" || type === "increase") && !text.includes("↓")) {
      return (
        <>
          <span className="animate-arrow-nudge-down mr-1 inline-block">↓</span>
          {text}
        </>
      );
    }
    // If text already has arrows, wrap them in nudge spans
    if (text.includes("↑")) {
      const parts = text.split("↑");
      return (
        <>
          {parts[0]}
          <span className="animate-arrow-nudge-up inline-block">↑</span>
          {parts[1]}
        </>
      );
    }
    if (text.includes("↓")) {
      const parts = text.split("↓");
      return (
        <>
          {parts[0]}
          <span className="animate-arrow-nudge-down inline-block">↓</span>
          {parts[1]}
        </>
      );
    }
    return text;
  };

  return (
    <span
      className={`inline-flex items-center rounded-[var(--r-4)] px-2 py-0.5 type-mono-sm border ${current.bg} ${current.text} ${current.border} ${popClass} ${flashClass} ${className}`}
    >
      {renderContent()}
    </span>
  );
};
