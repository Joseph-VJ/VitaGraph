import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ForceGraph, type ForceGraphNodeInput, type ForceGraphEdgeInput } from "./ForceGraph";

/**
 * FrontPage - animated text-network entry view (InfraNodus-style).
 * Dark immersive canvas + VitaGraph identity, paste-your-own-text builder,
 * community colors, curved co-occurrence links, gentle perpetual physics.
 * Dependency-free and low-end friendly (engine handles budgets internally).
 */

const STOPWORDS = new Set(
  ("a,an,the,of,to,in,on,for,and,or,with,is,are,was,were,be,been,being,am,from,by,at,as,it,its,this,that,these,those," +
    "my,your,our,their,his,her,we,you,i,they,them,us,me,him,she,do,does,did,have,has,had,can,could,will,would,shall,should,may,might,must," +
    "not,no,nor,but,if,then,than,so,too,very,also,just,only,more,most,such,own,same,other,another,each,any,all,some,both,few,many,much," +
    "about,into,over,under,after,before,between,out,up,down,off,again,further,once,here,there,when,where,why,how,what,which,who,whom,whose," +
    "because,while,during,through,against,above,below,together,across,per,via,using,use,used,uses,one,two,three,new,get,got,make,made,like").split(",")
);

const DEMO_TEXT =
  "Each health report stores hemoglobin, glucose and cholesterol values inside a private database. " +
  "A patient uploads a PDF report and the system extracts every finding with page citations. " +
  "The doctor reads a summary that links each value to its reference range and a normal or high or low flag. " +
  "Hemoglobin improved across three reports while vitamin D stayed low without supplements. " +
  "Cholesterol dropped after the followup panel and the trend chart marked the result improving. " +
  "Every question searches a private vector index that only contains data for one user. " +
  "The retrieval engine embeds each chunk and ranks evidence by similarity before an answer is composed. " +
  "Each answer cites the report page so the doctor can verify the evidence behind the claim. " +
  "Privacy is enforced because storage is encrypted and every query filters by user permission. " +
  "The knowledge graph engine links tests, measurements, dates and report nodes into one network. " +
  "A cluster groups words that appear together, so blood, hemoglobin and panel share a color. " +
  "Betweenness centrality reveals which node bridges separate topics inside the network. " +
  "Modularity measures how strongly the graph splits into topic communities and gaps appear between them. " +
  "The physics simulation keeps nodes floating while force, repulsion and spring links find a stable layout. " +
  "You can drag any node, zoom the canvas and hover a word to inspect its neighbors. " +
  "The analysis panel lists influential words, cluster names and the modularity score live. " +
  "Data stays immutable because the archive stores an encrypted copy with a date and a hash. " +
  "The timeline follows the patient from baseline report to followup and marks weight and energy changes. " +
  "A synthetic sample keeps the demo safe while the real pipeline never leaves the clinic. " +
  "The interface is built with react and a canvas engine that animates curves, labels and floating nodes.";

const HUES = ["#60A5FA", "#34D399", "#F59E0B", "#F472B6", "#A78BFA", "#22D3EE", "#F87171", "#A3E635", "#FB923C", "#2DD4BF"];
const hueFor = (c: number) => HUES[((c % HUES.length) + HUES.length) % HUES.length];

interface NodeAcc {
  id: string;
  occ: number;
  deg: number;
  community: number;
}

function splitSentences(text: string): string[] {
  return text.split(/[.!?\n;]+/).map((s) => s.trim()).filter((s) => s.length > 0);
}
function tokenize(text: string): string[] {
  const words: string[] = [];
  const re = /[a-z][a-z0-9-]*/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const w = m[0].toLowerCase();
    if (w.length >= 3 && !STOPWORDS.has(w)) words.push(w);
  }
  return words;
}

interface BuiltGraph {
  nodes: ForceGraphNodeInput[];
  edges: ForceGraphEdgeInput[];
  communityNames: Record<number, string>;
  clusterCounts: Record<number, number>;
  modularity: number;
  sentenceCount: number;
  topWords: { id: string; deg: number }[];
}

