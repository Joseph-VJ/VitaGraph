import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Marginalia } from "../components/gallery";
import { setNavDirection } from "../motion/navigation";

interface ConceptItem {
  id: string;
  name: string;
  category: "condition" | "biomarker" | "treatment" | "outcome";
  standardCode: string;
  relationshipsCount: number;
  occurrences: number;
}

const conceptsData: ConceptItem[] = [
  { id: "c1", name: "Heart Failure", category: "condition", standardCode: "SNOMED: 84114007", relationshipsCount: 14, occurrences: 48 },
  { id: "c2", name: "Creatinine", category: "biomarker", standardCode: "LOINC: 2160-0", relationshipsCount: 6, occurrences: 32 },
  { id: "c3", name: "SGLT2 Inhibitors", category: "treatment", standardCode: "RxNorm: 1546356", relationshipsCount: 8, occurrences: 28 },
  { id: "c4", name: "Hospitalization", category: "outcome", standardCode: "SNOMED: 32485007", relationshipsCount: 5, occurrences: 24 },
  { id: "c5", name: "eGFR", category: "biomarker", standardCode: "LOINC: 33914-3", relationshipsCount: 4, occurrences: 22 },
  { id: "c6", name: "BNP (Brain Natriuretic Peptide)", category: "biomarker", standardCode: "LOINC: 30934-4", relationshipsCount: 5, occurrences: 19 },
  { id: "c7", name: "HbA1c", category: "biomarker", standardCode: "LOINC: 4548-4", relationshipsCount: 4, occurrences: 18 },
  { id: "c8", name: "ACE Inhibitors", category: "treatment", standardCode: "RxNorm: 1364430", relationshipsCount: 6, occurrences: 16 },
  { id: "c9", name: "Hemoglobin", category: "biomarker", standardCode: "LOINC: 718-7", relationshipsCount: 4, occurrences: 15 },
  { id: "c10", name: "Cardiovascular Mortality", category: "outcome", standardCode: "SNOMED: 395071007", relationshipsCount: 3, occurrences: 14 },
];

export const OntologyPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");

  const filtered = conceptsData.filter((c) => {
    const matchesCat = activeCat === "all" || c.category === activeCat;
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.standardCode.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="type-title text-[var(--bone)]">Biomedical Ontology & Vocabularies</h2>
          <p className="type-meta text-[var(--dim)] mt-0.5">
            Standardized clinical concepts mapped via SNOMED-CT, LOINC, and RxNorm.
          </p>
        </div>
        <Marginalia
          text="Evidence connects a healthier tomorrow."
          sketch="leaf"
        />
      </div>

      {/* Relation Type Ledger */}
      <div className="p-4 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
        <span className="type-label text-[var(--dim)] block mb-3">
          Active relationship schema (5 core clinical predicates)
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { rel: "indicates", desc: "Biomarker → Condition", count: "148 edges" },
            { rel: "measures", desc: "Test → Entity", count: "112 edges" },
            { rel: "treats", desc: "Drug → Disease", count: "96 edges" },
            { rel: "increases_risk", desc: "Risk factor → Outcome", count: "72 edges" },
            { rel: "leads_to", desc: "Pathophysiology", count: "58 edges" },
          ].map((r, i) => (
            <div key={i} className="p-2.5 rounded-[var(--r-6)] bg-[var(--ink-700)]/40 border border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--verdigris)] font-semibold block">
                {r.rel}
              </span>
              <span className="type-meta text-[var(--dim)] text-[11px] block mt-0.5">
                {r.desc}
              </span>
              <span className="type-mono-sm text-[var(--faint)] text-[10px] block mt-1">
                {r.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter and search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-[var(--r-6)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          {[
            { id: "all", label: "All concepts (10)" },
            { id: "condition", label: "Conditions (1)" },
            { id: "biomarker", label: "Biomarkers (5)" },
            { id: "treatment", label: "Treatments (2)" },
            { id: "outcome", label: "Outcomes (2)" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveCat(t.id)}
              className={`px-3 py-1 rounded-[var(--r-4)] type-label transition-all duration-[120ms] ease-out ${
                activeCat === t.id
                  ? "bg-[var(--ink-700)] text-[var(--bone)] shadow-sm"
                  : "text-[var(--dim)] hover:text-[var(--bone)] hover:bg-[var(--ink-700)]/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--r-6)] bg-[var(--ink-800)] border border-[var(--line-strong)] w-72">
          <svg className="w-4 h-4 text-[var(--dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search concepts or codes..."
            className="w-full bg-transparent type-body text-xs text-[var(--bone)] placeholder-[var(--faint)] focus:outline-none"
          />
        </div>
      </div>

      {/* Concept Table */}
      <div className="rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--line-faint)] bg-[var(--ink-700)]/20">
              <th className="type-label text-[var(--dim)] py-2.5 px-4">Concept Name</th>
              <th className="type-label text-[var(--dim)] py-2.5 px-4">Category</th>
              <th className="type-label text-[var(--dim)] py-2.5 px-4">Standard Code</th>
              <th className="type-label text-[var(--dim)] py-2.5 px-4">Graph Edges</th>
              <th className="type-label text-[var(--dim)] py-2.5 px-4">Occurrences</th>
              <th className="type-label text-[var(--dim)] py-2.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line-faint)]">
            {filtered.map((c) => (
              <tr
                key={c.id}
                className="hover:bg-[var(--ink-700)]/40 transition-colors duration-[120ms] ease-out"
              >
                <td className="py-3 px-4 type-body font-medium text-[var(--bone)]">
                  {c.name}
                </td>
                <td className="py-3 px-4">
                  <Badge
                    variant={
                      c.category === "condition"
                        ? "cornflower"
                        : c.category === "biomarker"
                        ? "verdigris"
                        : c.category === "treatment"
                        ? "ochre"
                        : "madder"
                    }
                  >
                    {c.category}
                  </Badge>
                </td>
                <td className="py-3 px-4 type-mono-sm text-[var(--dim)]">
                  {c.standardCode}
                </td>
                <td className="py-3 px-4 type-mono-sm text-[var(--bone)]">
                  {c.relationshipsCount}
                </td>
                <td className="py-3 px-4 type-mono-sm text-[var(--dim)]">
                  {c.occurrences}
                </td>
                <td className="py-3 px-4 text-right">
                  <Link to="/graph" viewTransition onClick={() => setNavDirection("forward")}>
                    <Button variant="ghost" className="h-7 text-xs">
                      View in graph
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
