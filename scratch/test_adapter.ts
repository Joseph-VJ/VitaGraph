// scratch/test_adapter.mjs
import {
  entityTypeToNodeKind,
  entityToStageNode,
  edgeToStageEdge,
  createHubNode,
  ensureConnected,
  computeDegreeCentrality,
  buildStageFromAi,
  buildStageFromPattern,
} from "../site design/src/components/graph/textStageData.ts";

console.log("=== Testing textStageData.ts with 3 sample graphs ===\n");

// Sample 1: Medical lab report AI graph
const sample1Ai = {
  title: "CBC Lab Panel",
  nodes: [
    { id: "e1", label: "Hemoglobin", type: "test", start: 28, end: 38, quote: "Hemoglobin" },
    { id: "e2", label: "13.8 g/dL", type: "measurement", start: 39, end: 48, quote: "13.8 g/dL" },
    { id: "e3", label: "Fasting Glucose", type: "test", start: 49, end: 64, quote: "Fasting Glucose" },
    { id: "e4", label: "96 mg/dL", type: "measurement", start: 65, end: 73, quote: "96 mg/dL" },
  ],
  edges: [
    { source: "e1", target: "e2", label: "measured as", start: 28, end: 48, quote: "Hemoglobin 13.8 g/dL" },
    { source: "e3", target: "e4", label: "measured as", start: 49, end: 73, quote: "Fasting Glucose 96 mg/dL" },
  ],
};

const g1 = buildStageFromAi("Report date: 12 March 2026\nHemoglobin 13.8 g/dL\nFasting Glucose 96 mg/dL", sample1Ai);
console.log("Sample 1 (AI Lab Report):");
console.log(`- Hub: id=${g1.nodes[0].id}, label="${g1.nodes[0].label}", kind=${g1.nodes[0].k}`);
console.log(`- Nodes count: ${g1.nodes.length} (kinds: ${g1.nodes.map(n => `${n.label}:${n.k}(${n.group})`).join(", ")})`);
console.log(`- Edges count: ${g1.edges.length} (labels: ${g1.edges.map(e => `${e.a}->${e.b}:${e.label || "hub-conn"}`).join(", ")})`);
console.log(`- Centralities: ${g1.nodes.map(n => `${n.label}:${n.imp.toFixed(2)}`).join(", ")}`);
console.log();

// Sample 2: Free text doctor encounter AI graph
const sample2Ai = {
  title: "Clinical Visit",
  nodes: [
    { id: "e1", label: "Arjun", type: "person", start: 0, end: 5, quote: "Arjun" },
    { id: "e2", label: "Dr. Meera", type: "person", start: 14, end: 23, quote: "Dr. Meera" },
    { id: "e3", label: "Apollo Hospital", type: "organization", start: 27, end: 42, quote: "Apollo Hospital" },
    { id: "e4", label: "headache", type: "symptom", start: 83, end: 91, quote: "headache" },
    { id: "e5", label: "Metformin", type: "medication", start: 114, end: 123, quote: "Metformin" },
  ],
  edges: [
    { source: "e1", target: "e2", label: "consulted", start: 0, end: 23, quote: "Arjun visited Dr. Meera" },
    { source: "e2", target: "e3", label: "works at", start: 14, end: 42, quote: "Dr. Meera at Apollo Hospital" },
    { source: "e1", target: "e4", label: "reported", start: 69, end: 91, quote: "complained of headache" },
    { source: "e2", target: "e5", label: "prescribed", start: 93, end: 123, quote: "Dr. Meera prescribed Metformin" },
  ],
};

const g2 = buildStageFromAi("Arjun visited Dr. Meera at Apollo Hospital in Chennai...", sample2Ai);
console.log("Sample 2 (AI Clinical Encounter):");
console.log(`- Hub: id=${g2.nodes[0].id}, label="${g2.nodes[0].label}", kind=${g2.nodes[0].k}`);
console.log(`- Nodes count: ${g2.nodes.length} (kinds: ${g2.nodes.map(n => `${n.label}:${n.k}(${n.group})`).join(", ")})`);
console.log(`- Edges count: ${g2.edges.length} (labels: ${g2.edges.map(e => `${e.a}->${e.b}:${e.label || "hub-conn"}`).join(", ")})`);
console.log(`- Centralities: ${g2.nodes.map(n => `${n.label}:${n.imp.toFixed(2)}`).join(", ")}`);
console.log();

// Sample 3: Pattern graph extractor
const sample3Text = "Report date: 12 March 2026\nHemoglobin 13.8 g/dL\nFasting Glucose 96 mg/dL\nTSH 2.4 uIU/mL";
const g3 = buildStageFromPattern(sample3Text);
console.log("Sample 3 (Pattern Graph Extractor):");
console.log(`- Hub: id=${g3.nodes[0].id}, label="${g3.nodes[0].label}", kind=${g3.nodes[0].k}`);
console.log(`- Nodes count: ${g3.nodes.length} (kinds: ${g3.nodes.map(n => `${n.label}:${n.k}(${n.group})`).join(", ")})`);
console.log(`- Edges count: ${g3.edges.length}`);
console.log(`- Entities count: ${g3.entities.length}`);
console.log(`- Date extracted: ${g3.date}`);
console.log(`- Centralities: ${g3.nodes.map(n => `${n.label}:${n.imp.toFixed(2)}`).join(", ")}`);

console.log("\n=== ALL 3 SAMPLE GRAPHS ADAPTED SUCCESSFULLY ===");
