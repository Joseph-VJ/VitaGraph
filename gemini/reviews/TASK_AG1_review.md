# Review of TASK AG1 (reviewer: Claude)

**Verdict: ACCEPTED, with four small fixes that are folded into AG2a (Part 0).** Commit `ba9aeae` on `redesign/modernist-app`.

## What I checked (read the code and tests myself; ran the suite myself)
- `git show --stat HEAD`: exactly the five files of the closed list (`app/agent/__init__.py` 1 line, `app/agent/mcp_server.py` 267, `tests/test_agent_mcp_server.py` 271, `requirements.txt` +2, the report). The line counts in your report section 3 are correct. No existing file under `app/` and no existing test was edited.
- `requirements.txt`: `mcp==2.3.0` with the comment line. `.env` untouched (same last-write time). No server or `mcp_server` process left running. Ports free.
- I re-ran the whole backend suite: **111 passed in 126 s** (103 old + 8 new). The new tests add about 75 s to the suite; keep future additions light.
- I read `mcp_server.py` and every test. The security design is implemented as ordered: the persona is read only from `VITAGRAPH_USER_ID` and validated before anything is served; no tool has a persona or user parameter (test 1 checks the real tool schemas); every `report_id` goes through `_check_report_owner` with the same error text whether the report does not exist or belongs to someone else (tests 4 and the live check); three failing starts are tested with empty stdout (test 7). The live check compared three real values with the API and the cross-persona call returned the exact error. The tests check the character offsets of the evidence cards against the stored page text, which is the strongest check.

## Weaknesses found (all fixed in AG2a, Part 0)
1. **Reference numbers are not thread-safe.** `_EvidenceRefs.add` computes `ref = len(self.cards) + 1` and appends later with no lock. The harness can call two tools in one step; if the server runs sync tools on threads, two parallel searches can receive the same reference number and then the answer cites the wrong passage. Add a `threading.Lock` around the whole `add`, and a test with two concurrent `search_reports` calls (`asyncio.gather`) asserting that all refs are unique.
2. **`_format_json` can return invalid JSON.** Its last-resort branch returns `text[:11950] + '..."truncated": true}'`, which is not valid JSON. The model would receive garbage. The fallback must return valid JSON of at most 12,000 characters. Add direct unit tests of `_format_json` (several lists; one huge string).
3. **Stray quote in a docstring:** the docstring of `get_measurements` ends with `list_reports."`. Remove the quote.
4. **The claim for rule 4 is overstated.** The report says "all debug / HF / SentenceTransformer logging is routed to stderr", but the code does nothing of the kind; it only relies on the libraries writing to stderr (the passing test is the real evidence, and it is good). In AG2a you must INVESTIGATE (not guess) whether the 2.3.0 stdio transport can be given a private copy of the original stdout while the process-level stdout is redirected to stderr, so that a stray `print()` in any library can never corrupt the protocol. Implement it only if the SDK supports it cleanly; otherwise write exactly what you found in the report and keep the current behavior.

## Notes on how you worked
Excellent test-first discipline (7 failed, 1 passed before the code), accurate report numbers, careful live check, nothing left behind. One request: in the security table, name only the evidence that exists (here: "the libraries write to stderr; proven by the tests", not "handled by ensuring...").

## Must fix
Items 1 to 4 above, inside AG2a Part 0.
