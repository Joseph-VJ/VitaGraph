# Review: S3 + S4 round (merged at 19f394e)

**Accepted and merged.** Merge main into worktree branch: no conflicts. Backend 218 passed (213 + 5 new), build OK, `audit:design` 0 errors, 11 pages checked at 1440x900 (header 76 px except AI Agent), console clean except the missing upload frames (404, expected until the owner supplies frames).

Verified live: graph labels readable (large demo persona, 55 nodes), subgraph rows one line, Timeline tags light grey, Library SHA on one line, Upload buttons on one row, conversation column on the AI Agent page.

## Found, handed to S5
1. AI Agent header is 123 px (two rows): subtitle too long.
2. Docs state accent `#e03e1a` (real: `#ec3013`) and 213 tests (real: 218).
3. Upload stage panel logs a 404 for the missing first frame.
4. F1 privacy (persona check on report routes) still open.
