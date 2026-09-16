import json
import re

prompt_file = "VITAGRAPH_MOTION_PROMPT.md"
with open(prompt_file, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Extract PART C (MOTION.md)
# Look for ```markdown\n# VitaGraph — MOTION.md ... \n```
part_c_match = re.search(r"````markdown\n(# VitaGraph — MOTION\.md[\s\S]*?)\n````", content)
if part_c_match:
    part_c_content = part_c_match.group(1).strip() + "\n"
    with open("site design/MOTION.md", "w", encoding="utf-8") as f:
        f.write(part_c_content)
    print("Created site design/MOTION.md successfully.")
else:
    print("ERROR: Could not find PART C in VITAGRAPH_MOTION_PROMPT.md")

# 2. Amend site design/Qwen_markdown_20260909_yutce0yzs.md
design_file = "site design/Qwen_markdown_20260909_yutce0yzs.md"
with open(design_file, "r", encoding="utf-8") as f:
    design_content = f.read()

amendment_line = "> §8 is extended and minimally amended by MOTION.md v1.0 (DESIGN §14). Ratified amendments are listed in MOTION.md §M0.\n\n"
if "Ratified amendments are listed in MOTION.md §M0" not in design_content:
    target = "## 8. Motion & the orchestrated sequences\n\n"
    if target in design_content:
        design_content = design_content.replace(target, target + amendment_line, 1)
        with open(design_file, "w", encoding="utf-8") as f:
            f.write(design_content)
        print("Updated site design/Qwen_markdown_20260909_yutce0yzs.md with amendment line.")
    else:
        print("ERROR: Could not find section 8 in DESIGN.md")
else:
    print("Amendment line already present in DESIGN.md.")

# 3. Extract PART D (PROMPT_MOTION.md)
part_d_match = re.search(r"```text\n(MISSION: Add the game-grade motion[\s\S]*?)\n```", content)
if part_d_match:
    part_d_content = part_d_match.group(1).strip() + "\n"
    with open("PROMPT_MOTION.md", "w", encoding="utf-8") as f:
        f.write(part_d_content)
    print("Created PROMPT_MOTION.md successfully.")
else:
    print("ERROR: Could not find PART D in VITAGRAPH_MOTION_PROMPT.md")

# 4. Define MS stories for tasks/motion-prd.json
motion_stories = [
    {
        "id": "MS-01",
        "title": "Motion foundation: tokens, engine, governor",
        "spec": "§M2, §M4",
        "passes": False,
        "acceptance": "src/motion/{ticker,spring,sequence,quality,features,flip}.ts live; --m-* + easings in tokens.css; springToLinear() emits cached linear() strings; tier chip motion T3 in StatusStrip (A3); Settings override persisted; reduced-motion hard-locks T0 live; idle => zero rAF (proof)",
        "gates": "17,19,20,29",
        "verify": "npm run build; pytest -q; tier-chip png, idle-rAF trace"
    },
    {
        "id": "MS-02",
        "title": "Global grammar: enter/exit/FLIP, route transitions, boot ignition, detent press",
        "spec": "§M5.1–5.4, §M6",
        "passes": False,
        "acceptance": "Route change: ViewTransition path + fallback path both verified (feature-flag off test); sidebar active-rule FLIPs; boot <=1.6 s once/session, skippable by first input, skipped at T0/T1; every button/input has press micro-feedback same-frame",
        "gates": "18,24,30,32",
        "verify": "boot.webm, skip-proof, route pair png"
    },
    {
        "id": "MS-03",
        "title": "Home motion pass",
        "spec": "§M7.1",
        "passes": False,
        "acceptance": "Tiles odometer only after real fetch; sparkline draws once; activity insert FLIPs; health LEDs ignite in order; refusals tile has no celebration motion",
        "gates": "21,25,27",
        "verify": "home T3/T0 png pair, odometer assert"
    },
    {
        "id": "MS-04",
        "title": "Upload motion pass (SSE-gated stepper)",
        "spec": "§M7.2",
        "passes": False,
        "acceptance": "Drag lifecycle states real-only; stepper advances only on SSE events; work-dot when stage > cap; checkmark draws; OCR scanline once (T3); quarantine impulse <=2/session; copy = check draw, no toast",
        "gates": "18,21,24",
        "verify": "stepper.webm (live SSE), quarantine png"
    },
    {
        "id": "MS-05",
        "title": "GraphStage engine pass",
        "spec": "§M8.1, M8.4, M8.5",
        "passes": False,
        "acceptance": "Glow sprite cache (5 sprites, no per-frame gradients); DPR caps per tier; hover <=1-frame response w/ incident-edge emphasis; camera springs w/ user-interrupt + momentum hand-off; zero alloc in draw loop; single ticker (GraphStage rAF removed)",
        "gates": "19,28,29",
        "verify": "120-node benchmark json, hover.webm"
    },
    {
        "id": "MS-06",
        "title": "Graph reveal & activation FX",
        "spec": "§M8.2, M8.3, M8.6, M8.7",
        "passes": False,
        "acceptance": "Ontology-ordered reveal from real node records (Report->Category->Test->Measurement->Chunk), 24 ms stagger cap 480; edges draw after endpoints; dim-to-40 % spring lands exactly on 0.40; frozen 1200 ms pulse kept; photons <=24 speed proportional to 1/latency; dust <=40 pooled T3-only; hull breathe <=2 % screen change, paused off-screen; no re-reveal on unchanged refetch",
        "gates": "18,21,22,28",
        "verify": "activation.webm, dim-0.40 assert, T1 throttle.webm"
    },
    {
        "id": "MS-07",
        "title": "Ask choreography (the orchestrated moment)",
        "spec": "§M7.4",
        "passes": False,
        "acceptance": "Every trace row lands on its real SSE event; FLIP input->question card; rank chips FLIP-reorder; underlines draw at citation; answer mask-reveal per part; slips deal <=4 animated; refusal impulse + wash once; stream error freezes at failed row with error state",
        "gates": "18,21,23,27",
        "verify": "ask-trace.json, refusal.webm, error-freeze png"
    },
    {
        "id": "MS-08",
        "title": "Timeline + Evidence viewer",
        "spec": "§M7.5, §M7.6",
        "passes": False,
        "acceptance": "Spine scroll-bound (animation-timeline + IO/rAF fallback verified in Firefox); single-fire block enters; new-report insertion FLIP + spine draw on real done event; delete-cascade collapse order + 400 ms armed confirm; evidence viewer shared-element (VT + FLIP paths), brackets draw clockwise, wash holds, offsets odometer exact",
        "gates": "21,25,26,27",
        "verify": "spine-firefox.webm, viewer morph pair png"
    },
    {
        "id": "MS-09",
        "title": "Compare + Insights + Library + empty states",
        "spec": "§M7.7–M7.9",
        "passes": False,
        "acceptance": "Converging diff rows; summary segments scaleX to real proportions; modularity ring sweep synced to Q odometer; centrality race-sort via FLIP on reorder; predicate sweep clockwise; footnote last; empty-state sketch draws once, no loops; Settings > Motion section live",
        "gates": "21,25,27,32",
        "verify": "race-sort.webm, insights T0 png"
    },
    {
        "id": "MS-10",
        "title": "Failure & honest states",
        "spec": "§M7.10",
        "passes": False,
        "acceptance": "Banner drop + static hatch; LED blink <=2 Hz measured; error card single impulse+wash; REPLAY badge static-on; allow_api chip never pulses; all states legible at T0 (matrix screenshots)",
        "gates": "21,24",
        "verify": "blink-hz calc, failure matrix pngs"
    },
    {
        "id": "MS-11",
        "title": "Performance, QA audit & viva material",
        "spec": "§M10–M12",
        "passes": False,
        "acceptance": "All budgets met with artifacts (traces, Lighthouse diff, memory diff, governor throttle recording); gates 17–32 all green; MOTION.md + demo-script motion appendix committed (talking points: tier chip, governor demo, event-gated reveals, exact-40 % dim, 1200 ms frozen ring); README motion row; tag v1.1.0-motion",
        "gates": "all",
        "verify": "full artifact set, lighthouse pair"
    },
    {
        "id": "MS-12",
        "title": "Audio detents + gallery motion specimens",
        "spec": "§M9, DESIGN §13",
        "passes": False,
        "acceptance": "WebAudio synth (no assets), default off, persisted toggle, muted when hidden, disabled at T0, never sole channel; GalleryPage gains a 'Motion specimens' section showing every §M5 primitive with its token",
        "gates": "31",
        "verify": "gallery png, audio-off proof"
    }
]

with open("tasks/motion-prd.json", "w", encoding="utf-8") as f:
    json.dump({"branchName": "vitagraph-completion", "userStories": motion_stories}, f, indent=2)
print("Created tasks/motion-prd.json successfully.")

# 5. Update tasks/prd.json: set US-15 passes: true, and append MS-01..MS-12 if not already present
with open("tasks/prd.json", "r", encoding="utf-8") as f:
    prd_data = json.load(f)

for story in prd_data["userStories"]:
    if story["id"] == "US-15":
        story["passes"] = True
        print("Updated US-15 to passes: true in tasks/prd.json.")

existing_ids = {s["id"] for s in prd_data["userStories"]}
for ms in motion_stories:
    if ms["id"] not in existing_ids:
        prd_data["userStories"].append(ms)
        existing_ids.add(ms["id"])

with open("tasks/prd.json", "w", encoding="utf-8") as f:
    json.dump(prd_data, f, indent=2)
print("Updated tasks/prd.json with merged motion stories.")
