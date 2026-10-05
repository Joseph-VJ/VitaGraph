// Text -> graph extraction for the Text to Graph tool.
// Pure functions, no React, no network: everything is derived from the text itself.
import type { NodeKind } from "./layout3d";

export type EntityKind = "Value" | "Date" | "Name" | "Term" | "Keyword";

export interface TextGraphNode {
  id: string;
  k: NodeKind;
  label: string;
  pos: [number, number, number];
  about: string;
}

export interface Entity {
  id: string;
  label: string;
  kind: EntityKind;
  mentions: number;
  start: number;
  end: number;
  snippet: string;
  of?: string;
}

export interface TextGraph {
  nodes: TextGraphNode[];
  edges: [string, string][];
  entities: Entity[];
  date: string | null;
}

const MAX_ENTITIES = 40;
const MAX_SENTENCE_NODES = 10;
const MAX_KEYWORD_TOTAL = 12;
const MIN_ENTITIES_BEFORE_KEYWORDS = 8;
const GOLDEN = 2.399963;

// ---------------------------------------------------------------- word lists

const STOP_WORDS = new Set(
  (
    "a an the and or but if then else of at by for with about against between into through during before after " +
    "above below to from up down in out on off over under again further once here there when where why how all any " +
    "both each few more most other some such no nor not only own same so than too very can will just should now " +
    "is am are was were be been being have has had having do does did doing i me my we our you your he him his she " +
    "her it its they them their what which who whom this that these those would could may might must shall also " +
    "while because until upon per via yet still even ever never always often really much many one two three " +
    "said says say get got gets like make made went go goes come came take took give gave let " +
    "every each another near toward towards besides years year later around become became become becomes"
  ).split(/\s+/)
);

// capitalised only because they open a sentence
const OPENERS = new Set(
  (
    "yesterday today tomorrow however therefore moreover meanwhile finally first second third next last later " +
    "suddenly maybe perhaps please thanks thank hello dear regards sincerely note report date reference ref range " +
    "result results patient name age sex gender page summary"
  ).split(/\s+/)
);

const LEXICON = [
  // biomarkers and measurements
  "hemoglobin", "haemoglobin", "hba1c", "glucose", "fasting glucose", "blood sugar", "cholesterol", "hdl", "ldl",
  "triglycerides", "tsh", "thyroid", "creatinine", "urea", "bilirubin", "albumin", "ferritin", "iron", "calcium",
  "sodium", "potassium", "platelet", "hematocrit", "wbc", "rbc", "vitamin d", "vitamin b12", "vitamin c",
  "blood pressure", "bp", "heart rate", "pulse", "bmi", "weight", "hemoglobin a1c",
  // conditions
  "diabetes", "hypertension", "anemia", "anaemia", "asthma", "fever", "infection", "obesity", "arthritis",
  "cancer", "hypothyroidism", "hyperthyroidism", "jaundice", "pneumonia", "migraine", "allergy", "depression",
  "anxiety", "stroke", "ulcer", "covid", "flu",
  // symptoms
  "fatigue", "headache", "cough", "pain", "chest pain", "nausea", "dizziness", "vomiting", "rash", "swelling",
  "insomnia", "weakness", "breathlessness", "diarrhea", "diarrhoea",
  // drugs
  "metformin", "paracetamol", "insulin", "aspirin", "atorvastatin", "amoxicillin", "omeprazole", "ibuprofen",
  "levothyroxine", "amlodipine", "azithromycin", "antibiotic", "statin",
  // care words
  "diet", "exercise", "surgery", "scan", "ct scan", "x-ray", "mri", "ecg", "ekg", "biopsy", "ultrasound",
  "blood test", "vaccine", "therapy", "prescription", "medication", "dose", "tablet", "diagnosis", "treatment",
];

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";
const MONTH_ANY = `(?:${MONTHS}|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)`;

