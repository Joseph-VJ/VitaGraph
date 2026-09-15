#!/usr/bin/env bash
# ralph-gemini.sh  (run from the project root)
MAX=${1:-20}
: > loop.log
for i in $(seq 1 "$MAX"); do
  echo "=== iteration $i ===" | tee -a loop.log
  gemini -p "$(cat PROMPT.md)" --approval-mode yolo 2>&1 | tee -a loop.log
  grep -q "<promise>COMPLETE</promise>" loop.log && { echo "LOOP DONE"; break; }
done
