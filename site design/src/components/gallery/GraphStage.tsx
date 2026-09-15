import React, { useState } from "react";
import { Button, IconButton } from "./Buttons";
import { Select } from "./Input";

interface GraphStageProps {
  className?: string;
}

export const GraphStage: React.FC<GraphStageProps> = ({ className = "" }) => {
  const [selectedNode, setSelectedNode] = useState<string | null>("Creatinine");

  return (
    <div className={`w-full flex flex-col ${className}`}>
      {/* Stats row & Controls above frame */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
        {/* Stats */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--cornflower)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <div>
              <span className="type-mono font-medium text-[var(--bone)]">42</span>
              <span className="type-meta text-[var(--dim)] ml-1.5">nodes</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--ochre)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
            </svg>
            <div>
              <span className="type-mono font-medium text-[var(--bone)]">96</span>
              <span className="type-meta text-[var(--dim)] ml-1.5">edges</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--lilac)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12a4 4 0 018 0" />
            </svg>
            <div>
              <span className="type-mono font-medium text-[var(--bone)]">3</span>
              <span className="type-meta text-[var(--dim)] ml-1.5">communities</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--verdigris)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 22h20L12 2z" />
            </svg>
            <div>
              <span className="type-mono font-medium text-[var(--bone)]">0.42</span>
              <span className="type-meta text-[var(--dim)] ml-1.5">modularity</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Select
            options={[
              { value: "force", label: "Force-directed" },
              { value: "circular", label: "Circular" },
              { value: "hierarchical", label: "Hierarchical" },
            ]}
          />
          <Button variant="ghost">
            <svg className="w-3.5 h-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <span>Filters</span>
          </Button>
          <Button variant="ghost">
            <svg className="w-3.5 h-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
            <span>Reset view</span>
          </Button>
        </div>
      </div>

      {/* Frame: radius 14, line-strong, dot grid + radial vignette */}
      <div className="relative w-full h-[540px] rounded-[var(--r-14)] border border-[var(--line-strong)] bg-[var(--ink-900)] overflow-hidden canvas-grid select-none">
        {/* Radial vignette overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(circle at center, transparent 40%, rgba(14,17,22,0.85) 100%)",
          }}
        />

        {/* Legend chips top-right (dot + label) */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-3 bg-[var(--ink-800)]/80 backdrop-blur-sm px-3 py-1.5 rounded-[var(--r-6)] border border-[var(--line-strong)]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--cornflower)]" />
            <span className="type-label text-[var(--dim)]">Condition</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--verdigris)]" />
            <span className="type-label text-[var(--dim)]">Biomarker</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--ochre)]" />
            <span className="type-label text-[var(--dim)]">Measurement</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--lilac)]" />
            <span className="type-label text-[var(--dim)]">Treatment</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--madder)]" />
            <span className="type-label text-[var(--dim)]">Outcome</span>
          </div>
        </div>

        {/* Canvas Marginalia TL */}
        <div className="absolute top-6 left-6 z-10 type-marginalia pointer-events-none max-w-[200px]">
          Evidence connects a healthier tomorrow.
        </div>

        {/* Canvas Marginalia BR */}
        <div className="absolute bottom-6 right-20 z-10 type-marginalia pointer-events-none text-right">
          Data<br />People<br />Better Care
        </div>

        {/* SVG Graph Stage Visuals (Hulls, Edges, Nodes) */}
        <svg className="w-full h-full absolute inset-0 z-10">
          <defs>
            {/* Glow filters for active nodes */}
            <filter id="glow-cornflower" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-verdigris" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Community Hulls (Dashed 1.5px closed curves) */}
          {/* Cardiac function */}
          <path
            d="M 230 150 C 260 90, 420 90, 430 160 C 440 220, 310 240, 240 220 Z"
            fill="rgba(134,169,217,0.04)"
            stroke="var(--cornflower)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <text x="310" y="115" fill="var(--cornflower)" className="type-label" textAnchor="middle">
            Cardiac function (5 nodes)
          </text>

          {/* Renal function */}
          <path
            d="M 520 160 C 560 100, 710 110, 720 180 C 730 250, 600 260, 530 230 Z"
            fill="rgba(121,184,166,0.04)"
            stroke="var(--verdigris)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <text x="630" y="125" fill="var(--verdigris)" className="type-label" textAnchor="middle">
            Renal function (4 nodes)
          </text>

          {/* Treatments */}
          <path
            d="M 240 370 C 260 320, 430 330, 420 400 C 410 460, 260 450, 250 410 Z"
            fill="rgba(169,146,208,0.04)"
            stroke="var(--lilac)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <text x="320" y="415" fill="var(--lilac)" className="type-label" textAnchor="middle">
            Treatments (4 nodes)
          </text>

          {/* Clinical outcomes */}
          <path
            d="M 450 360 C 490 310, 650 320, 640 410 C 630 470, 470 460, 460 410 Z"
            fill="rgba(217,128,141,0.04)"
            stroke="var(--madder)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <text x="560" y="430" fill="var(--madder)" className="type-label" textAnchor="middle">
            Clinical outcomes (3 nodes)
          </text>

          {/* Curved Edges with labels */}
          {/* Heart Failure -> BNP */}
          <path d="M 430 290 Q 380 230 340 170" fill="none" stroke="var(--dim)" strokeOpacity="0.45" strokeWidth="1" />
          <text x="375" y="225" fill="var(--dim)" opacity="0.8" className="type-quote text-[11px]" fontStyle="italic">
            indicates
          </text>

          {/* Heart Failure -> Ejection Fraction */}
          <path d="M 410 295 Q 350 280 300 235" fill="none" stroke="var(--dim)" strokeOpacity="0.45" strokeWidth="1" />
          <text x="350" y="270" fill="var(--dim)" opacity="0.8" className="type-quote text-[11px]" fontStyle="italic">
            measures
          </text>

          {/* Heart Failure -> NYHA Class */}
          <path d="M 410 320 Q 290 330 210 305" fill="none" stroke="var(--dim)" strokeOpacity="0.45" strokeWidth="1" />
          <text x="310" y="325" fill="var(--dim)" opacity="0.8" className="type-quote text-[11px]" fontStyle="italic">
            indicates
          </text>

          {/* Heart Failure -> Creatinine */}
          <path d="M 465 285 Q 520 250 565 190" fill="none" stroke="var(--dim)" strokeOpacity="0.45" strokeWidth="1" />
          <text x="480" y="235" fill="var(--dim)" opacity="0.8" className="type-quote text-[11px]" fontStyle="italic">
            measures
          </text>

          {/* Heart Failure -> eGFR */}
          <path d="M 465 310 Q 550 300 615 235" fill="none" stroke="var(--dim)" strokeOpacity="0.45" strokeWidth="1" />
          <text x="500" y="305" fill="var(--dim)" opacity="0.8" className="type-quote text-[11px]" fontStyle="italic">
            measures
          </text>

          {/* Heart Failure -> SGLT2 Inhibitors */}
          <path d="M 425 330 Q 380 370 330 385" fill="none" stroke="var(--dim)" strokeOpacity="0.45" strokeWidth="1" />
          <text x="400" y="360" fill="var(--dim)" opacity="0.8" className="type-quote text-[11px]" fontStyle="italic">
            treats
          </text>

          {/* Heart Failure -> ACE Inhibitors */}
          <path d="M 440 335 Q 420 380 350 425" fill="none" stroke="var(--dim)" strokeOpacity="0.45" strokeWidth="1" />
          <text x="390" y="390" fill="var(--dim)" opacity="0.8" className="type-quote text-[11px]" fontStyle="italic">
            treats
          </text>

          {/* Heart Failure -> Hospitalization */}
          <path d="M 470 325 Q 520 345 565 375" fill="none" stroke="var(--dim)" strokeOpacity="0.45" strokeWidth="1" />
          <text x="475" y="365" fill="var(--dim)" opacity="0.8" className="type-quote text-[11px]" fontStyle="italic">
            increases_risk
          </text>

          {/* Hospitalization -> Readmission */}
          <path d="M 565 390 Q 560 415 535 440" fill="none" stroke="var(--dim)" strokeOpacity="0.45" strokeWidth="1" />
          <text x="555" y="420" fill="var(--dim)" opacity="0.8" className="type-quote text-[11px]" fontStyle="italic">
            leads_to
          </text>

          {/* Nodes */}
          {/* Heart Failure Hub (26px) */}
          <g transform="translate(440, 310)" className="cursor-pointer">
            <circle r="34" fill="none" stroke="var(--cornflower)" strokeWidth="1" opacity="0.4" />
            <circle r="30" fill="none" stroke="var(--cornflower)" strokeWidth="1.5" opacity="0.7" />
            <circle r="26" fill="var(--cornflower)" fillOpacity="0.9" />
            <text y="4" fill="var(--ink-900)" textAnchor="middle" className="font-bold text-[12px] select-none">
              Heart Failure
            </text>
          </g>

          {/* BNP (18px) */}
          <g transform="translate(340, 160)" className="cursor-pointer">
            <circle r="22" fill="none" stroke="var(--verdigris)" strokeWidth="1" opacity="0.5" />
            <circle r="18" fill="var(--verdigris)" fillOpacity="0.85" />
            <text y="32" fill="var(--bone)" textAnchor="middle" className="type-label">
              BNP
            </text>
          </g>

          {/* Ejection Fraction (14px) */}
          <g transform="translate(300, 235)" className="cursor-pointer">
            <circle r="14" fill="var(--verdigris)" fillOpacity="0.85" stroke="var(--verdigris)" strokeWidth="1" />
            <text y="28" fill="var(--bone)" textAnchor="middle" className="type-label">
              Ejection Fraction
            </text>
          </g>

          {/* NYHA Class (14px) */}
          <g transform="translate(210, 305)" className="cursor-pointer">
            <circle r="14" fill="var(--verdigris)" fillOpacity="0.85" stroke="var(--verdigris)" strokeWidth="1" />
            <text y="28" fill="var(--bone)" textAnchor="middle" className="type-label">
              NYHA Class
            </text>
          </g>

          {/* Creatinine (Active, with ring glow) (18px) */}
          <g transform="translate(570, 190)" className="cursor-pointer" onClick={() => setSelectedNode("Creatinine")}>
            <circle r="26" fill="none" stroke="var(--verdigris)" strokeWidth="1.5" opacity="0.4" />
            <circle r="22" fill="none" stroke="var(--verdigris)" strokeWidth="2" opacity="0.8" />
            <circle r="18" fill="var(--verdigris)" fillOpacity="0.85" filter="url(#glow-verdigris)" />
            <text y="32" fill="var(--bone)" textAnchor="middle" className="type-label font-semibold">
              Creatinine
            </text>
          </g>

          {/* eGFR (14px) */}
          <g transform="translate(615, 235)" className="cursor-pointer">
            <circle r="14" fill="var(--verdigris)" fillOpacity="0.85" stroke="var(--verdigris)" strokeWidth="1" />
            <text y="28" fill="var(--bone)" textAnchor="middle" className="type-label">
              eGFR
            </text>
          </g>

          {/* SGLT2 Inhibitors (16px) */}
          <g transform="translate(330, 385)" className="cursor-pointer">
            <circle r="16" fill="var(--lilac)" fillOpacity="0.85" stroke="var(--lilac)" strokeWidth="1" />
            <text y="28" fill="var(--bone)" textAnchor="middle" className="type-label">
              SGLT2 Inhibitors
            </text>
          </g>

          {/* ACE Inhibitors (14px) */}
          <g transform="translate(350, 430)" className="cursor-pointer">
            <circle r="14" fill="var(--lilac)" fillOpacity="0.85" stroke="var(--lilac)" strokeWidth="1" />
            <text y="28" fill="var(--bone)" textAnchor="middle" className="type-label">
              ACE Inhibitors
            </text>
          </g>

          {/* Hospitalization (16px) */}
          <g transform="translate(565, 375)" className="cursor-pointer">
            <circle r="16" fill="var(--madder)" fillOpacity="0.85" stroke="var(--madder)" strokeWidth="1" />
            <text y="28" fill="var(--bone)" textAnchor="middle" className="type-label">
              Hospitalization
            </text>
          </g>

          {/* Readmission (14px) */}
          <g transform="translate(535, 440)" className="cursor-pointer">
            <circle r="14" fill="var(--madder)" fillOpacity="0.85" stroke="var(--madder)" strokeWidth="1" />
            <text y="28" fill="var(--bone)" textAnchor="middle" className="type-label">
              Readmission
            </text>
          </g>

          {/* Measurement Chips connected by 12px hairlines */}
          {/* BNP chip: 428 pg/mL High */}
          <line x1="358" y1="160" x2="376" y2="160" stroke="var(--dim)" strokeWidth="1" opacity="0.6" />

          {/* EF chip: 32% Low */}
          <line x1="286" y1="235" x2="268" y2="235" stroke="var(--dim)" strokeWidth="1" opacity="0.6" />

          {/* Creatinine chip: 1.4 mg/dL High */}
          <line x1="588" y1="175" x2="606" y2="175" stroke="var(--dim)" strokeWidth="1" opacity="0.6" />

          {/* eGFR chip: 48 mL/min Low */}
          <line x1="629" y1="235" x2="645" y2="235" stroke="var(--dim)" strokeWidth="1" opacity="0.6" />
        </svg>

        {/* HTML Layer for Measurement Chips (Crisp typography & badges) */}
        <div className="absolute top-[148px] left-[378px] z-20 flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--r-4)] bg-[var(--ink-800)]/90 border border-[var(--line-strong)]">
          <span className="type-mono-sm text-[var(--ochre)]">428 pg/mL</span>
          <span className="type-mono-sm px-1 py-0.2 rounded-[var(--r-4)] bg-[rgba(217,128,141,0.2)] text-[var(--madder)]">High</span>
        </div>

        <div className="absolute top-[223px] left-[200px] z-20 flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--r-4)] bg-[var(--ink-800)]/90 border border-[var(--line-strong)]">
          <span className="type-mono-sm text-[var(--ochre)]">32%</span>
          <span className="type-mono-sm px-1 py-0.2 rounded-[var(--r-4)] bg-[rgba(217,128,141,0.2)] text-[var(--madder)]">Low</span>
        </div>

        <div className="absolute top-[163px] left-[608px] z-20 flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--r-4)] bg-[var(--ink-800)]/90 border border-[var(--line-strong)]">
          <span className="type-mono-sm text-[var(--ochre)]">1.4 mg/dL</span>
          <span className="type-mono-sm px-1 py-0.2 rounded-[var(--r-4)] bg-[rgba(217,128,141,0.2)] text-[var(--madder)]">High</span>
        </div>

        <div className="absolute top-[223px] left-[647px] z-20 flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--r-4)] bg-[var(--ink-800)]/90 border border-[var(--line-strong)]">
          <span className="type-mono-sm text-[var(--ochre)]">48 mL/min</span>
          <span className="type-mono-sm px-1 py-0.2 rounded-[var(--r-4)] bg-[rgba(217,128,141,0.2)] text-[var(--madder)]">Low</span>
        </div>

        {/* Node Card (Floating layer on click/hover §7.16) */}
        {selectedNode === "Creatinine" && (
          <div
            className="absolute top-[200px] left-[550px] z-30 w-72 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] p-3.5"
            style={{ boxShadow: "var(--shadow-floating)" }}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[var(--line-faint)] mb-2">
              <span className="type-card-title text-[var(--bone)]">Creatinine</span>
              <IconButton size={22} title="Copy concept" className="border-transparent bg-transparent hover:bg-[var(--ink-700)]">
                <svg className="w-3.5 h-3.5 text-[var(--dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              </IconButton>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between type-body text-[12px]">
                <span className="text-[var(--dim)]">Type</span>
                <span className="type-mono-sm text-[var(--bone)]">Biomarker</span>
              </div>
              <div className="flex justify-between type-body text-[12px]">
                <span className="text-[var(--dim)]">Measured in</span>
                <span className="type-mono-sm text-[var(--bone)] truncate max-w-[150px]">NEJM_2023_HeartFailure.pdf</span>
              </div>
              <div className="flex justify-between type-body text-[12px]">
                <span className="text-[var(--dim)]">Location</span>
                <span className="type-mono-sm text-[var(--bone)]">p. 3, span 412 – 448</span>
              </div>
              <div className="flex justify-between type-body text-[12px]">
                <span className="text-[var(--dim)]">Confidence</span>
                <span className="type-mono-sm text-[var(--verdigris)]">0.94</span>
              </div>
            </div>
          </div>
        )}

        {/* Minimap (120×72 bottom-left §7.16) */}
        <div className="absolute bottom-4 left-4 z-20 w-[120px] h-[72px] rounded-[var(--r-6)] bg-[var(--ink-800)] border border-[var(--line-strong)] overflow-hidden">
          <svg className="w-full h-full p-1 opacity-80" viewBox="0 0 120 72">
            {/* Dots */}
            <circle cx="20" cy="20" r="2" fill="var(--cornflower)" />
            <circle cx="45" cy="35" r="3.5" fill="var(--cornflower)" />
            <circle cx="35" cy="18" r="2" fill="var(--verdigris)" />
            <circle cx="65" cy="22" r="2" fill="var(--verdigris)" />
            <circle cx="70" cy="28" r="1.5" fill="var(--ochre)" />
            <circle cx="38" cy="48" r="2" fill="var(--lilac)" />
            <circle cx="70" cy="46" r="2" fill="var(--madder)" />
            {/* Viewport rect */}
            <rect x="15" y="10" width="80" height="48" fill="none" stroke="var(--verdigris)" strokeWidth="1" strokeDasharray="2 2" />
          </svg>
        </div>

        {/* Zoom cluster (Right stacked icon-buttons §7.16) */}
        <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1">
          <IconButton size={28} title="Zoom in">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </IconButton>
          <IconButton size={28} title="Zoom out">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </IconButton>
          <IconButton size={28} title="Locate center">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
              <line x1="12" y1="2" x2="12" y2="5" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="2" y1="12" x2="5" y2="12" />
              <line x1="19" y1="12" x2="22" y2="12" />
            </svg>
          </IconButton>
        </div>
      </div>
    </div>
  );
};