function buildWordGraph(text: string, maxNodes: number): BuiltGraph | { error: string } {
  const words = tokenize(text);
  if (words.length === 0) return { error: "Add some text first - paste a paragraph, then rebuild." };
  if (words.length === 1) return { error: "Only one word found. Paste a few sentences so words can connect." };
  const sentences = splitSentences(text);
  const pairW = new Map<string, number>();
  const occ = new Map<string, number>();
  sentences.forEach((s) => {
    const ws = Array.from(new Set(tokenize(s)));
    ws.forEach((w) => occ.set(w, (occ.get(w) || 0) + 1));
    for (let i = 0; i < ws.length; i++)
      for (let j = i + 1; j < ws.length; j++) {
        const a = ws[i], b = ws[j];
        const k = a < b ? a + "\u0001" + b : b + "\u0001" + a;
        pairW.set(k, (pairW.get(k) || 0) + 1);
      }
  });
  let nodeIds: NodeAcc[] = Array.from(occ.keys()).map((w) => ({ id: w, occ: occ.get(w) || 0, deg: 0, community: 0 }));
  nodeIds.sort((a, b) => b.occ - a.occ);
  if (nodeIds.length > maxNodes) nodeIds = nodeIds.slice(0, maxNodes);
  const idset = new Set(nodeIds.map((n) => n.id));
  const rawEdges: { a: string; b: string; wt: number }[] = [];
  pairW.forEach((wt, k) => {
    const parts = k.split("\u0001");
    if (idset.has(parts[0]) && idset.has(parts[1])) rawEdges.push({ a: parts[0], b: parts[1], wt });
  });
  const adj = new Map<string, { nb: string; wt: number }[]>();
  nodeIds.forEach((n) => adj.set(n.id, []));
  rawEdges.forEach((e) => {
    adj.get(e.a)?.push({ nb: e.b, wt: e.wt });
    adj.get(e.b)?.push({ nb: e.a, wt: e.wt });
  });
  const degOf = new Map<string, number>();
  rawEdges.forEach((e) => {
    degOf.set(e.a, (degOf.get(e.a) || 0) + 1);
    degOf.set(e.b, (degOf.get(e.b) || 0) + 1);
  });
  nodeIds.forEach((n) => (n.deg = degOf.get(n.id) || 0));

  // label-propagation communities
  const labels = new Map<string, number>();
  nodeIds.forEach((n, i) => labels.set(n.id, i % 2));
  for (let iter = 0; iter < 30; iter++) {
    let changed = false;
    for (const n of nodeIds) {
      const counts = new Map<number, number>();
      (adj.get(n.id) || []).forEach(({ nb, wt }) => {
        const lab = labels.get(nb) || 0;
        counts.set(lab, (counts.get(lab) || 0) + wt);
      });
      if (counts.size === 0) continue;
      let best = labels.get(n.id) || 0;
      let bestC = -1;
      counts.forEach((c, lab) => {
        if (c > bestC) { bestC = c; best = lab; }
      });
      if (best !== labels.get(n.id)) { labels.set(n.id, best); changed = true; }
    }
    if (!changed) break;
  }
  const remap = new Map<number, number>();
  let next = 0;
  labels.forEach((l) => {
    if (!remap.has(l)) remap.set(l, next++);
  });
  const communityNames: Record<number, string> = {};
  const bestDeg: Record<number, number> = {};
  nodeIds.forEach((n) => {
    const c = remap.get(labels.get(n.id) || 0) || 0;
    n.community = c;
    if (!bestDeg[c] || n.deg > bestDeg[c]) { bestDeg[c] = n.deg; communityNames[c] = n.id; }
  });
  const clusterCounts: Record<number, number> = {};
  nodeIds.forEach((n) => {
    const c = n.community;
    clusterCounts[c] = (clusterCounts[c] || 0) + 1;
  });

  // modularity
  const m = rawEdges.reduce((s, e) => s + e.wt, 0);
  let q = 0;
  if (m > 0) {
    rawEdges.forEach((e) => {
      const ca = remap.get(labels.get(e.a) || 0);
      const cb = remap.get(labels.get(e.b) || 0);
      if (ca === cb) {
        const da = degOf.get(e.a) || 0;
        const db = degOf.get(e.b) || 0;
        q += e.wt / m - (da * db) / (2 * m * m);
      }
    });
  }

  const nodes: ForceGraphNodeInput[] = nodeIds.map((n) => {
    const imp = n.deg * 2 + n.occ;
    return {
      id: n.id,
      label: n.id,
      color: hueFor(n.community),
      r: Math.max(5, Math.min(24, 4 + Math.sqrt(imp) * 1.7)),
      importance: imp,
    };
  });
  const indexById = new Map(nodes.map((n, i) => [n.id, i]));
  const edges: ForceGraphEdgeInput[] = [];
  rawEdges.forEach((e) => {
    const s = indexById.get(e.a);
    const t = indexById.get(e.b);
    if (s !== undefined && t !== undefined) edges.push({ source: s, target: t, weight: e.wt });
  });
  const topWords = [...nodeIds].sort((a, b) => b.deg - a.deg).slice(0, 8).map((n) => ({ id: n.id, deg: n.deg }));
  if (edges.length === 0) return { error: "No co-occurring words found. Try longer sentences." };
  return { nodes, edges, communityNames, clusterCounts, modularity: Math.max(0, q), sentenceCount: sentences.length, topWords };
}

