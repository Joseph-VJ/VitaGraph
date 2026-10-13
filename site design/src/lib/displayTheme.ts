import type { Theme } from "./preferences";

// Presentation copies only: the originals remain the source for downloads and printing.
function recolorSvg(svg: Element): void {
  const root = getComputedStyle(document.documentElement);
  const color = (name: string) => root.getPropertyValue(name).trim();
  const palette: Record<string, string> = {
    [color("--document-ink")]: color("--color-text"),
    [color("--document-grid")]: color("--line-control"),
    [color("--document-band")]: color("--color-surface"),
    [color("--document-muted")]: color("--color-neutral-700"),
    [color("--document-bg")]: color("--color-bg"),
  };
  for (const element of [svg, ...svg.querySelectorAll("*")]) {
    for (const attribute of ["fill", "stroke"]) {
      const value = element.getAttribute(attribute)?.toLowerCase();
      if (!value) continue;
      const replacement = value === color("--document-accent") && element.localName === "text" ? color("--color-accent-700") : palette[value];
      if (replacement) element.setAttribute(attribute, replacement);
    }
  }
}

export function svgForDisplay(svg: string, theme: Theme): string {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (doc.querySelector("parsererror") || doc.documentElement.localName !== "svg") return svg;
  if (theme === "dark") recolorSvg(doc.documentElement);
  else {
    const root = getComputedStyle(document.documentElement);
    const red = root.getPropertyValue("--document-accent").trim();
    doc.querySelectorAll("text").forEach((text) => {
      if (text.getAttribute("fill")?.toLowerCase() === red) text.setAttribute("fill", root.getPropertyValue("--color-accent-700").trim());
    });
  }
  return new XMLSerializer().serializeToString(doc.documentElement);
}

export function reportForDisplay(html: string): string {
  if (!html) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const style = doc.createElement("style");
  style.dataset.displayTheme = "adaptive";
  const root = getComputedStyle(document.documentElement);
  const color = (name: string) => root.getPropertyValue(name).trim();
  style.textContent = `
    html { color-scheme: light dark; }
    svg text[fill="${color("--document-accent")}"] { fill: ${color("--preview-light-accent")}; }
    @media (prefers-color-scheme: dark) {
      html, body { background: ${color("--preview-dark-bg")}; color: ${color("--preview-dark-text")}; }
      .brand { color: ${color("--preview-dark-accent")}; }
      h2, th { border-color: ${color("--preview-dark-text")}; }
      td, .footer { border-color: ${color("--preview-dark-rule")}; }
      .meta, .quote, .footer { color: ${color("--preview-dark-muted")}; }
      svg [fill="${color("--document-ink")}"] { fill: ${color("--preview-dark-text")}; }
      svg [stroke="${color("--document-ink")}"], svg [stroke="${color("--document-grid")}"] { stroke: ${color("--preview-dark-rule")}; }
      svg [fill="${color("--document-grid")}"] { fill: ${color("--preview-dark-rule")}; }
      svg [fill="${color("--document-band")}"] { fill: ${color("--preview-dark-surface")}; }
      svg [fill="${color("--document-bg")}"] { fill: ${color("--preview-dark-bg")}; }
      svg [fill="${color("--document-muted")}"] { fill: ${color("--preview-dark-muted")}; }
      svg text[fill="${color("--document-accent")}"] { fill: ${color("--preview-dark-accent")}; }
    }
  `;
  doc.head.appendChild(style);
  return "<!doctype html>" + doc.documentElement.outerHTML;
}
