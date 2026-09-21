import React, { useState, useCallback } from "react";
import { governor } from "../quality";
import { isReducedMotion } from "../features";
import { playDetent, isAudioEnabled } from "../audio";

export interface DetentPressProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  asChild?: boolean;
  haptic?: boolean;
  className?: string;
}

/**
 * DetentPress primitive (§M4.7, §M5.4, WS-4)
 * Snappy physical spring micro-feedback for interactive surfaces.
 * Scale 0.985, translateY 1px on press, returns with firm detent.
 */
export const DetentPress: React.FC<DetentPressProps> = ({
  children,
  haptic = true,
  className = "",
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  ...props
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const tier = governor.getState().tier;
      if (!isReducedMotion() && tier !== "T0") {
        setIsPressed(true);
        if (haptic && isAudioEnabled()) {
          playDetent();
        }
      }
      onPointerDown?.(e);
    },
    [haptic, onPointerDown]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      setIsPressed(false);
      onPointerUp?.(e);
    },
    [onPointerUp]
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      setIsPressed(false);
      onPointerLeave?.(e);
    },
    [onPointerLeave]
  );

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      className={`transition-transform duration-[var(--m-micro)] ease-[var(--ease-detent)] select-none ${
        isPressed ? "scale-[0.985] translate-y-[1px]" : "scale-100 translate-y-0"
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
