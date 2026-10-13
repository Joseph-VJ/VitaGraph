import React from "react";
import type { PreviewSpan } from "../../api/privacy";
import { PLACEHOLDER_RE, typeWord } from "../../lib/privacyFormat";

type MaskedTextProps =
  | { mode: "masked"; text: string; testId?: string }
  | { mode: "original"; text: string; spans: PreviewSpan[]; testId?: string };

const chipStyle: React.CSSProperties = {
  background: "var(--color-surface)",
  borderLeft: "3px solid var(--color-accent)",
  padding: "0 4px",
  fontWeight: 800,
  fontVariantNumeric: "tabular-nums",
};

const typeLabelStyle: React.CSSProperties = {
  marginLeft: 4,
  fontSize: "0.6875rem",
  fontWeight: 800,
  textTransform: "uppercase",
  color: "var(--color-accent-700)",
};

// A line of masked text: placeholders such as [PERSON_1] become chips.
function maskedLine(line: string, keyBase: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  const re = new RegExp(PLACEHOLDER_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(line)) !== null) {
    if (match.index > last) parts.push(line.slice(last, match.index));
    parts.push(
      <span key={`${keyBase}_${match.index}`} data-testid="masked-chip" title="Hidden on this computer before sending" style={chipStyle}>
        {match[0]}
      </span>
    );
    last = match.index + match[0].length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}

export const MaskedText: React.FC<MaskedTextProps> = (props) => {
  const baseStyle: React.CSSProperties = {
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    fontSize: "0.9375rem",
    lineHeight: 1.6,
    margin: 0,
  };

  if (props.mode === "original") {
    const { text } = props;
    const spans = [...props.spans].sort((a, b) => a.start - b.start);
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    spans.forEach((span, index) => {
      if (span.start < cursor || span.end > text.length || span.end <= span.start) return;
      if (span.start > cursor) nodes.push(text.slice(cursor, span.start));
      nodes.push(
        <span key={`s_${index}`} data-testid="original-span">
          <span style={{ background: "var(--color-accent-100)", boxShadow: "inset 0 -2px 0 var(--color-accent)" }}>
            {text.slice(span.start, span.end)}
          </span>
          <span style={typeLabelStyle}>{typeWord(span.type, 1)}</span>
        </span>
      );
      cursor = span.end;
    });
    if (cursor < text.length) nodes.push(text.slice(cursor));
    return (
      <div data-testid={props.testId} style={baseStyle}>
        {nodes}
      </div>
    );
  }

  const lines = props.text.split("\n");
  return (
    <div data-testid={props.testId} style={baseStyle}>
      {lines.map((line, index) => {
        const heading = line.startsWith("## ");
        return (
          <React.Fragment key={index}>
            {heading ? (
              <span style={{ fontWeight: 800 }}>{maskedLine(line, `l${index}`)}</span>
            ) : (
              maskedLine(line, `l${index}`)
            )}
            {index < lines.length - 1 ? "\n" : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};