export function FrontPage({ onEnterApp }: { onEnterApp: () => void }) {
  const [text, setText] = useState(DEMO_TEXT);
  const [maxNodes, setMaxNodes] = useState(120);
  const [inputOpen, setInputOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [graph, setGraph] = useState<BuiltGraph | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const rebuild = useCallback(
    (source: string) => {
      const res = buildWordGraph(source, maxNodes);
      if ("error" in res) {
        setMsg(res.error);
        return false;
      }
      setMsg("");
      setGraph(res);
      return true;
    },
    [maxNodes]
  );

  // initial build
  useEffect(() => {
    rebuild(DEMO_TEXT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wordCount = useMemo(() => `${tokenize(text).length} words \u00B7 ${splitSentences(text).length} sentences`, [text]);

  return (
    <div className="relative min-h-[100dvh] bg-[#05070D] text-slate-200 overflow-hidden antialiased">
      {/* backdrop */}
      <div
        className="fixed inset-0"
        style={{
          background:
            "radial-gradient(1200px 700px at 70% -10%, rgba(37,99,235,0.14), transparent 60%)," +
            "radial-gradient(900px 600px at 8% 108%, rgba(16,185,129,0.07), transparent 55%)," +
            "linear-gradient(180deg, #0B1220 0%, #05070D 100%)",
        }}
      />
      <div
        className="fixed inset-0 opacity-50 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(rgba(148,163,184,0.10) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
          maskImage: "radial-gradient(ellipse at 60% 45%, black 30%, transparent 78%)",
          WebkitMaskImage: "radial-gradient(ellipse at 60% 45%, black 30%, transparent 78%)",
        }}
      />

      {/* graph canvas layer */}
      <div className="fixed inset-0">
        {graph && (
          <ForceGraph nodes={graph.nodes} edges={graph.edges} width={740} height={420} theme="dark" />
        )}
      </div>

      {/* top bar */}
      <header className="relative z-20 h-16 flex items-center justify-between px-6 border-b border-white/10 bg-gradient-to-b from-[#05070D]/85 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center font-extrabold text-white text-[16px] shadow-lg shadow-blue-900/40 jakarta">
            V
          </div>
          <div>
            <div className="font-bold jakarta text-[15px] text-white leading-tight">VitaGraph</div>
            <div className="text-[10.5px] text-slate-400 leading-tight">Evidence-Linked Knowledge Graph &amp; Privacy-Aware RAG</div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="hidden sm:inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full border border-emerald-400/35 bg-emerald-400/10 text-emerald-300 mono text-[10.5px] font-bold tracking-widest">
            <span className="w-[7px] h-[7px] rounded-full bg-emerald-400 animate-pulse" />
            LIVE GRAPH
          </span>
          <button
            onClick={onEnterApp}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[12.5px] font-bold transition shadow-sm"
          >
            Open patient workflow
          </button>
        </div>
      </header>

      {/* hero copy */}
      <div className="relative z-10 max-w-[460px] px-6 pt-10">
        <div className="mono text-[10px] font-bold tracking-[0.24em] text-blue-300 mb-3">TEXT NETWORK VISUALIZATION</div>
        <h1 className="jakarta text-[34px] md:text-[40px] font-extrabold leading-[1.08] text-white mb-3">
          Turn reports into <span className="text-blue-300">living knowledge graphs</span>
        </h1>
        <p className="text-[13.5px] leading-relaxed text-slate-400 max-w-[38ch] mb-5">
          Every word becomes a node, co-occurrence draws a curved link, physics keeps the whole network floating.
        </p>
        <div className="flex gap-2.5">
          <button
            onClick={() => { setInputOpen(true); setTimeout(() => inputRef.current?.focus(), 60); }}
            className="px-4 h-10 rounded-xl bg-blue-700 hover:bg-blue-600 text-white text-[13px] font-bold transition shadow-sm"
          >
            &#9654; Build graph from text
          </button>
          <button
            onClick={() => setRailOpen((v) => !v)}
            className="px-4 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 text-[13px] font-semibold transition"
          >
            Analytics
          </button>
        </div>
      </div>

      {/* stats strip */}
      <div className="fixed z-10 left-6 bottom-6 flex gap-5 items-center px-4 py-2.5 rounded-2xl border border-white/10 bg-[#0B1220]/70 backdrop-blur">
        <div><b className="block jakarta text-[15px] text-slate-100">{graph?.nodes.length ?? 0}</b><span className="mono text-[9.5px] tracking-widest text-slate-500">NODES</span></div>
        <div><b className="block jakarta text-[15px] text-slate-100">{graph?.edges.length ?? 0}</b><span className="mono text-[9.5px] tracking-widest text-slate-500">LINKS</span></div>
        <div><b className="block jakarta text-[15px] text-slate-100">{graph ? Object.keys(graph.clusterCounts).length : 0}</b><span className="mono text-[9.5px] tracking-widest text-slate-500">CLUSTERS</span></div>
        <div><b className="block jakarta text-[15px] text-slate-100">{graph ? graph.modularity.toFixed(2) : "0"}</b><span className="mono text-[9.5px] tracking-widest text-slate-500">MODULARITY</span></div>
      </div>

      {/* disclaimer */}
      <div className="hidden md:flex fixed z-10 bottom-6 left-1/2 -translate-x-1/2 items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 text-amber-300 text-[10.5px] font-medium whitespace-nowrap">
        <span className="w-[15px] h-[15px] rounded-full bg-amber-400/90 text-amber-900 flex items-center justify-center text-[10px] font-bold">!</span>
        Educational prototype - not medical diagnosis. Synthetic demo text only.
      </div>

      {/* analytics rail */}
      {railOpen && graph && (
        <aside className="fixed z-20 top-20 right-5 w-60 max-h-[70vh] overflow-auto rounded-2xl border border-white/10 bg-[#0B1220]/80 backdrop-blur p-4">
          <div className="flex justify-between items-center mb-2.5">
            <span className="mono text-[10px] font-bold tracking-[0.18em] text-slate-500">ANALYTICS</span>
            <button onClick={() => setRailOpen(false)} className="text-slate-400 hover:text-white text-[13px]" aria-label="Close analytics">&#10005;</button>
          </div>
          <div className="mono text-[9.5px] tracking-[0.18em] text-slate-500 mb-1.5">TOPIC CLUSTERS</div>
          {Object.entries(graph.communityNames).map(([c, name]) => (
            <div key={c} className="flex items-center gap-2 py-1 px-1.5 rounded-lg text-[11.5px] hover:bg-white/5">
              <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: hueFor(Number(c)) }} />
              {name}
              <span className="ml-auto mono text-[10px] text-slate-500">{graph.clusterCounts[Number(c)] || 0}</span>
            </div>
          ))}
          <div className="h-px bg-white/10 my-2.5" />
          <div className="mono text-[9.5px] tracking-[0.18em] text-slate-500 mb-1.5">TOP INFLUENTIAL</div>
          {graph.topWords.map((t) => (
            <div key={t.id} className="flex justify-between py-0.5 px-1.5 mono text-[11px]">
              <b className="font-medium text-slate-300">{t.id}</b>
              <span className="text-slate-500">{t.deg} links</span>
            </div>
          ))}
        </aside>
      )}

      {/* input panel */}
      {inputOpen && (
        <div className="fixed z-20 bottom-24 left-6 w-[420px] max-w-[calc(100vw-48px)] rounded-2xl border border-white/10 bg-[#0B1220]/85 backdrop-blur p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="mono text-[10px] font-bold tracking-[0.18em] text-slate-500">PASTE YOUR OWN TEXT</span>
            <button onClick={() => setInputOpen(false)} className="text-slate-400 hover:text-white text-[13px]" aria-label="Close input">&#10005;</button>
          </div>
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste a paragraph. Words become nodes; two words in the same sentence get a curved link."
            className="w-full h-28 resize-y rounded-xl border border-slate-500/25 bg-[#02060E]/70 text-slate-200 text-[12.5px] leading-relaxed p-3 outline-none focus:border-blue-500"
          />
          <div className="flex gap-2 items-center mt-2.5">
            <span className="mono text-[10.5px] text-slate-500 mr-auto">{wordCount}</span>
            <button
              onClick={() => { if (rebuild(text)) setInputOpen(false); }}
              className="px-4 h-[34px] rounded-xl bg-blue-700 hover:bg-blue-600 text-white text-[12px] font-bold transition"
            >
              Build graph
            </button>
          </div>
          {msg && <div className="text-[11px] text-amber-300 mt-2">{msg}</div>}
        </div>
      )}

      {/* controls */}
      <div className="fixed z-10 bottom-6 right-6 flex flex-col gap-2 items-end">
        <div className="flex gap-2 items-center px-3 py-2 rounded-xl border border-white/10 bg-[#0B1220]/70 backdrop-blur">
          <label className="mono text-[10px] font-semibold tracking-widest text-slate-500">MAX NODES</label>
          <input
            type="range"
            min={40}
            max={200}
            step={10}
            value={maxNodes}
            onChange={(e) => setMaxNodes(Number(e.target.value))}
            onMouseUp={() => rebuild(text)}
            onTouchEnd={() => rebuild(text)}
            className="w-[110px] accent-blue-500"
          />
          <span className="mono text-[11px] font-bold text-blue-300 w-7 text-right">{maxNodes}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setInputOpen((v) => !v)} className="px-3.5 h-[34px] rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-[12px] font-semibold text-slate-200 transition">Paste text</button>
          <button onClick={() => rebuild(text)} className="px-3.5 h-[34px] rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-[12px] font-semibold text-slate-200 transition">Rebuild graph</button>
        </div>
      </div>
    </div>
  );
}
