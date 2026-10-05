// Checks the Text to Graph extraction on edge-case texts. Run: node scripts/plan/check_text_graph.mjs
import { extractGraph, isConnected } from "../../site design/src/components/graph/textGraph.ts";

const free =
  "Arjun visited Dr. Meera at Apollo Hospital in Chennai on 12 March 2026. He complained of fatigue and headache. Dr. Meera prescribed Metformin and advised a diet change. Apollo Hospital will follow up in April.";
const lab = "Report date: 12 March 2026\nHemoglobin 13.8 g/dL\nFasting Glucose 96 mg/dL\nTSH 2.4 uIU/mL";
const story = `The old lighthouse keeper climbed the spiral staircase every evening. Marlow had lived on the island for thirty years, and the lighthouse was his only companion besides the gulls.

One stormy night a small fishing boat appeared near the rocks. Marlow lit the great lamp and signalled the fishermen toward the harbour. The fishermen reached the harbour safely, and the village thanked the lighthouse keeper with fresh bread.

Years later the lighthouse was replaced by an automatic beacon. Marlow still climbed the staircase each evening, because the lighthouse had become his home and the sea his oldest friend.`;
const long = Array.from({ length: 400 }, (_, i) => `Patient ${i} had Hemoglobin ${10 + (i % 7)}.2 g/dL and fever in March 2026.`).join(" ").slice(0, 20000);

const cases = [
  ["lab sample", lab, { min: 8 }],
  ["free-text sample", free, { min: 6 }],
  ["story", story, { min: 6 }],
  ["numbers only", "12 45 78", { min: 1 }],
  ["long 20000 chars", long, { min: 2, maxMs: 1000 }],
  ["empty", "", { min: 1 }],
  ["two words", "hello world", { min: 1 }],
];

let failed = 0;
for (const [name, text, req] of cases) {
  const t0 = performance.now();
  const g = extractGraph(text);
  const ms = performance.now() - t0;
  const conn = isConnected(g.nodes, g.edges);
  const ok = g.nodes.length >= req.min && g.nodes.length <= 60 && conn && (!req.maxMs || ms < req.maxMs);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${g.nodes.length} nodes, ${g.edges.length} edges, ${g.entities.length} entities, connected=${conn}, ${ms.toFixed(0)} ms, date=${g.date}`);
  if (process.argv.includes("-v")) console.log(g.entities.map((e) => `${e.kind}:${e.label}${e.of ? "<" + e.of : ""}x${e.mentions}`).join(" | "));
}
console.log(failed ? `RESULT: FAIL (${failed})` : "RESULT: PASS");
process.exit(failed ? 1 : 0);
