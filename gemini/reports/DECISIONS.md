# Owner decisions for VitaGraph-plan.md (section 6)

Recorded 2026-10-05. The owner did not change any answer, so the plan's **default stands** for every decision (plan section 6: "If there is no answer, the default stands"). The owner may change an answer later; a task that depends on the changed decision must not have started yet.

| ID | Decision | Answer in force |
|---|---|---|
| DEC-1 | 3D graph rotates by itself (reference behaviour, with the rules of performance rule 12) | Yes (default) |
| DEC-2 | Datasets, Ontology and Notebooks pages | Delete (default), task A3 |
| DEC-3 | Upload page frame stage (no frame images exist) | Remove the stage (default), task A9 step 13 |
| DEC-4 | Reference "process speed" setting | Add as optional task C8 (default) |
| DEC-5 | Task tiers | As labelled on each task (default). Could: C8, D4, D5, D7, D8, D10, E4 |
| DEC-6 | `user_id` on the older routes `/pages`, `/measurements`, `/pages/{n}/image` | Optional, checked when given (default), task F1. The reviewer recommends **Required** (it needs three existing tests to send `user_id`); the owner decides before F1 starts |
| DEC-7 | The API key committed in two archive files | The owner must rotate it now (default); task F2 removes the value from the files |
