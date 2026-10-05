import React from "react";

export type TagTone =
  | "done"
  | "running"
  | "waiting"
  | "failed"
  | "hot"
  | "accent"
  | "neutral"
  | "uncertain";

export interface TagProps {
  tone: TagTone;
  children: React.ReactNode;
  testId?: string;
  title?: string;
}

export const Tag: React.FC<TagProps> = ({ tone, children, testId, title }) => {
  let background = "var(--color-neutral-200)";
  let color = "var(--color-neutral-800)";
  let fontWeight: number | undefined = undefined;

  switch (tone) {
    case "done":
      background = "var(--color-text)";
      color = "var(--color-bg)";
      fontWeight = 800;
      break;
    case "running":
    case "hot":
      background = "var(--color-accent)";
      color = "var(--color-bg)";
      fontWeight = 800;
      break;
    case "failed":
    case "accent":
      background = "var(--color-accent-100)";
      color = "var(--color-accent-800)";
      fontWeight = 800;
      break;
    case "waiting":
    case "neutral":
      background = "var(--color-neutral-200)";
      color = "var(--color-neutral-800)";
      break;
    case "uncertain":
      background = "color-mix(in srgb, var(--ochre) 22%, var(--color-bg))";
      color = "var(--ochre-ink)";
      fontWeight = 800;
      break;
  }

  return (
    <span
      className="tag"
      data-tone={tone}
      data-testid={testId}
      title={title}
      style={{
        whiteSpace: "nowrap",
        background,
        color,
        fontWeight,
      }}
    >
      {children}
    </span>
  );
};
