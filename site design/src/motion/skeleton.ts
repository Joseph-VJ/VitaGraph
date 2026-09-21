/**
 * VitaGraph Motion Engine — Unified Skeleton-to-Content Crossfade Helper (§7.14-C)
 * Coordinates a smooth .m-exit on skeleton -> .m-enter on content transition
 * via Sequence without layout shift. Settle instantly under reduced motion or T0.
 */

import React, { useState, useEffect, useRef } from "react";
import { governor } from "./quality";
import { isReducedMotion } from "./features";
import { Sequence, scheduleFor } from "./sequence";

export interface CrossfadeOptions {
  durationMs?: number; // default 180ms (--m-quick)
  id?: string;
}

export interface SkeletonCrossfadeState {
  showSkeleton: boolean;
  showContent: boolean;
  skeletonClassName: string;
  contentClassName: string;
}

/**
 * useSkeletonCrossfade hook
 * Manages dual-phase crossfade state between loading skeleton and loaded content.
 */
export function useSkeletonCrossfade(
  loading: boolean,
  options?: CrossfadeOptions
): SkeletonCrossfadeState {
  const [renderContent, setRenderContent] = useState(!loading);
  const [isExitingSkeleton, setIsExitingSkeleton] = useState(false);
  const durationMs = options?.durationMs ?? 180;
  const seqId = options?.id ?? "skeleton-crossfade";
  const prevLoadingRef = useRef(loading);

  useEffect(() => {
    const isT0 = governor.getState().tier === "T0" || isReducedMotion();

    if (prevLoadingRef.current && !loading) {
      // Transition: loading -> loaded
      if (isT0) {
        setRenderContent(true);
        setIsExitingSkeleton(false);
      } else {
        setIsExitingSkeleton(true);
        const seq = new Sequence()
          .wait(durationMs)
          .addAction(() => {
            setRenderContent(true);
            setIsExitingSkeleton(false);
          });
        scheduleFor(seqId, seq);
        seq.play();
      }
    } else if (!prevLoadingRef.current && loading) {
      // Transition: loaded -> loading
      setRenderContent(false);
      setIsExitingSkeleton(false);
    }

    prevLoadingRef.current = loading;
  }, [loading, durationMs, seqId]);

  return {
    showSkeleton: !renderContent,
    showContent: renderContent,
    skeletonClassName: isExitingSkeleton ? "m-exit pointer-events-none" : "",
    contentClassName: renderContent ? "m-enter" : "hidden",
  };
}

export interface CrossfadeContainerProps {
  loading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
  testId?: string;
}

/**
 * CrossfadeContainer component
 * Binds skeleton and content into a CLS-safe reserved box with zero layout shift.
 */
export const CrossfadeContainer: React.FC<CrossfadeContainerProps> = ({
  loading,
  skeleton,
  children,
  className = "",
  id,
  testId,
}) => {
  const { showSkeleton, showContent, skeletonClassName, contentClassName } =
    useSkeletonCrossfade(loading, { id });

  return React.createElement(
    "div",
    { className: `relative ${className}`, "data-testid": testId },
    showSkeleton
      ? React.createElement(
          "div",
          { className: `w-full ${skeletonClassName}` },
          skeleton
        )
      : null,
    showContent
      ? React.createElement(
          "div",
          { className: `w-full ${contentClassName}` },
          children
        )
      : null
  );
};

/**
 * crossfadeSkeleton imperative DOM function (§7.14-C, C3)
 * .m-exit on skeleton -> chained .m-enter on content via Sequence.
 * Settle instantly under reduced motion or T0.
 */
export function crossfadeSkeleton(
  skeletonEl: HTMLElement | null,
  contentEl: HTMLElement | null,
  options?: { durationMs?: number; onComplete?: () => void }
): void {
  if (!skeletonEl && !contentEl) {
    options?.onComplete?.();
    return;
  }
  const isT0 = governor.getState().tier === "T0" || isReducedMotion();
  const duration = options?.durationMs ?? 180;

  if (isT0) {
    if (skeletonEl) skeletonEl.style.display = "none";
    if (contentEl) {
      contentEl.style.display = "";
      contentEl.classList.remove("hidden");
    }
    options?.onComplete?.();
    return;
  }

  if (skeletonEl) {
    skeletonEl.classList.add("m-exit");
  }

  new Sequence()
    .wait(duration)
    .addAction(() => {
      if (skeletonEl) {
        skeletonEl.style.display = "none";
        skeletonEl.classList.remove("m-exit");
      }
      if (contentEl) {
        contentEl.style.display = "";
        contentEl.classList.remove("hidden");
        contentEl.classList.add("m-enter");
      }
      options?.onComplete?.();
    })
    .play();
}