const UNITS = [
  "mmol/L", "mEq/L", "uIU/mL", "µIU/mL", "mIU/L", "µg/dL", "ng/mL", "pg/mL", "ng/dL", "ug/dL", "mg/dL", "g/dL",
  "IU/L", "U/L", "/µL", "/uL", "mmHg", "mcg", "bpm", "kg", "cm", "mg", "mL", "ml", "fL", "pg", "g", "%", "°C", "°F",
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&");

const DATE_RE = new RegExp(
  [
    "\\b\\d{4}-\\d{2}-\\d{2}\\b",
    "\\b\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}\\b",
    `\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_ANY}\\.?,?\\s+\\d{4}\\b`,
    `\\b${MONTH_ANY}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b`,
    `\\b${MONTH_ANY}\\.?\\s+\\d{4}\\b`,
    `\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:${MONTHS})\\b`,
    `\\b(?:${MONTHS})\\b`,
  ].join("|"),
  "g"
);

const VALUE_RE = new RegExp(
  `(?<![\\w.])(\\d+(?:[.,]\\d+)?(?:\\/\\d+)?)\\s*(${UNITS.map(escapeRe).join("|")})(?![A-Za-z])`,
  "g"
);

const lexAlt = [...LEXICON].sort((a, b) => b.length - a.length).map(escapeRe).join("|");
const LEX_RE = new RegExp(`(?<![A-Za-z0-9])(${lexAlt})(?:es|s)?(?![A-Za-z0-9])`, "gi");
const LEX_TEST = new RegExp(`(?<![A-Za-z0-9])(?:${lexAlt})(?:es|s)?(?![A-Za-z0-9])`, "i");
const LEX_SET = new Set(LEXICON);

const RUN_RE =
  /(?:(?:Dr|Mr|Mrs|Ms|Prof)\.?\s+)?[A-Z][A-Za-z0-9'’-]*(?:\s+[A-Z][A-Za-z0-9'’-]*)*/g;
const TITLE_RE = /^(?:Dr|Mr|Mrs|Ms|Prof)\.?$/;
const GAP_FILLER = new Set(
  "is was of at level levels value count reading measured about around approximately to be are were had has shows showed only".split(
    " "
  )
);
const FALLBACK_NAME_RE =
  /([A-Z][A-Za-z0-9'’-]*(?:\s+[A-Z][A-Za-z0-9'’-]*){0,2})\s*[:=\-–(]?\s*(?:[\d.,\-–/]+\s*)*$/;
const ABBREVIATIONS = new Set(["dr", "mr", "mrs", "ms", "st", "prof", "sr", "jr", "vs", "e.g", "i.e", "approx"]);

// ---------------------------------------------------------------- sentences

interface Sentence {
  start: number;
  end: number;
  text: string;
}

function isAbbreviation(text: string, sentStart: number, dotIdx: number): boolean {
  const tail = text.slice(Math.max(sentStart, dotIdx - 12), dotIdx);
  const m = tail.match(/([A-Za-z.]+|\d+)$/);
  if (!m) return false;
  const tok = m[1].toLowerCase();
  if (ABBREVIATIONS.has(tok)) return true;
  // list numbering such as "1. Item"
  return /^\d+$/.test(tok) && text.slice(sentStart, dotIdx).trim() === m[1];
}

export function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  const n = text.length;
  let start = 0;
  const push = (a: number, b: number) => {
    while (a < b && /\s/.test(text[a])) a++;
    while (b > a && /\s/.test(text[b - 1])) b--;
    if (b > a) out.push({ start: a, end: b, text: text.slice(a, b) });
  };
  for (let i = 0; i < n; i++) {
    const c = text[i];
    if (c === "\n") {
      push(start, i);
      start = i + 1;
    } else if (c === "." || c === "!" || c === "?") {
      let j = i;
      while (j + 1 < n && /[.!?]/.test(text[j + 1])) j++;
      let k = j + 1;
      while (k < n && /["'”’)\]]/.test(text[k])) k++;
      if (k >= n || /\s/.test(text[k])) {
        if (c === "." && j === i && isAbbreviation(text, start, i)) {
          i = j;
          continue;
        }
        push(start, k);
        start = k;
        i = k - 1;
      } else {
        i = j;
      }
    }
  }
  push(start, n);
  return out;
}

// ---------------------------------------------------------------- entities

interface Ent {
  id: string;
  key: string;
  label: string;
  kind: EntityKind;
  mentions: number;
  start: number;
  end: number;
  sents: Set<number>;
  parentKey?: string;
}

interface NameMention {
  a: number;
  b: number;
  key: string;
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

function kindToNode(kind: EntityKind): NodeKind {
  return kind === "Value" ? "meas" : kind === "Date" ? "report" : "bio";
}

function snippetAround(text: string, a: number, b: number): string {
  const from = Math.max(0, a - 30);
  const to = Math.min(text.length, b + 30);
  return `${from > 0 ? "…" : ""}${squash(text.slice(from, to))}${to < text.length ? "…" : ""}`;
}

function unit(v: [number, number, number]): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]);
  return l < 1e-6 ? [0, 1, 0] : [v[0] / l, v[1] / l, v[2] / l];
}

