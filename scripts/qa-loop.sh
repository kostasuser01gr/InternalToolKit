#!/bin/bash
set -e

# Configuration
RUNS=${QA_LOOP_RUNS:-1}
FAILED=0

echo "=== STARTING QA LOOP (Runs: $RUNS) ==="

for ((i=1; i<=RUNS; i++)); do
  echo ""
  echo "--- RUN $i OF $RUNS ---"
  
  if pnpm qa:all; then
    echo "✅ RUN $i PASSED"
  else
    echo "❌ RUN $i FAILED"
    FAILED=1
    break
  fi
done

if [ $FAILED -eq 0 ]; then
  echo ""
  echo "🎉 ALL GREEN - QA Loop completed successfully!"
  exit 0
else
  echo ""
  echo "🚨 QA Loop FAILED"
  echo "Check artifacts in apps/web/test-results/ for traces and reports."
  exit 1
fi
