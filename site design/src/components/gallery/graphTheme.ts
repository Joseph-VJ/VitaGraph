// Shared colour and type rules for the dark knowledge-graph viewport.
// Communities are the story of this graph (modularity), so colour encodes community;
// node type is shown in the node card and the groups list instead.

export const COMMUNITY_PALETTE = [
  "#6FC3D4", // sky teal
  "#82D3A2", // mint
  "#E8B067", // bronze
  "#B79CE8", // lilac
  "#F08E9A", // coral
  "#8FA8F0", // periwinkle
  "#CBDC66", // lime
  "#E6E0D0", // bone
] as const;

export function communityColor(community: number | undefined, fallback: string): string {
  if (community === undefined || community < 0) return fallback;
  return COMMUNITY_PALETTE[community % COMMUNITY_PALETTE.length];
}

const rgbCache = new Map<string, [number, number, number]>();

function parseHex(hex: string): [number, number, number] {
  let rgb = rgbCache.get(hex);
  if (!rgb) {
    const h = hex.replace("#", "");
    rgb = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    rgbCache.set(hex, rgb);
  }
  return rgb;
}

/** "#RRGGBB" + alpha -> "rgba(r,g,b,a)". Parsed values are cached; this runs per edge per frame. */
export function rgba(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

/** Linear mix of two "#RRGGBB" colours, t = 0 gives a, t = 1 gives b. */
export function mixHex(a: string, b: string, t: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  const m = (i: number) => Math.round(x[i] + (y[i] - x[i]) * t);
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(m(0))}${toHex(m(1))}${toHex(m(2))}`;
}

export const lighten = (hex: string, t: number) => mixHex(hex, "#FFFFFF", t);
export const darken = (hex: string, t: number) => mixHex(hex, "#000000", t);

// Types worth listing as "concepts". The rest are structural: chunks, sections, markers, reports.
export const CONCEPT_TYPES = new Set(["test", "biomarker", "condition", "category", "treatment", "outcome"]);
export const STRUCTURAL_TYPES = new Set(["chunk", "section", "uncertainty", "report"]);
// Text-level nodes: the pieces of report text the graph was built from. They are real,
// but a person reading the graph cares about concepts, so the view can hide them.
export const FRAGMENT_TYPES = new Set(["chunk", "section", "uncertainty"]);

export const isFragmentType = (type?: string) => FRAGMENT_TYPES.has((type || "").toLowerCase());
export const isStructuralType = (type?: string) => STRUCTURAL_TYPES.has((type || "").toLowerCase());

/** Plain-language label for the canvas. The raw label stays available in the node card. */
export function displayLabel(node: { label?: string; id: string; type?: string }): string {
  const type = (node.type || "").toLowerCase();
  const raw = (node.label || node.id || "").trim();
  if (type === "person") return "Your records";
  if (/^unknown date$/i.test(raw)) return "Undated";
  if (type === "report") {
    return raw
      .replace(/\s*\([^)]*\)\s*$/, "")
      .replace(/\.pdf$/i, "")
      .replace(/^VitaGraph[-_ ]/i, "");
  }
  return raw;
}