function cross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function fibonacci(i: number, n: number, r: number): [number, number, number] {
  const y = n > 1 ? 1 - (2 * (i + 0.5)) / n : 0;
  const rad = Math.sqrt(Math.max(0, 1 - y * y));
  const th = i * GOLDEN + 0.4;
  return [Math.cos(th) * rad * r, y * r, Math.sin(th) * rad * r];
}

export function extractGraph(rawText: string): TextGraph {
  const text = rawText ?? "";
  const sents = splitSentences(text);
  const used = new Uint8Array(text.length);
  const ents = new Map<string, Ent>();
  let date: string | null = null;

  // words that appear capitalised mid-sentence, lowercase anywhere, or capitalised at 2+ sentence starts
  const firstTokenAt = new Set<number>();
  for (const s of sents) firstTokenAt.add(s.start);
  const capElsewhere = new Map<string, number>();
  const lowerSeen = new Set<string>();
  for (const m of text.matchAll(/[A-Za-z][A-Za-z'’-]*/g)) {
    const w = m[0];
    const lw = w.toLowerCase();
    if (/^[A-Z]/.test(w)) {
      capElsewhere.set(lw, (capElsewhere.get(lw) ?? 0) + (firstTokenAt.has(m.index!) ? 0.5 : 1));
    } else {
      lowerSeen.add(lw);
    }
  }

  const masked = (s: Sentence) => {
    let out = "";
    for (let i = s.start; i < s.end; i++) out += used[i] ? "\u0001" : text[i];
    return out;
  };
  const mark = (a: number, b: number) => used.fill(1, a, b);

  const mention = (
    key: string,
    label: string,
    kind: EntityKind,
    a: number,
    b: number,
    si: number,
    parentKey?: string
  ) => {
    const full = parentKey ? `${key}|${parentKey}` : key;
    const found = ents.get(full);
    if (found) {
      found.mentions++;
      found.sents.add(si);
      return;
    }
    ents.set(full, {
      id: "",
      key: full,
      label,
      kind,
      mentions: 1,
      start: a,
      end: b,
      sents: new Set([si]),
      parentKey,
    });
  };

  const hasLexicon = (s: string) => LEX_TEST.test(s);

  sents.forEach((s, si) => {
    const base = s.start;

    // 1. dates
    let sub = masked(s);
    DATE_RE.lastIndex = 0;
    for (const m of sub.matchAll(DATE_RE)) {
      const raw = m[0];
      const a = m.index!;
      if (/^[A-Za-z]+$/.test(raw) && raw === "May" && !/\b(?:in|on|of|since|during|by|until|from|early|late|mid|next|last)\s+$/i.test(sub.slice(0, a))) {
        continue;
      }
      const label = squash(raw);
      mark(base + a, base + a + raw.length);
      mention(`date|${label.toLowerCase()}`, label, "Date", base + a, base + a + raw.length, si);
      if (!date && /\d{4}|\//.test(raw)) date = label;
    }

    // 2. values (resolved against names later)
    sub = masked(s);
    const values: { a: number; b: number; label: string }[] = [];
    for (const m of sub.matchAll(VALUE_RE)) {
      const a = m.index!;
      const b = a + m[0].length;
      const num = m[1];
      const u = m[2];
      values.push({ a, b, label: u === "%" ? `${num}%` : u.startsWith("/") ? `${num} ${u}` : `${num} ${u}` });
      mark(base + a, base + b);
    }

    // 3. capitalised runs: names, places, organisations (or terms when they hold a lexicon word)
    sub = masked(s);
    const names: NameMention[] = [];
    const firstNonSpace = sub.search(/\S/);
    for (const m of sub.matchAll(RUN_RE)) {
      const start = m.index!;
      const toks = [...m[0].matchAll(/\S+/g)].map((t) => ({ t: t[0], off: start + t.index! }));
      const initial = start === firstNonSpace;
      let lead = 0;
      if (toks[0] && TITLE_RE.test(toks[0].t)) lead = 1;
      else {
        while (
          lead < toks.length &&
          (STOP_WORDS.has(toks[lead].t.toLowerCase()) || (initial && OPENERS.has(toks[lead].t.toLowerCase())))
        ) {
          lead++;
        }
      }
      let end = toks.length;
      const kept = toks.slice(lead, end);
      if (kept.length === 0 || (lead === 1 && TITLE_RE.test(toks[0].t) && kept.length === 0)) continue;
      const lastTok = toks[end - 1];
      const labelEnd = lastTok.off + lastTok.t.replace(/['’]s$/i, "").length;
      const labelStart = TITLE_RE.test(toks[0].t) ? toks[0].off : toks[lead].off;
      let label = sub.slice(labelStart, labelEnd).replace(/-+$/, "");
      const words = kept.filter((k) => !TITLE_RE.test(k.t));
      if (words.length === 0) continue;
      const lone = words.length === 1 ? words[0].t.replace(/['’]s$/i, "") : "";
      const lw = lone.toLowerCase();
      if (words.length === 1) {
        if (lone.length < 2) continue;
        if (STOP_WORDS.has(lw)) continue;
        if (initial && !hasLexicon(lone)) {
          const ok =
            (capElsewhere.get(lw) ?? 0) >= 1 ||
            (!OPENERS.has(lw) && lone.length >= 3 && !/(?:ed|ing)$/i.test(lone) && !lowerSeen.has(lw));
          if (!ok) continue;
        }
      }
      end = lead + kept.length;
      label = squash(label);
      const isTerm = hasLexicon(label);
      const key = words.length === 1 && LEX_SET.has(lw.replace(/(?:es|s)$/, "")) ? lw.replace(/(?:es|s)$/, "") : label.toLowerCase();
      const a = labelStart;
      const b = labelStart + label.length;
      mark(base + a, base + b);
      names.push({ a, b, key });
      mention(key, label, isTerm ? "Term" : "Name", base + a, base + b, si);
    }

    // 4. lexicon words in lower case
    sub = masked(s);
    for (const m of sub.matchAll(LEX_RE)) {
      const a = m.index!;
      const b = a + m[0].length;
      const key = m[1].toLowerCase();
      mark(base + a, base + b);
      names.push({ a, b, key });
      mention(key, m[0], "Term", base + a, base + b, si);
    }
    names.sort((x, y) => x.a - y.a);

    // 5. attach every value to the nearest preceding name
    sub = masked(s);
    for (const v of values) {
      let parent: string | undefined;
      let cand: NameMention | undefined;
      for (const n of names) if (n.b <= v.a) cand = n;
      if (cand) {
        const gap = sub
          .slice(cand.b, v.a)
          .replace(/[\d.,:=\-–()/\s]+/g, " ")
          .split(" ")
          .filter((w) => w && !GAP_FILLER.has(w.toLowerCase()));
        if (gap.length === 0) parent = cand.key;
      }
      if (!parent) {
        const fb = sub.slice(0, v.a).match(FALLBACK_NAME_RE);
        if (fb) {
          const toks = [...fb[1].matchAll(/\S+/g)].filter((t) => !STOP_WORDS.has(t[0].toLowerCase()) && !OPENERS.has(t[0].toLowerCase()));
          if (toks.length) {
            const a = fb.index! + fb[0].indexOf(toks[0][0]);
            const last = toks[toks.length - 1];
            const b = fb.index! + fb[0].indexOf(fb[1]) + last.index! + last[0].length;
            const label = squash(sub.slice(a, b));
            if (label.length >= 2) {
              const kind: EntityKind = hasLexicon(label) ? "Term" : "Name";
              const key = label.toLowerCase();
              mark(base + a, base + b);
              names.push({ a, b, key });
              mention(key, label, kind, base + a, base + b, si);
              parent = key;
            }
          }
        }
      }
      mention(`val|${v.label.toLowerCase()}`, v.label, "Value", base + v.a, base + v.b, si, parent);
    }
  });

  // 6. keywords: guarantees a graph for any text
  if (ents.size < MIN_ENTITIES_BEFORE_KEYWORDS) {
    const words = new Map<string, { count: number; first: number; label: string; spots: { si: number; a: number; b: number }[] }>();
    sents.forEach((s, si) => {
      const sub = masked(s);
      for (const m of sub.matchAll(/[A-Za-z][A-Za-z'’-]{3,}/g)) {
        const label = m[0].replace(/['’]s$/i, "").replace(/-+$/, "");
        const lw = label.toLowerCase();
        if (label.length < 4 || STOP_WORDS.has(lw) || OPENERS.has(lw)) continue;
        const w = words.get(lw) ?? { count: 0, first: s.start + m.index!, label, spots: [] };
        w.count++;
        w.spots.push({ si, a: s.start + m.index!, b: s.start + m.index! + label.length });
        words.set(lw, w);
      }
    });
    const room = MAX_KEYWORD_TOTAL - ents.size;
    const top = [...words.entries()]
      .filter(([k]) => !ents.has(k))
      .sort((x, y) => y[1].count - x[1].count || x[1].first - y[1].first)
      .slice(0, room);
    for (const [k, w] of top) for (const sp of w.spots) mention(k, w.label, "Keyword", sp.a, sp.b, sp.si);
  }

  // cap entities: most mentioned first, then earliest
  const kept = [...ents.values()]
    .sort((x, y) => y.mentions - x.mentions || x.start - y.start)
    .slice(0, MAX_ENTITIES)
    .sort((x, y) => x.start - y.start);
  kept.forEach((e, i) => (e.id = `e${i}`));
  const byKey = new Map(kept.map((e) => [e.key, e]));
  const parentOf = (e: Ent): Ent | undefined => (e.parentKey ? byKey.get(e.parentKey) : undefined);

  // sentence group nodes
  const perSentence = new Map<number, Ent[]>();
  for (const e of kept) for (const si of e.sents) perSentence.set(si, [...(perSentence.get(si) ?? []), e]);
  const sentenceIdx = [...perSentence.entries()]
    .filter(([, list]) => list.length >= 2)
    .sort((x, y) => y[1].length - x[1].length || x[0] - y[0])
    .slice(0, MAX_SENTENCE_NODES)
    .map(([si]) => si)
    .sort((x, y) => x - y);
  const sentId = new Map(sentenceIdx.map((si, i) => [si, `s${i}`]));

  const nodes: TextGraphNode[] = [{ id: "d", k: "person", label: "Document", pos: [0, 0, 0], about: "The text you pasted." }];
  const edges: [string, string][] = [];
  const seen = new Set<string>();
  const addEdge = (a: string, b: string) => {
    if (a === b) return;
    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(k)) return;
    seen.add(k);
    edges.push([a, b]);
  };

  // positions
  const sentPos = new Map<number, [number, number, number]>();
  sentenceIdx.forEach((si, i) => {
    const ang = (2 * Math.PI * i) / sentenceIdx.length + 0.35;
    const y = ((i * 0.618) % 1 - 0.5) * 0.3;
    sentPos.set(si, [Math.cos(ang) * 0.45, y, Math.sin(ang) * 0.45]);
  });
  sentenceIdx.forEach((si) => {
    const s = sents[si];
    const words = s.text.split(/\s+/).slice(0, 4).join(" ");
    const about = s.text.length > 160 ? `${s.text.slice(0, 160)}…` : s.text;
    nodes.push({ id: sentId.get(si)!, k: "section", label: `${words}…`, pos: sentPos.get(si)!, about });
    addEdge("d", sentId.get(si)!);
  });

  const pos = new Map<string, [number, number, number]>();
  const ordinal = new Map<number, number>();
  const loose = kept.filter((e) => !parentOf(e) && ![...e.sents].some((si) => sentId.has(si)));
  const placeNear = (e: Ent): [number, number, number] => {
    const mine = [...e.sents].filter((si) => sentPos.has(si));
    let sum: [number, number, number] = [0, 0, 0];
    for (const si of mine) {
      const sp = sentPos.get(si)!;
      const u = unit([sp[0], sp[1] * 3, sp[2]]);
      sum = [sum[0] + u[0], sum[1] + u[1], sum[2] + u[2]];
    }
    if (Math.hypot(sum[0], sum[1], sum[2]) < 0.2) {
      const sp = sentPos.get(mine[0])!;
      sum = unit([sp[0], sp[1] * 3, sp[2]]);
    }
    const u = unit(sum);
    const first = mine[0];
    const idx = ordinal.get(first) ?? 0;
    ordinal.set(first, idx + 1);
    const t1 = unit(cross(u, [0, 1, 0]));
    const t2 = cross(u, t1);
    const ang = idx * GOLDEN;
    const off = Math.min(0.35, 0.14 + 0.05 * idx);
    const r = mine.length > 1 ? 0.72 : 0.84;
    return [
      u[0] * r + (t1[0] * Math.cos(ang) + t2[0] * Math.sin(ang)) * off,
      u[1] * r + (t1[1] * Math.cos(ang) + t2[1] * Math.sin(ang)) * off,
      u[2] * r + (t1[2] * Math.cos(ang) + t2[2] * Math.sin(ang)) * off,
    ];
  };
  const looseIdx = new Map(loose.map((e, i) => [e.id, i]));
  for (const e of kept) {
    if (parentOf(e)) continue;
    if ([...e.sents].some((si) => sentPos.has(si))) pos.set(e.id, placeNear(e));
    else pos.set(e.id, fibonacci(looseIdx.get(e.id)!, loose.length, 0.85));
  }
  let valueN = 0;
  for (const e of kept) {
    const p = parentOf(e);
    if (!p) continue;
    const pp = pos.get(p.id)!;
    const ang = valueN++ * GOLDEN;
    pos.set(e.id, [pp[0] * 1.22 + Math.cos(ang) * 0.05, pp[1] * 1.22 + 0.06, pp[2] * 1.22 + Math.sin(ang) * 0.05]);
  }

  const entityOut: Entity[] = [];
  for (const e of kept) {
    const p = parentOf(e);
    const snippet = snippetAround(text, e.start, e.end);
    const n = e.mentions;
    const about = p
      ? `${p.label} = ${e.label}`
      : `Mentioned ${n} time${n === 1 ? "" : "s"}, first at characters ${e.start}–${e.end}: “${snippet}”`;
    nodes.push({ id: e.id, k: kindToNode(e.kind), label: e.label, pos: pos.get(e.id)!, about });
    entityOut.push({ id: e.id, label: e.label, kind: e.kind, mentions: n, start: e.start, end: e.end, snippet, of: p?.label });
    if (p) {
      addEdge(e.id, p.id);
      continue;
    }
    const mine = [...e.sents].filter((si) => sentId.has(si));
    if (mine.length === 0) addEdge("d", e.id);
    else for (const si of mine) addEdge(sentId.get(si)!, e.id);
  }

  // co-occurrence edges, at most 3 per entity, strongest first
  const weight = new Map<string, { a: Ent; b: Ent; w: number }>();
  for (const list of perSentence.values()) {
    const free = list.filter((e) => !parentOf(e));
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        const k = `${free[i].id}|${free[j].id}`;
        const cur = weight.get(k);
        if (cur) cur.w++;
        else weight.set(k, { a: free[i], b: free[j], w: 1 });
      }
    }
  }
  const degree = new Map<string, number>();
  for (const { a, b } of [...weight.values()].sort((x, y) => y.w - x.w)) {
    if ((degree.get(a.id) ?? 0) >= 3 || (degree.get(b.id) ?? 0) >= 3) continue;
    const before = edges.length;
    addEdge(a.id, b.id);
    if (edges.length > before) {
      degree.set(a.id, (degree.get(a.id) ?? 0) + 1);
      degree.set(b.id, (degree.get(b.id) ?? 0) + 1);
    }
  }

  // one connected component: attach every leftover component to the Document
  const parent = new Map(nodes.map((n) => [n.id, n.id]));
  const find = (x: string): string => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)!)!);
      x = parent.get(x)!;
    }
    return x;
  };
  for (const [a, b] of edges) parent.set(find(a), find(b));
  for (const n of nodes) {
    if (find(n.id) !== find("d")) {
      addEdge("d", n.id);
      parent.set(find(n.id), find("d"));
    }
  }

  entityOut.sort((x, y) => y.mentions - x.mentions || x.start - y.start);
  return { nodes, edges, entities: entityOut, date };
}

export function isConnected(nodes: { id: string }[], edges: [string, string][]): boolean {
  if (nodes.length === 0) return true;
  const adj = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  for (const [a, b] of edges) {
    adj.get(a)?.push(b);
    adj.get(b)?.push(a);
  }
  const seenIds = new Set<string>([nodes[0].id]);
  const stack = [nodes[0].id];
  while (stack.length) {
    for (const nb of adj.get(stack.pop()!) ?? []) {
      if (!seenIds.has(nb)) {
        seenIds.add(nb);
        stack.push(nb);
      }
    }
  }
  return seenIds.size === nodes.length;
}
