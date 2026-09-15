export interface Stage {
  id: string;
  label: string;
  sub: string;
  icon: string;
  desc: string;
}

export const STAGES: Stage[] = [
  {
    id: "upload",
    label: "Upload Report",
    sub: "Add PDF",
    icon: "📄",
    desc: "Drop health report — starts pipeline",
  },
  {
    id: "archive",
    label: "Save Forever?",
    sub: "Your choice",
    icon: "🔒",
    desc: "Save now or save at end? You decide — your idea",
  },
  {
    id: "understand",
    label: "Understanding",
    sub: "Reading • Bigger",
    icon: "🔍",
    desc: "Reading 5 pages + 24 findings — one big step at a time",
  },
  {
    id: "rag",
    label: "Find Answers",
    sub: "RAG visible",
    icon: "⚡",
    desc: "How API uses RAG to get data from your private reports — bigger vertical flow",
  },
  {
    id: "thinking",
    label: "AI Thinking",
    sub: "Brain + graph",
    icon: "🧠",
    desc: "AI brain thinking + knowledge graph dot-by-dot",
  },
  {
    id: "record",
    label: "Patient Record",
    sub: "CRM",
    icon: "📁",
    desc: "Tracks person like patient/customer — complete file",
  },
];

export interface QuestionItem {
  q: string;
  a: string;
  cites: string[];
  concepts: string[];
  chunks: {
    id: string;
    text: string;
    score: number;
    page: string;
  }[];
}

export const DEMO_QUESTIONS: QuestionItem[] = [
  {
    q: "What does my hemoglobin trend show?",
    a: "Hemoglobin improved from 13.1 to 14.0 g/dL across 3 reports. Latest is normal and stable.",
    cites: ["Page 2 • Jan 2024", "Page 3 • Aug 2024", "Page 1 • Feb 2026"],
    concepts: ["Hemoglobin", "Trend"],
    chunks: [
      {
        id: "Feb 2026 Report",
        text: "Hemoglobin 14.0 g/dL — Normal range (13.5 - 17.5 g/dL)",
        score: 92,
        page: "Page 1 • Best match",
      },
      {
        id: "Aug 2024 Report",
        text: "Hemoglobin 13.2 g/dL — Improved from Jan follow-up panel",
        score: 87,
        page: "Page 2",
      },
      {
        id: "Jan 2024 Report",
        text: "Hemoglobin 13.1 g/dL — Slightly low baseline test",
        score: 84,
        page: "Page 2",
      },
    ],
  },
  {
    q: "Any low vitamin levels?",
    a: "Vitamin D was low (18 ng/mL) in Jan 2024, now 32 ng/mL after supplements. Vitamin B12 is in optimal range.",
    cites: ["Page 4 • Vitamin D", "Page 2 • Jan 2024"],
    concepts: ["Vitamin D", "Deficiency"],
    chunks: [
      {
        id: "Jan 2024 Report",
        text: "Vitamin D (25-OH) 18 ng/mL — Flagged LOW by lab (Reference 30-100 ng/mL)",
        score: 94,
        page: "Page 4",
      },
      {
        id: "Feb 2026 Report",
        text: "Vitamin D 32 ng/mL — Now within normal reference range",
        score: 91,
        page: "Page 4",
      },
    ],
  },
  {
    q: "Show my last report summary",
    a: "Feb 2026: all routine markers normal. Hb 14.0 g/dL, WBC 6.2k, platelets 245k, glucose 94 mg/dL. No active lab flags.",
    cites: ["Page 1-5 • Feb 2026"],
    concepts: ["CBC", "Normal"],
    chunks: [
      {
        id: "Feb 2026 Report",
        text: "Complete Blood Count: Hb 14.0, WBC 6.2, Platelets 245k — All values normal",
        score: 96,
        page: "Page 1",
      },
      {
        id: "Feb 2026 Report",
        text: "Metabolic Panel: Fasting Glucose 94 mg/dL, Total Cholesterol 198 mg/dL",
        score: 89,
        page: "Page 3",
      },
    ],
  },
  {
    q: "What do my reports say about fatigue?",
    a: "January 2024 notes mention occasional afternoon fatigue associated with low Vitamin D (18 ng/mL). June 2024 notes improved energy levels.",
    cites: ["Page 5 • Clinical Notes • Jan 2024", "Page 4 • June 2024"],
    concepts: ["Fatigue", "Clinical Notes"],
    chunks: [
      {
        id: "Jan 2024 Report",
        text: "General Notes: Patient reports mild afternoon fatigue and low stamina over past 2 months.",
        score: 88,
        page: "Page 5",
      },
      {
        id: "Aug 2024 Report",
        text: "Patient states energy has improved following Vitamin D supplementation.",
        score: 82,
        page: "Page 4",
      },
    ],
  },
  {
    q: "Do I have diabetes based on my glucose? Please diagnose me.",
    a: "Refusal: This request falls outside VitaGraph's educational boundary. VitaGraph cannot diagnose conditions, recommend medication, or evaluate personal risk. Please consult a qualified healthcare professional.",
    cites: ["Safety Policy • Plan §10"],
    concepts: ["Safety Refusal", "Boundary Guard"],
    chunks: [
      {
        id: "Safety Guard",
        text: "Rule: Refuse diagnosis requests before retrieval. Educational organization only.",
        score: 100,
        page: "Boundary Gateway",
      },
    ],
  },
];
