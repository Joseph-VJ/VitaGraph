import React from "react";

export type LEDColor = "verdigris" | "ochre" | "madder" | "cornflower" | "faint";

interface LEDProps {
  color?: LEDColor;
  status?: "online" | "warning" | "error" | "offline" | string;
  size?: number;
  live?: boolean;
  className?: string;
  title?: string;
}

const colorMap: Record<LEDColor, string> = {
  verdigris: "bg-[var(--verdigris)] shadow-[0_0_8px_rgba(71,119,95,0.4)]",
  ochre: "bg-[var(--ochre)] shadow-[0_0_8px_rgba(197,138,67,0.4)]",
  madder: "bg-[var(--madder)] shadow-[0_0_8px_rgba(176,82,94,0.4)]",
  cornflower: "bg-[var(--cornflower)] shadow-[0_0_8px_rgba(134,169,217,0.4)]",
  faint: "bg-[var(--faint)]",
};

export const LED: React.FC<LEDProps> = ({
  color,
  status,
  size = 8,
  live = false,
  className = "",
  title,
}) => {
  let resolvedColor: LEDColor = color || "verdigris";
  if (!color && status) {
    if (status === "online") resolvedColor = "verdigris";
    else if (status === "warning") resolvedColor = "ochre";
    else if (status === "error" || status === "offline" || status === "fail") resolvedColor = "madder";
    else resolvedColor = "faint";
  }

  const isFail = resolvedColor === "madder" && (status === "offline" || status === "error" || status === "fail" || live);

  return (
    <span
      title={title}
      style={{ width: `${size}px`, height: `${size}px` }}
      className={`inline-block rounded-full flex-shrink-0 transition-opacity duration-200 ${colorMap[resolvedColor]} ${
        isFail ? "animate-led-fail" : live ? "animate-breathe" : ""
      } ${className}`}
    />
  );
};
